import { getStoredLocale, getTranslator } from "../i18n/i18n.js";

const elements = {
  status: document.getElementById("status"),
  reconnect: document.getElementById("reconnect"),
  captureVisible: document.getElementById("captureVisible"),
  selectArea: document.getElementById("selectArea"),
  hint: document.getElementById("hint"),
  privacy: document.getElementById("privacy"),
  shortcutLabel: document.getElementById("shortcutLabel"),
  shortcutValue: document.getElementById("shortcutValue"),
  customizeShortcut: document.getElementById("customizeShortcut"),
  floatingBallToggle: document.getElementById("floatingBallToggle"),
  floatingBallLabel: document.getElementById("floatingBallLabel"),
  floatingBallHint: document.getElementById("floatingBallHint"),
  batchLabel: document.getElementById("batchLabel"),
  batchHint: document.getElementById("batchHint"),
  batchSendAll: document.getElementById("batchSendAll"),
  batchStatus: document.getElementById("batchStatus")
};

const SHORTCUTS_URLS = ["chrome://extensions/shortcuts", "edge://extensions/shortcuts"];
const FLOATING_KEY = "genericFloatingBallEnabled";

const BATCH_HOST_PATTERNS = [
  /(^|\.)weibo\.com$/i,
  /^x\.com$/i,
  /(^|\.)x\.com$/i,
  /^twitter\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)instagram\.com$/i
];

function isBatchSupportedUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return BATCH_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

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
  elements.reconnect.textContent = t("action.reconnect");
  elements.reconnect.hidden = currentState.status === "ready";
  elements.captureVisible.textContent = t("action.captureVisible");
  elements.selectArea.textContent = t("action.selectArea");
  elements.hint.textContent = t("hint.rightClick");
  elements.privacy.textContent = t("privacy.localOnly");
  elements.shortcutLabel.textContent = t("shortcut.label");
  elements.customizeShortcut.textContent = t("shortcut.customize");
  elements.floatingBallLabel.textContent = t("floatingBall.label");
  elements.floatingBallHint.textContent = t("floatingBall.hint");
  elements.batchLabel.textContent = t("batch.label");
  elements.batchHint.textContent = t("batch.hint");
  elements.batchSendAll.textContent = t("batch.sendAll");
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

async function loadFloatingBallToggle() {
  try {
    const stored = await chrome.storage.sync.get(FLOATING_KEY);
    elements.floatingBallToggle.checked = Boolean(stored[FLOATING_KEY]);
  } catch {
    elements.floatingBallToggle.checked = false;
  }
}

async function refreshBatchAvailability() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const supported = isBatchSupportedUrl(tab?.url);
    elements.batchSendAll.disabled = !supported;
    elements.batchSendAll.dataset.tabId = supported ? String(tab.id) : "";
    if (!supported) {
      elements.batchSendAll.title = t("batch.unsupportedTitle");
    } else {
      elements.batchSendAll.title = "";
    }
  } catch {
    elements.batchSendAll.disabled = true;
  }
}

function setBatchStatus(message, tone = "error") {
  if (!message) {
    elements.batchStatus.hidden = true;
    elements.batchStatus.textContent = "";
    return;
  }
  elements.batchStatus.hidden = false;
  elements.batchStatus.textContent = message;
  elements.batchStatus.dataset.tone = tone;
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
      const fallback = url === SHORTCUTS_URLS[0] ? SHORTCUTS_URLS[1] : SHORTCUTS_URLS[0];
      chrome.tabs.create({ url: fallback });
    }
  });
});

elements.floatingBallToggle.addEventListener("change", () => {
  void chrome.storage.sync.set({
    [FLOATING_KEY]: elements.floatingBallToggle.checked
  });
});

elements.batchSendAll.addEventListener("click", async () => {
  setBatchStatus(null);
  const tabId = Number(elements.batchSendAll.dataset.tabId);
  if (!tabId) {
    setBatchStatus(t("batch.unsupportedTitle"), "error");
    return;
  }
  elements.batchSendAll.disabled = true;
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "snaplex:trigger-batch-transfer"
    });
    if (response?.ok) {
      setBatchStatus(t("batch.started"), "ok");
    } else {
      setBatchStatus(t("batch.unsupportedTitle"), "error");
    }
  } catch {
    setBatchStatus(t("batch.unsupportedTitle"), "error");
  } finally {
    setTimeout(() => {
      void refreshBatchAvailability();
    }, 600);
  }
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

void loadFloatingBallToggle();
void initializeLocale().then(refreshState).then(refreshBatchAvailability);
