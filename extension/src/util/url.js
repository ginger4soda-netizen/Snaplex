const RESTRICTED_PROTOCOLS = new Set([
  "chrome:",
  "chrome-extension:",
  "edge:",
  "about:",
  "devtools:"
]);

const RESTRICTED_HOSTS = new Set([
  "chromewebstore.google.com",
  "chrome.google.com"
]);

export function isRestrictedPageUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    if (RESTRICTED_PROTOCOLS.has(url.protocol)) {
      return true;
    }

    if (RESTRICTED_HOSTS.has(url.hostname)) {
      return url.pathname.startsWith("/webstore") || url.hostname === "chromewebstore.google.com";
    }

    return !/^https?:$/.test(url.protocol);
  } catch {
    return true;
  }
}

export function isInjectablePageUrl(value) {
  return !isRestrictedPageUrl(value);
}

