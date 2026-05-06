const DRM_HOST_PATTERNS = [
  /(^|\.)netflix\.com$/i,
  /(^|\.)disneyplus\.com$/i,
  /(^|\.)hulu\.com$/i,
  /(^|\.)max\.com$/i,
  /(^|\.)hbomax\.com$/i,
  /(^|\.)primevideo\.com$/i,
  /(^|\.)tv\.apple\.com$/i,
  /(^|\.)tv\.youtube\.com$/i
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

export function classifyVideoFailure(code, { knownDrmPage = false } = {}) {
  if (code === "video_drm_protected") {
    return "video_drm_protected";
  }

  if (code === "video_not_found" || code === "video_frame_unavailable") {
    return "video_frame_unavailable";
  }

  if (code === "video_security_error") {
    return "video_cors_tainted";
  }

  if (knownDrmPage) {
    return "video_drm_protected";
  }

  return "video_cors_tainted";
}

