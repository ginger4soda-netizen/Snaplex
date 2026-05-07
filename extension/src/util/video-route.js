// Site-level routing for video capture.
//
// Returns "direct" when the site reliably exposes the rendered video frame to
// `<canvas>.drawImage`, and "screenshot" when historical evidence (DRM, custom
// renderers, anti-tamper) makes screenshot fallback the more reliable default.
// See docs/discovery/video-frame-extract-matrix.md for the underlying study.

const DIRECT_HOSTS = [
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i
];

const SCREENSHOT_HOSTS = [
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)bilibili\.com$/i,
  /(^|\.)bilivideo\.com$/i,
  /(^|\.)tiktok\.com$/i
];

export const VIDEO_ROUTE_DIRECT = "direct";
export const VIDEO_ROUTE_SCREENSHOT = "screenshot";

export function pickVideoRoute(url) {
  if (typeof url !== "string" || url.length === 0) {
    return VIDEO_ROUTE_DIRECT;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return VIDEO_ROUTE_DIRECT;
  }

  const hostname = parsed.hostname || "";
  if (DIRECT_HOSTS.some((pattern) => pattern.test(hostname))) {
    return VIDEO_ROUTE_DIRECT;
  }
  if (SCREENSHOT_HOSTS.some((pattern) => pattern.test(hostname))) {
    return VIDEO_ROUTE_SCREENSHOT;
  }
  return VIDEO_ROUTE_DIRECT;
}
