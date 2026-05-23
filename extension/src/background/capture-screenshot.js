import {
  captureError,
  errorMessageForCode,
  feedbackForCaptureResult,
  MAX_CAPTURE_BYTES,
  parseDataUrl,
  payloadRefForBytes
} from "./capture-common.js";

export async function captureVisibleScreenshot({ tab, sendNativeRequest, showFeedback, getTranslator }) {
  const startedAtMs = performance.now();
  const t = await getTranslator();

  try {
    if (typeof tab?.windowId !== "number") {
      throw captureError("screenshot_failed", "No active browser window");
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const asset = parseDataUrl(dataUrl);
    if (asset.bytes.byteLength > MAX_CAPTURE_BYTES) {
      throw captureError("payload_too_large", "Screenshot is larger than 50 MB");
    }

    const payloadRef = await payloadRefForBytes(asset.bytes, "image/png", sendNativeRequest);
    const response = await sendNativeRequest(
      {
        kind: "capture",
        envelope: {
          type: "screenshot_visible",
          payload_ref: payloadRef,
          metadata: {
            source_url: null,
            page_url: tab.url || "",
            page_title: tab.title || "",
            filename_hint: null,
            captured_at: new Date().toISOString(),
            type_specific: {
              device_pixel_ratio: await getDevicePixelRatio(tab.id)
            }
          }
        }
      },
      ["capture_result"],
      60000
    );

    const feedback = {
      ...feedbackForCaptureResult(response, t),
      captureType: "screenshot_visible",
      startedAtMs
    };
    await showFeedback(tab, feedback);
    return response;
  } catch (error) {
    const code = error.code || "screenshot_failed";
    const fallbackMessage = error.message || t("error.screenshotFailed");
    await showFeedback(tab, {
      tone: "failed",
      message: errorMessageForCode(code, t, fallbackMessage),
      captureType: "screenshot_visible",
      startedAtMs
    });
    return {
      kind: "error",
      code,
      message: fallbackMessage
    };
  }
}

export async function captureRegionScreenshot({ tab, rect, dpr, sendNativeRequest, showFeedback, getTranslator }) {
  const startedAtMs = performance.now();
  const t = await getTranslator();

  try {
    if (typeof tab?.windowId !== "number") {
      throw captureError("screenshot_failed", "No active browser window");
    }

    const normalizedRect = normalizeRect(rect);
    if (!normalizedRect || normalizedRect.w < 8 || normalizedRect.h < 8) {
      throw captureError("selection_too_small", "Selection is too small");
    }

    const scale = typeof dpr === "number" && dpr > 0 ? dpr : 1;
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const cropped = await cropDataUrl(dataUrl, normalizedRect, scale);
    if (cropped.bytes.byteLength > MAX_CAPTURE_BYTES) {
      throw captureError("payload_too_large", "Screenshot is larger than 50 MB");
    }

    const payloadRef = await payloadRefForBytes(cropped.bytes, "image/png", sendNativeRequest);
    const response = await sendNativeRequest(
      {
        kind: "capture",
        envelope: {
          type: "screenshot_region",
          payload_ref: payloadRef,
          metadata: {
            source_url: null,
            page_url: tab.url || "",
            page_title: tab.title || "",
            filename_hint: null,
            captured_at: new Date().toISOString(),
            type_specific: {
              rect: normalizedRect,
              dpr: scale
            }
          }
        }
      },
      ["capture_result"],
      60000
    );

    const feedback = {
      ...feedbackForCaptureResult(response, t),
      captureType: "screenshot_region",
      startedAtMs
    };
    await showFeedback(tab, feedback);
    return response;
  } catch (error) {
    const code = error.code || "screenshot_failed";
    const fallbackMessage = error.message || t("error.screenshotFailed");
    await showFeedback(tab, {
      tone: "failed",
      message: errorMessageForCode(code, t, fallbackMessage),
      captureType: "screenshot_region",
      startedAtMs
    });
    return {
      kind: "error",
      code,
      message: fallbackMessage
    };
  }
}

export async function captureVideoScreenshot({ tab, rect, dpr, srcUrl, pageUrl, pageTitle, sourceRoute, currentTime, videoWidth, videoHeight, sendNativeRequest }) {
  if (typeof tab?.windowId !== "number") {
    return { kind: "error", code: "screenshot_failed", message: "No active browser window" };
  }

  const normalizedRect = normalizeRect(rect);
  if (!normalizedRect || normalizedRect.w < 8 || normalizedRect.h < 8) {
    return { kind: "error", code: "video_frame_unavailable", message: "Video region is too small" };
  }

  const scale = typeof dpr === "number" && dpr > 0 ? dpr : 1;

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const cropped = await cropDataUrl(dataUrl, normalizedRect, scale);
    if (cropped.bytes.byteLength > MAX_CAPTURE_BYTES) {
      return { kind: "error", code: "payload_too_large", message: "Video screenshot is larger than 50 MB" };
    }

    const payloadRef = await payloadRefForBytes(cropped.bytes, "image/png", sendNativeRequest);
    return await sendNativeRequest(
      {
        kind: "capture",
        envelope: {
          type: "screenshot_region",
          payload_ref: payloadRef,
          metadata: {
            source_url: srcUrl || null,
            page_url: pageUrl || tab.url || "",
            page_title: pageTitle || tab.title || "",
            filename_hint: filenameHintForVideoScreenshot(pageUrl || tab.url, currentTime),
            captured_at: new Date().toISOString(),
            capture_kind: "video_screenshot",
            type_specific: {
              rect: normalizedRect,
              dpr: scale,
              source_route: sourceRoute || "fallback",
              media_current_time_seconds: Number.isFinite(currentTime) ? currentTime : null,
              video_width: videoWidth || null,
              video_height: videoHeight || null
            }
          }
        }
      },
      ["capture_result"],
      60000
    );
  } catch (error) {
    return {
      kind: "error",
      code: error.code || "screenshot_failed",
      message: error.message || "Could not capture video screenshot"
    };
  }
}

