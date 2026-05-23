const MESSAGE_CACHE = new Map();

function normalizeLocale(locale) {
  const value = String(locale || "").toLowerCase();
  return value.startsWith("zh") ? "zh" : "en";
}

async function loadMessages(locale) {
  const normalized = normalizeLocale(locale);
  if (MESSAGE_CACHE.has(normalized)) {
    return MESSAGE_CACHE.get(normalized);
  }

  const url = chrome.runtime.getURL(`i18n/messages.${normalized}.json`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load i18n bundle: ${normalized}`);
  }

  const messages = await response.json();
  MESSAGE_CACHE.set(normalized, messages);
  return messages;
}

function interpolate(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : `{${key}}`;
  });
}

export async function getStoredLocale() {
  try {
    const session = await chrome.storage.session.get(["snaplexLocale"]);
    if (session.snaplexLocale) {
      return session.snaplexLocale;
    }
  } catch {
    const local = await chrome.storage.local.get(["snaplexLocale"]);
    if (local.snaplexLocale) {
      return local.snaplexLocale;
    }
  }

  return chrome.i18n?.getUILanguage?.() || "en";
}

export async function getTranslator(locale) {
  const messages = await loadMessages(locale || (await getStoredLocale()));
  return (key, values) => interpolate(messages[key] || key, values);
}

export { normalizeLocale };
