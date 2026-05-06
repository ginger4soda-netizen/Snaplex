const INLINE_PAYLOAD_LIMIT_BYTES = 256 * 1024;
const TEMPFILE_CHUNK_BYTES = 512 * 1024;

export const MAX_CAPTURE_BYTES = 50 * 1024 * 1024;

export async function payloadRefForBytes(bytes, contentType, sendNativeRequest) {
  if (bytes.byteLength <= INLINE_PAYLOAD_LIMIT_BYTES) {
    return {
      kind: "inline",
      value: bytesToBase64(bytes),
      content_type: contentType
    };
  }

  const path = await writeTempfileInChunks(bytes, sendNativeRequest);
  return {
    kind: "tempfile",
    value: path,
    content_type: contentType
  };
}

export function feedbackForCaptureResult(response, t) {
  if (response.kind === "error") {
    return {
      tone: "failed",
      message: errorMessageForCode(response.code, t, response.message)
    };
  }

  if (response.outcome === "saved") {
    return {
      tone: "saved",
      message: t("toast.saved")
    };
  }

  if (response.outcome === "duplicate" && response.source_appended) {
    return {
      tone: "duplicate",
      message: t("toast.duplicateSource")
    };
  }

  if (response.outcome === "duplicate") {
    return {
      tone: "duplicate",
      message: t("toast.duplicate")
    };
  }

  return {
    tone: "failed",
    message: errorMessageForCode(response.code, t, response.message)
  };
}

export function errorMessageForCode(code, t, fallbackMessage) {
  const key = {
    no_active_library: "error.noActiveLibrary",
    native_host_unavailable: "error.desktopUnavailable",
    desktop_not_started: "error.desktopUnavailable",
    desktop_not_responding: "error.desktopUnavailable",
    desktop_timeout: "error.desktopUnavailable",
    native_request_pending: "error.captureBusy",
    payload_too_large: "error.payloadTooLarge",
    unsupported_content_type: "error.unsupportedContentType",
    invalid_image_bytes: "error.invalidImageBytes",
    image_canvas_tainted: "error.imageFetchFailed",
    image_fetch_failed: "error.imageFetchFailed",
    restricted_page: "error.restrictedPage",
    selection_too_small: "region.tooSmall",
    screenshot_failed: "error.screenshotFailed",
    video_cors_tainted: "error.videoCorsTainted",
    video_drm_protected: "error.videoDrmProtected",
    video_frame_unavailable: "error.videoFrameUnavailable",
    video_not_found: "error.videoFrameUnavailable",
    tempfile_write_failed: "error.captureFailed"
  }[code];

  return key ? t(key) : fallbackMessage || t("error.captureFailed");
}

export function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?((?:;[^,]+)*),(.*)$/i.exec(dataUrl);
  if (!match) {
    throw captureError("invalid_data_url", "Invalid data URL");
  }

  const contentType = normalizeContentType(match[1] || "application/octet-stream");
  const options = match[2] || "";
  const body = match[3] || "";
  const bytes = options.includes(";base64")
    ? base64ToBytes(body)
    : new TextEncoder().encode(decodeURIComponent(body));

  return {
    bytes,
    contentType
  };
}

export function normalizeContentType(contentType) {
  return String(contentType || "application/octet-stream")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

export function captureError(code, message) {
  return Object.assign(new Error(message), { code });
}

async function writeTempfileInChunks(bytes, sendNativeRequest) {
  const tempfileId = newTempfileId();
  let lastReply = null;

  for (let offset = 0; offset < bytes.byteLength; offset += TEMPFILE_CHUNK_BYTES) {
    const end = Math.min(offset + TEMPFILE_CHUNK_BYTES, bytes.byteLength);
    const done = end >= bytes.byteLength;
    lastReply = await sendNativeRequest(
      {
        kind: "write_tempfile_chunk",
        tempfile_id: tempfileId,
        chunk_base64: bytesToBase64(bytes.subarray(offset, end)),
        reset: offset === 0,
        done
      },
      done ? ["tempfile_path"] : ["tempfile_chunk_written"],
      30000
    );

    if (lastReply.kind === "error") {
      throw captureError(lastReply.code || "tempfile_write_failed", lastReply.message || "Tempfile write failed");
    }
  }

  if (!lastReply?.path) {
    throw captureError("tempfile_write_failed", "Tempfile path was not returned");
  }

  return lastReply.path;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function newTempfileId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
