import {
  captureError,
  errorMessageForCode,
  feedbackForCaptureResult,
  MAX_CAPTURE_BYTES,
  normalizeContentType,
  parseDataUrl,
  payloadRefForBytes
} from "./capture-common.js";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/jpeg",
  "image/jpg"
]);

export async function captureImageFromContextMenu({ info, tab, sendNativeRequest, showFeedback, getTranslator }) {
  return captureImageFromUrl({
    srcUrl: info?.srcUrl,
    tab,
    sendNativeRequest,
    showFeedback,
    getTranslator
  });
}

export async function captureImageFromUrl({ srcUrl, tab, sendNativeRequest, showFeedback, getTranslator, batch }) {
  const startedAtMs = performance.now();
  const t = await getTranslator();

  try {
    if (!srcUrl) {
      throw captureError("image_fetch_failed", "Missing image URL");
    }

    const asset = await loadImageAsset(srcUrl, tab);
    if (asset.bytes.byteLength > MAX_CAPTURE_BYTES) {
      throw captureError("payload_too_large", "Image is larger than 50 MB");
    }

    const payloadRef = await payloadRefForBytes(asset.bytes, asset.contentType, sendNativeRequest);
    const response = await sendNativeRequest(
      {
        kind: "capture",
        envelope: {
          type: "image",
          payload_ref: payloadRef,
          metadata: {
            source_url: srcUrl,
            page_url: tab?.url || "",
            page_title: tab?.title || "",
            filename_hint: filenameHintFromUrl(srcUrl),
            captured_at: new Date().toISOString(),
            type_specific: {
              original_image_url: srcUrl,
              entry: batch ? "batch" : "floating-ball",
              ...(batch ? { batch_id: batch.id, batch_index: batch.index, batch_total: batch.total } : {})
            }
          }
        }
      },
      ["capture_result"],
      60000
    );

    const feedback = {
      ...feedbackForCaptureResult(response, t),
      captureType: "image",
      startedAtMs
    };
    if (!batch) await showFeedback(tab, feedback);
    return response;
  } catch (error) {
    const code = error.code || "image_fetch_failed";
    const fallbackMessage = error.message || t("error.imageFetchFailed");
    if (!batch) {
      await showFeedback(tab, {
        tone: "failed",
        message: errorMessageForCode(code, t, fallbackMessage),
        captureType: "image",
        startedAtMs
      });
    }
    return {
      kind: "error",
      code,
      message: fallbackMessage
    };
  }
}

async function loadImageAsset(srcUrl, tab) {
  if (srcUrl.startsWith("data:")) {
    return parseDataUrl(srcUrl);
  }

  try {
    const response = await fetch(srcUrl, {
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Image request failed with HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = normalizeContentType(blob.type || response.headers.get("content-type") || inferContentType(srcUrl));
    const bytes = new Uint8Array(await blob.arrayBuffer());

    if (SUPPORTED_IMAGE_TYPES.has(contentType)) {
      return {
        bytes,
        contentType
      };
    }
  } catch {
    // Fall through to the DOM/canvas path below.
  }

  const canvasCapture = await captureImageViaCanvas(tab?.id, srcUrl);
  if (canvasCapture) {
    return canvasCapture;
  }

  throw captureError("image_fetch_failed", "Could not read image bytes");
}

async function captureImageViaCanvas(tabId, srcUrl) {
  if (!tabId) {
    return null;
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [srcUrl],
    func: (targetSrcUrl) => {
      function absolute(value) {
        try {
          return new URL(value, document.baseURI).href;
        } catch {
          return value;
        }
      }

      const target = absolute(targetSrcUrl);
      const image = Array.from(document.images).find((candidate) => {
        return absolute(candidate.currentSrc || candidate.src) === target || absolute(candidate.src) === target;
      });
      if (!image || !image.naturalWidth || !image.naturalHeight) {
        return { ok: false, code: "image_not_found" };
      }

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);

      try {
        return {
          ok: true,
          dataUrl: canvas.toDataURL("image/png")
        };
      } catch (error) {
        return {
          ok: false,
          code: error?.name === "SecurityError" ? "image_canvas_tainted" : "image_canvas_failed"
        };
      }
    }
  });

  if (!result?.result?.ok || !result.result.dataUrl) {
    return null;
  }

  return parseDataUrl(result.result.dataUrl);
}

function inferContentType(srcUrl) {
  try {
    const pathname = new URL(srcUrl).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".bmp")) return "image/bmp";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  } catch {
    return "application/octet-stream";
  }
  return "application/octet-stream";
}

function filenameHintFromUrl(srcUrl) {
  try {
    const url = new URL(srcUrl);
    const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return name || null;
  } catch {
    return null;
  }
}
