import {
  captureError,
  errorMessageForCode,
  feedbackForCaptureResult,
  MAX_CAPTURE_BYTES,
  parseDataUrl,
  payloadRefForBytes
} from "./capture-common.js";
import { captureVideoFrameInPage } from "../content/video-capture-injected.js";
import { classifyVideoFailure, isKnownDrmPage } from "../util/drm-detect.js";

export async function captureVideoFrameFromContextMenu({ info, tab, sendNativeRequest, showFeedback, getTranslator }) {
  const startedAtMs = performance.now();
  const t = await getTranslator();
  const knownDrmPage = isKnownDrmPage(tab?.url, info.pageUrl, info.srcUrl);

  try {
    if (!tab?.id) {
      throw captureError("video_frame_unavailable", "No active tab for video frame capture");
    }

    const frame = await captureVideoFrameInTab(tab.id, info, knownDrmPage);
    if (!frame.ok) {
      throw captureError(
        classifyVideoFailure(frame.code, { knownDrmPage }),
        frame.message || "Video frame capture failed"
      );
    }

    const asset = parseDataUrl(frame.dataUrl);
    if (asset.bytes.byteLength > MAX_CAPTURE_BYTES) {
      throw captureError("payload_too_large", "Video frame is larger than 50 MB");
    }

    const pageUrl = info.pageUrl || tab.url || "";
    const payloadRef = await payloadRefForBytes(asset.bytes, "image/png", sendNativeRequest);
    const response = await sendNativeRequest(
      {
        kind: "capture",
        envelope: {
          type: "video_frame",
          payload_ref: payloadRef,
          metadata: {
            source_url: info.srcUrl || null,
            page_url: pageUrl,
            page_title: tab.title || "",
            filename_hint: filenameHintForVideoFrame(pageUrl, frame.currentTime),
            captured_at: new Date().toISOString(),
            type_specific: {
              media_current_time_seconds: frame.currentTime,
              video_width: frame.videoWidth,
              video_height: frame.videoHeight
            }
          }
        }
      },
      ["capture_result"],
      60000
    );

    await showFeedback(tab, {
      ...feedbackForCaptureResult(response, t),
      captureType: "video_frame",
      startedAtMs
    });
    return response;
  } catch (error) {
    const code = error.code || "video_cors_tainted";
    const fallbackMessage = error.message || t("error.captureFailed");
    await showFeedback(tab, {
      tone: "failed",
      message: errorMessageForCode(code, t, fallbackMessage),
      captureType: "video_frame",
      startedAtMs
    });
    return {
      kind: "error",
      code,
      message: fallbackMessage
    };
  }
}

async function captureVideoFrameInTab(tabId, info, knownDrmPage) {
  const target = { tabId };
  if (Number.isInteger(info.frameId) && info.frameId >= 0) {
    target.frameIds = [info.frameId];
  }

  const [result] = await chrome.scripting.executeScript({
    target,
    world: "MAIN",
    args: [{
      srcUrl: info.srcUrl || null,
      pageUrl: info.pageUrl || null,
      knownDrmPage
    }],
    func: captureVideoFrameInPage
  });

  return result?.result || { ok: false, code: "video_capture_failed" };
}

function filenameHintForVideoFrame(pageUrl, currentTime) {
  let domain = "video";
  try {
    domain = new URL(pageUrl).hostname.replace(/^www\./, "") || domain;
  } catch {
    // Keep fallback.
  }

  const seconds = Number.isFinite(currentTime) ? Math.floor(currentTime) : 0;
  return `${domain}-video-frame-${seconds}s.png`;
}
