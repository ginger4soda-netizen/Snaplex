import { getStoredLocale, getTranslator } from "../i18n/i18n.js";
import { captureImageFromContextMenu, captureImageFromUrl } from "./capture-image.js";
import { captureRegionScreenshot, captureVisibleScreenshot } from "./capture-screenshot.js";
import { captureVideoFrameFromContextMenu } from "./capture-video-frame.js";
import { showFeedback } from "./feedback.js";
import { isRestrictedPageUrl } from "../util/url.js";

const HOST_NAME = "com.snaplex.host";
const RECONNECT_DELAY_MS = 5000;
const HTTP_DOCUMENT_PATTERNS = ["http://*/*", "https://*/*"];
const DESKTOP_UNREACHABLE_CODES = new Set([
  "desktop_disconnected",
  "desktop_io_error",
  "desktop_not_responding",
  "desktop_not_started",
  "desktop_timeout",
  "native_host_unavailable"
]);

const MENU_IDS = {
  saveImage: "snaplex-save-image",
  captureVisible: "snaplex-capture-visible",
  saveVideoFrame: "snaplex-save-video-frame"
};

let nativePort = null;
let pendingNativeRequest = null;
let nativeRequestChain = Promise.resolve();
let reconnectTimer = null;
let activeRegionTabId = null;
let contextMenusEnabled = null;
let contextMenusLocale = null;
let lastKnownState = {
  status: "connecting",
  code: null,
  locale: null,
  libraryName: null,
  updatedAt: new Date().toISOString()
};

function getManifestVersion() {
  return chrome.runtime.getManifest().version;
}

async function writeSession(values) {
  try {
    await chrome.storage.session.set(values);
  } catch {
    await chrome.storage.local.set(values);
  }
}

async function readSession(keys) {
  try {
    return await chrome.storage.session.get(keys);
  } catch {
    return await chrome.storage.local.get(keys);
  }
}

async function setConnectionState(patch) {
  lastKnownState = {
    ...lastKnownState,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  await writeSession({
    snaplexConnection: lastKnownState,
    snaplexLocale: lastKnownState.locale,
    snaplexLibraryName: lastKnownState.libraryName
  });
}

function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectNativeHost();
  }, RECONNECT_DELAY_MS);
}

function classifyDisconnect(message) {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("not found") || normalized.includes("specified native messaging host")) {
    return "native_host_unavailable";
  }
  if (normalized.includes("exited") || normalized.includes("disconnected")) {
    return "desktop_not_started";
  }
  return "desktop_not_responding";
}

function connectionStateForNativeError(message) {
  const code = message.code || "native_error";
  const status = DESKTOP_UNREACHABLE_CODES.has(code) ? "desktop_unreachable" : "capture_failed";
  return {
    status,
    code,
    message: message.message || null
  };
}

function connectNativeHost() {
  if (nativePort) {
    return;
  }

  void setConnectionState({ status: "connecting", code: null });

  try {
    nativePort = chrome.runtime.connectNative(HOST_NAME);
  } catch (error) {
    nativePort = null;
    void setConnectionState(
      connectionStateForNativeError({
        code: "native_host_unavailable",
        message: error.message
      })
    );
    scheduleReconnect();
    return;
  }

  const port = nativePort;

  port.onMessage.addListener((message) => {
    void handleNativeMessage(message);
  });

  port.onDisconnect.addListener(() => {
    const lastError = chrome.runtime.lastError;
    const wasCurrentPort = nativePort === port;
    if (wasCurrentPort) {
      nativePort = null;
    }
    if (wasCurrentPort && pendingNativeRequest) {
      pendingNativeRequest.reject(
        Object.assign(new Error(lastError?.message || "Native host disconnected"), {
          code: classifyDisconnect(lastError?.message)
        })
      );
      pendingNativeRequest = null;
    }
    if (wasCurrentPort) {
      void setConnectionState(
        connectionStateForNativeError({
          code: classifyDisconnect(lastError?.message),
          message: lastError?.message || null
        })
      );
      scheduleReconnect();
    }
  });
}

function forceReconnectNativeHost() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (pendingNativeRequest) {
    clearTimeout(pendingNativeRequest.timeoutId);
    pendingNativeRequest.reject(
      Object.assign(new Error("Reconnecting to Snaplex Desktop"), {
        code: "manual_reconnect"
      })
    );
    pendingNativeRequest = null;
  }

  const port = nativePort;
  nativePort = null;
  try {
    port?.disconnect();
  } catch {
    // The port may already be closed by Chrome.
  }

  connectNativeHost();
}