function filenameHintForVideoScreenshot(pageUrl, currentTime) {
  let domain = "video";
  try {
    domain = new URL(pageUrl).hostname.replace(/^www\./, "") || domain;
  } catch {
    // Keep fallback.
  }
  const seconds = Number.isFinite(currentTime) ? Math.floor(currentTime) : 0;
  return `${domain}-video-screenshot-${seconds}s.png`;
}

async function getDevicePixelRatio(tabId) {
  if (!tabId) {
    return null;
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.devicePixelRatio || 1
    });
    return typeof result?.result === "number" ? result.result : null;
  } catch {
    return null;
  }
}

async function cropDataUrl(dataUrl, rect, dpr) {
  const asset = parseDataUrl(dataUrl);
  const sourceBlob = new Blob([asset.bytes], { type: asset.contentType });
  const source = await createImageBitmap(sourceBlob);
  const sx = Math.max(0, Math.round(rect.x * dpr));
  const sy = Math.max(0, Math.round(rect.y * dpr));
  const sw = Math.max(1, Math.round(rect.w * dpr));
  const sh = Math.max(1, Math.round(rect.h * dpr));
  const width = Math.min(sw, source.width - sx);
  const height = Math.min(sh, source.height - sy);

  if (width <= 0 || height <= 0) {
    throw captureError("screenshot_failed", "Selected region is outside the captured viewport");
  }

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw captureError("screenshot_failed", "Could not create crop canvas");
  }
  context.drawImage(source, sx, sy, width, height, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    contentType: "image/png"
  };
}

function normalizeRect(rect) {
  if (!rect || typeof rect !== "object") {
    return null;
  }

  const x = Number(rect.x);
  const y = Number(rect.y);
  const w = Number(rect.w);
  const h = Number(rect.h);
  if (![x, y, w, h].every(Number.isFinite)) {
    return null;
  }

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    w: Math.max(0, w),
    h: Math.max(0, h)
  };
}
