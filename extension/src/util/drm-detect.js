const DRM_HOST_PATTERNS = [
  /(^|\.)netflix\.com$/i,
  /(^|\.)disneyplus\.com$/i,
  /(^|\.)hulu\.com$/i,
  /(^|\.)max\.com$/i,
  /(^|\.)hbomax\.com$/i,
  /(^|\.)primevideo\.com$/i,
  /(^|\.)tv\.apple\.com$/i,
  /(^|\.)tv\.youtube\.com$/i,
  /(^|\.)iqiyi\.com$/i,
  /(^|\.)iq\.com$/i,
  /(^|\.)v\.qq\.com$/i,
  /(^|\.)youku\.com$/i,
  /(^|\.)mgtv\.com$/i,
  /(^|\.)wetv\.vip$/i,
  /(^|\.)viki\.com$/i,
  /(^|\.)peacocktv\.com$/i
];

export function isKnownDrmPage(...urls) {
  return urls.filter(Boolean).some((value) => {
    try {
      const url = new URL(value);
      if (DRM_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
        return true;
      }

      if (/(^|\.)youtube\.com$/i.test(url.hostname)) {
        return url.pathname.startsWith("/movies") || url.pathname.startsWith("/tv");
      }
    } catch {
      return false;
    }

    return false;
  });
}

export function classifyVideoFailure(code, { knownDrmPage = false, hasMediaKeys = false } = {}) {
  if (code === "video_drm_protected") {
    return "video_drm_protected";
  }

  if (code === "black_frame") {
    return knownDrmPage || hasMediaKeys ? "video_drm_protected" : "black_frame";
  }

  if (code === "no_video") {
    return "video_frame_unavailable";
  }

  if (code === "not_ready" || code === "video_frame_unavailable") {
    return "video_frame_unavailable";
  }

  if (code === "security_error" || code === "video_security_error") {
    return "video_cors_tainted";
  }

  if (knownDrmPage || hasMediaKeys) {
    return "video_drm_protected";
  }

  return "video_cors_tainted";
}

// Codes that should fall back to screenshot capture (black_frame is conditional
// — the caller must check DRM signals before deciding to fall back).
export const FALLBACKABLE_VIDEO_CODES = new Set([
  "security_error",
  "video_security_error",
  "video_cors_tainted",
  "video_capture_failed",
  "video_frame_unavailable",
  "not_ready",
  "no_video",
  "black_frame"
]);

export function shouldFallbackToScreenshot(code, { knownDrmPage = false, hasMediaKeys = false } = {}) {
  if (code === "video_drm_protected") {
    return false;
  }
  if (code === "black_frame" && (knownDrmPage || hasMediaKeys)) {
    return false;
  }
  return FALLBACKABLE_VIDEO_CODES.has(code);
}