async function handleNativeMessage(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  if (
    pendingNativeRequest &&
    (pendingNativeRequest.expectedKinds.includes(message.kind) || message.kind === "error")
  ) {
    if (message.kind === "error") {
      await setConnectionState(connectionStateForNativeError(message));
    }
    clearTimeout(pendingNativeRequest.timeoutId);
    pendingNativeRequest.resolve(message);
    pendingNativeRequest = null;
    return;
  }

  if (message.kind === "hello") {
    nativePort?.postMessage({
      kind: "hello_ack",
      extension_version: getManifestVersion()
    });
    return;
  }

  if (message.kind === "ready") {
    const libraryName = message.library_name || message.libraryName || null;
    await setConnectionState({
      status: libraryName ? "ready" : "error",
      code: libraryName ? null : "no_active_library",
      locale: message.locale || (await getStoredLocale()),
      libraryName,
      desktopVersion: message.desktop_version || message.desktopVersion || null
    });
    contextMenusEnabled = null;
    await setupContextMenus();
    return;
  }

  if (message.kind === "error") {
    await setConnectionState(connectionStateForNativeError(message));
  }
}

function sendNativeRequest(message, expectedKinds, timeoutMs = 30000) {
  const task = () =>
    new Promise((resolve, reject) => {
      if (!nativePort) {
        reject(Object.assign(new Error("Snaplex native host is not connected"), {
          code: lastKnownState.code || "native_host_unavailable"
        }));
        return;
      }
      if (pendingNativeRequest) {
        reject(Object.assign(new Error("Another native request is already pending"), {
          code: "native_request_pending"
        }));
        return;
      }

      const timeoutId = setTimeout(() => {
        pendingNativeRequest = null;
        void setConnectionState(
          connectionStateForNativeError({
            code: "desktop_timeout",
            message: "Timed out waiting for Snaplex Desktop"
          })
        );
        reject(Object.assign(new Error("Timed out waiting for Snaplex Desktop"), {
          code: "desktop_timeout"
        }));
      }, timeoutMs);

      pendingNativeRequest = {
        expectedKinds,
        resolve,
        reject,
        timeoutId
      };

      try {
        nativePort.postMessage(message);
      } catch (error) {
        clearTimeout(timeoutId);
        pendingNativeRequest = null;
        reject(error);
      }
    });

  const queued = nativeRequestChain.catch(() => {}).then(task);
  nativeRequestChain = queued.catch(() => {});
  return queued;
}

