import { getStoredLocale, getTranslator } from "../i18n/i18n.js";

const elements = {
  status: document.getElementById("status"),
  libraryLabel: document.getElementById("libraryLabel"),
  libraryName: document.getElementById("libraryName"),
  reconnect: document.getElementById("reconnect"),
  captureVisible: document.getElementById("captureVisible"),
  selectArea: document.getElementById("selectArea"),
  hint: document.getElementById("hint"),
  privacy: document.getElementById("privacy"),
  shortcutLabel: document.getElementById("shortcutLabel"),
  shortcutValue: document.getElementById("shortcutValue"),
  customizeShortcut: document.getElementById("customizeShortcut")
};

const SHORTCUTS_URLS = ["chrome://extensions/shortcuts", "edge://extensions/shortcuts"];

function isEdgeBrowser() {
  return /\bEdg\//i.test(navigator.userAgent);
}

async function readRegionShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === "start-region-screenshot");
    return cmd?.shortcut?.trim() || "";
  } catch {
    return "";
  }
}

async function renderShortcut() {
  const shortcut = await readRegionShortcut();
  if (shortcut) {
    elements.shortcutValue.textContent = shortcut;
    elements.shortcutValue.dataset.state = "set";
  } else {
    elements.shortcutValue.textContent = t("shortcut.notSet");
    elements.shortcutValue.dataset.state = "unset";
  }
}

const DESKTOP_UNREACHABLE_CODES = new Set([
  "desktop_disconnected",
  "desktop_io_error",
  "desktop_not_responding",
  "desktop_not_started",
  "desktop_timeout",
  "native_host_unavailable"
]);

let t = (key) => key;
let currentState = {
  status: "connecting",
  code: null,
  libraryName: null
};

function statusTone(state) {
  if (state.status === "ready") {
    return "ready";
  }
  if (state.status === "connecting") {
    return "connecting";
  }
  return "error";
}

function statusLabel(state) {
  if (state.status === "ready") {
    return t("status.ready");
  }
  if (state.status === "connecting") {
    return t("status.connecting");
  }
  if (state.code === "version_incompatible" || state.code === "incompatible_version") {
    return t("status.incompatible");
  }
  if (state.code === "no_active_library") {
    return t("status.noLibrary");
  }
  if (state.status === "desktop_unreachable" || DESKTOP_UNREACHABLE_CODES.has(state.code)) {
    return t("status.desktopUnreachable");
  }
  if (state.status === "capture_failed") {
    return t("status.captureFailed");
  }
  return t("status.error");
}

function render() {
  elements.status.textContent = statusLabel(currentState);
  elements.status.dataset.tone = statusTone(currentState);
  elements.libraryLabel.textContent = t("library.current");
  elements.libraryName.textContent =
    currentState.libraryName ||
    (currentState.code === "no_active_library" ? t("library.none") : t("library.unknown"));
  elements.reconnect.textContent = t("action.reconnect");
  elements.reconnect.hidden = currentState.status === "ready";
  elements.captureVisible.textContent = t("action.captureVisible");
  elements.selectArea.textContent = t("action.selectArea");
  elements.hint.textContent = t("hint.rightClick");
  elements.privacy.textContent = t("privacy.localOnly");
  elements.shortcutLabel.textContent = t("shortcut.label");
  elements.customizeShortcut.textContent = t("shortcut.customize");
  void renderShortcut();
}

async function sendMessage(type) {
  return await chrome.runtime.sendMessage({ type });
}

async function refreshState() {
  const response = await sendMessage("snaplex:get-popup-state");
  if (response?.ok && response.state) {
    currentState = response.state;
  }
  render();
}

async function initializeLocale() {
  t = await getTranslator(await getStoredLocale());
  render();
}

elements.captureVisible.addEventListener("click", () => {
  void sendMessage("snaplex:capture-visible").then((response) => {
    if (response?.message) {
      console.info("[Snaplex]", response.message);
    }
  });
});

elements.reconnect.addEventListener("click", () => {
  elements.reconnect.disabled = true;
  void sendMessage("snaplex:force-reconnect")
    .then((response) => {
      if (response?.state) {
        currentState = response.state;
      }
      render();
    })
    .finally(() => {
      elements.reconnect.disabled = false;
    });
});

elements.selectArea.addEventListener("click", () => {
  void sendMessage("snaplex:start-region-screenshot").then((response) => {
    if (response?.message) {
      console.info("[Snaplex]", response.message);
    }
  });
});

elements.customizeShortcut.addEventListener("click", () => {
  const url = isEdgeBrowser() ? SHORTCUTS_URLS[1] : SHORTCUTS_URLS[0];
  chrome.tabs.create({ url }, () => {
    if (chrome.runtime.lastError) {
      // Some browsers reject chrome:// scheme; try the alternate.
      const fallback = url === SHORTCUTS_URLS[0] ? SHORTCUTS_URLS[1] : SHORTCUTS_URLS[0];
      chrome.tabs.create({ url: fallback });
    }
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "session" && areaName !== "local") {
    return;
  }

  if (changes.snaplexConnection?.newValue) {
    currentState = changes.snaplexConnection.newValue;
    render();
  }

  if (changes.snaplexLocale?.newValue) {
    void getTranslator(changes.snaplexLocale.newValue).then((translator) => {
      t = translator;
      render();
    });
  }
});

void initializeLocale().then(refreshState);