async function setupContextMenus() {
  const locale = (await readSession(["snaplexLocale"])).snaplexLocale || (await getStoredLocale());
  const t = await getTranslator(locale);
  const activeTab = await getActiveTab();
  const shouldEnable = !isRestrictedPageUrl(activeTab?.url);

  if (contextMenusEnabled === shouldEnable && contextMenusLocale === locale) {
    return;
  }
  contextMenusEnabled = shouldEnable;
  contextMenusLocale = locale;

  await new Promise((resolve) => chrome.contextMenus.removeAll(resolve));
  if (!shouldEnable) {
    return;
  }

  chrome.contextMenus.create({
    id: MENU_IDS.saveImage,
    title: t("context.saveImage"),
    contexts: ["image"],
    documentUrlPatterns: HTTP_DOCUMENT_PATTERNS
  });

  chrome.contextMenus.create({
    id: MENU_IDS.captureVisible,
    title: t("context.captureVisible"),
    contexts: ["page"],
    documentUrlPatterns: HTTP_DOCUMENT_PATTERNS
  });

  chrome.contextMenus.create({
    id: MENU_IDS.saveVideoFrame,
    title: t("context.saveVideoFrame"),
    contexts: ["video"],
    documentUrlPatterns: HTTP_DOCUMENT_PATTERNS
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function getCurrentTranslator() {
  const locale = (await readSession(["snaplexLocale"])).snaplexLocale || (await getStoredLocale());
  return await getTranslator(locale);
}

async function showRestrictedFeedback(tab, captureType) {
  const t = await getCurrentTranslator();
  const startedAtMs = performance.now();
  await showFeedback(tab, {
    tone: "failed",
    message: t("error.restrictedPage"),
    captureType,
    startedAtMs
  });
  return {
    kind: "error",
    code: "restricted_page",
    message: t("error.restrictedPage")
  };
}

async function startRegionScreenshot(tab, source) {
  const t = await getCurrentTranslator();
  const targetTab = tab || (await getActiveTab());
  if (!targetTab?.id || isRestrictedPageUrl(targetTab.url)) {
    const startedAtMs = performance.now();
    await showFeedback(targetTab, {
      tone: "failed",
      message: t("error.restrictedPage"),
      captureType: "screenshot_region",
      startedAtMs
    });
    return {
      ok: false,
      code: "restricted_page",
      message: t("error.restrictedPage")
    };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      files: ["content/region-overlay/index.js"]
    });

    activeRegionTabId = targetTab.id;
    return await chrome.tabs.sendMessage(targetTab.id, {
      type: "snaplex:start-region-overlay",
      source,
      labels: {
        save: t("region.save"),
        cancel: t("region.cancel"),
        reselect: t("region.reselect"),
        tooSmall: t("region.tooSmall")
      }
    });
  } catch (error) {
    if (activeRegionTabId === targetTab.id) {
      activeRegionTabId = null;
    }
    await showFeedback(targetTab, {
      tone: "failed",
      message: t("error.screenshotFailed")
    });
    return {
      ok: false,
      code: "screenshot_failed",
      message: error?.message || t("error.screenshotFailed")
    };
  }
}

async function handlePlaceholderAction(kind, tab, extra = {}) {
  const t = await getCurrentTranslator();
  const messageKey = {
    captureVisible: "placeholder.captureVisible",
    saveImage: "placeholder.saveImage",
    saveVideoFrame: "placeholder.saveVideoFrame",
    selectArea: "placeholder.selectArea"
  }[kind];

  console.info("[Snaplex]", t(messageKey), {
    tabId: tab?.id,
    url: tab?.url,
    ...extra
  });

  return {
    ok: true,
    placeholder: true,
    message: t(messageKey)
  };
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_IDS.saveImage) {
    if (isRestrictedPageUrl(tab?.url || info.pageUrl)) {
      void showRestrictedFeedback(tab, "image");
      return;
    }
    void captureImageFromContextMenu({
      info,
      tab,
      sendNativeRequest,
      showFeedback,
      getTranslator: getCurrentTranslator
    });
    return;
  }

  if (info.menuItemId === MENU_IDS.captureVisible) {
    if (isRestrictedPageUrl(tab?.url || info.pageUrl)) {
      void showRestrictedFeedback(tab, "screenshot_visible");
      return;
    }
    void captureVisibleScreenshot({
      tab,
      sendNativeRequest,
      showFeedback,
      getTranslator: getCurrentTranslator
    });
    return;
  }

  if (info.menuItemId === MENU_IDS.saveVideoFrame) {
    if (isRestrictedPageUrl(tab?.url || info.pageUrl)) {
      void showRestrictedFeedback(tab, "video_frame");
      return;
    }
    void captureVideoFrameFromContextMenu({
      info,
      tab,
      sendNativeRequest,
      showFeedback,
      getTranslator: getCurrentTranslator
    });
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "start-region-screenshot") {
    return;
  }

  void (async () => {
    const targetTab = tab || (await getActiveTab());
    await startRegionScreenshot(targetTab, "command");
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    if (message?.type === "snaplex:get-popup-state") {
      sendResponse({
        ok: true,
        state: lastKnownState
      });
      return;
    }

    if (message?.type === "snaplex:force-reconnect") {
      forceReconnectNativeHost();
      sendResponse({
        ok: true,
        state: lastKnownState
      });
      return;
    }

    if (message?.type === "snaplex:capture-visible") {
      const tab = await getActiveTab();
      if (isRestrictedPageUrl(tab?.url)) {
        sendResponse(await showRestrictedFeedback(tab, "screenshot_visible"));
        return;
      }
      sendResponse(
        await captureVisibleScreenshot({
          tab,
          sendNativeRequest,
          showFeedback,
          getTranslator: getCurrentTranslator
        })
      );
      return;
    }

    if (message?.type === "snaplex:capture-image-by-url") {
      const srcUrl = message.srcUrl;
      if (!srcUrl) {
        sendResponse({ ok: false, code: "image_fetch_failed", message: "missing srcUrl" });
        return;
      }
      const response = await captureImageFromUrl({
        srcUrl,
        tab: sender?.tab,
        sendNativeRequest,
        showFeedback,
        getTranslator: getCurrentTranslator,
        batch: message.batch
      });
      sendResponse({
        ok: response?.kind === "capture_result",
        response
      });
      return;
    }

    if (message?.type === "snaplex:region-selected") {
      activeRegionTabId = null;
      const tab = sender.tab || (await getActiveTab());
      sendResponse(
        await captureRegionScreenshot({
          tab,
          rect: message.rect,
          dpr: message.dpr,
          sendNativeRequest,
          showFeedback,
          getTranslator: getCurrentTranslator
        })
      );
      return;
    }

    if (message?.type === "snaplex:region-cancelled") {
      if (sender.tab?.id === activeRegionTabId) {
        activeRegionTabId = null;
      }
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "snaplex:start-region-screenshot") {
      sendResponse(await startRegionScreenshot(await getActiveTab(), "popup"));
      return;
    }

    sendResponse({ ok: false, code: "unknown_message" });
  })();
  return true;
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  contextMenusEnabled = null;
  void setupContextMenus();

  if (!activeRegionTabId || activeRegionTabId === activeInfo.tabId) {
    return;
  }

  const tabId = activeRegionTabId;
  activeRegionTabId = null;
  chrome.tabs.sendMessage(tabId, { type: "snaplex:cancel-region-overlay" }).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeRegionTabId) {
    activeRegionTabId = null;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  contextMenusEnabled = null;
  void setupContextMenus();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" || changeInfo.url || tab.active) {
    contextMenusEnabled = null;
    void setupContextMenus();
  }
});

chrome.runtime.onStartup.addListener(() => {
  contextMenusEnabled = null;
  void setupContextMenus();
});

void setupContextMenus();
connectNativeHost();
