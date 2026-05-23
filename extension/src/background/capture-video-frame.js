import {
  captureError,
  errorMessageForCode,
  feedbackForCaptureResult,
  MAX_CAPTURE_BYTES,
  parseDataUrl,
  payloadRefForBytes
} from "./capture-common.js";
import { captureVideoFrameInPage } from "../content/video-capture-injected.js";
import { captureVideoScreenshot } from "./capture-screenshot.js";
import {
  classifyVideoFailure,
  isKnownDrmPage,
  shouldFallbackToScreenshot
} from "../util/drm-detect.js";
import { pickVideoRoute, VIDEO_ROUTE_SCREENSHOT } from "../util/video-route.js";

export async function captureVideoFrameFromContextMenu({ info, tab, sendNativeRequest, showFeedback, getTranslator }) {
  const startedAtMs = performance.now();
  const t = await getTranslator();
  const knownDrmPage = isKnownDrmPage(tab?.url, info.pageUrl, info.srcUrl);
  const route = pickVideoRoute(tab?.url || info.pageUrl || "");

  try {
    if (!tab?.id) {
      throw captureError("video_frame_unavailable", "No active tab for video frame capture");
    }

    if (route === VIDEO_ROUTE_SCREENSHOT) {
      const inspect = await runInjection(tab, info, knownDrmPage, "inspect");
      const drmFromInspect = drmCodeFromInspect(inspect, knownDrmPage);
      if (drmFromInspect) {
        throw captureError(drmFromInspect, "Video is DRM-protected");
      }
      if (!inspect?.rect) {
        throw captureError(
          inspect?.code || "video_frame_unavailable",
          inspect?.message || "Could not locate video on the page"
        );
      }
      const screenshotResponse = await captureVideoScreenshot({
        tab,
        rect: inspect.rect,
        dpr: inspect.dpr,
        srcUrl: info.srcUrl || null,
        pageUrl: info.pageUrl || tab.url || "",
        pageTitle: tab.title || "",
        sourceRoute: "site_default",
        currentTime: inspect.currentTime,
        videoWidth: inspect.diag?.videoWidth || null,
        videoHeight: inspect.diag?.videoHeight || null,
        sendNativeRequest
      });
      return await finishVideoCapture({
        tab,
        response: screenshotResponse,
        captureType: "video_screenshot",
        t,
        showFeedback,
        startedAtMs
      });
    }

    // Direct frame extraction path.
    const frame = await runInjection(tab, info, knownDrmPage, "frame");

    if (frame.ok) {
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
              capture_kind: "video_frame",
              type_specific: {
                media_current_time_seconds: frame.currentTime,
                video_width: frame.videoWidth,
                video_height: frame.videoHeight,
                source_route: "direct"
              }
            }
          }
        },
        ["capture_result"],
        60000
      );
      return await finishVideoCapture({
        tab,
        response,
        captureType: "video_frame",
        t,
        showFeedback,
        startedAtMs
      });
    }

    // Direct frame failed; classify and decide.
    const classified = classifyVideoFailure(frame.code, {
      knownDrmPage,
      hasMediaKeys: frame.diag?.hasMediaKeys || false
    });
    if (classified === "video_drm_protected") {
      throw captureError("video_drm_protected", "Video is DRM-protected");
    }

    if (
      shouldFallbackToScreenshot(frame.code, {
        knownDrmPage,
        hasMediaKeys: frame.diag?.hasMediaKeys || false
      }) &&
      frame.rect
    ) {
      const screenshotResponse = await captureVideoScreenshot({
        tab,
        rect: frame.rect,
        dpr: frame.dpr,
        srcUrl: info.srcUrl || null,
        pageUrl: info.pageUrl || tab.url || "",
        pageTitle: tab.title || "",
        sourceRoute: "fallback",
        currentTime: frame.currentTime,
        videoWidth: frame.diag?.videoWidth || null,
        videoHeight: frame.diag?.videoHeight || null,
        sendNativeRequest
      });
      return await finishVideoCapture({
        tab,
        response: screenshotResponse,
        captureType: "video_screenshot",
        t,
        showFeedback,
        startedAtMs
      });
    }

    throw captureError(classified, frame.message || "Video frame capture failed");
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

async function runInjection(tab, info, knownDrmPage, mode) {
  const target = { tabId: tab.id };
  if (Number.isInteger(info.frameId) && info.frameId >= 0) {
    target.frameIds = [info.frameId];
  }

  const [result] = await chrome.scripting.executeScript({
    target,
    world: "MAIN",
    args: [{
      srcUrl: info.srcUrl || null,
      pageUrl: info.pageUrl || null,
      knownDrmPage,
      mode
    }],
    func: captureVideoFrameInPage
  });

  return result?.result || { ok: false, code: "video_capture_failed" };
}

function drmCodeFromInspect(inspect, knownDrmPage) {
  if (!inspect) {
    return null;
  }
  if (inspect.code === "video_drm_protected") {
    return "video_drm_protected";
  }
  if (inspect.diag?.hasMediaKeys && knownDrmPage) {
    return "video_drm_protected";
  }
  return null;
}

async function finishVideoCapture({ tab, response, captureType, t, showFeedback, startedAtMs }) {
  if (response.kind === "error") {
    const code = response.code || "video_cors_tainted";
    const message = errorMessageForCode(code, t, response.message);
    await showFeedback(tab, {
      tone: "failed",
      message,
      captureType,
      startedAtMs
    });
    return {
      kind: "error",
      code,
      message: response.message || message
    };
  }

  const baseFeedback = feedbackForCaptureResult(response, t);
  const overrideMessage = successToastMessage(captureType, baseFeedback.tone, t);
  await showFeedback(tab, {
    ...baseFeedback,
    message: overrideMessage || baseFeedback.message,
    captureType,
    startedAtMs
  });
  return response;
}

function successToastMessage(captureType, tone, t) {
  if (tone !== "saved") {
    return null;
  }
  if (captureType === "video_frame") {
    return t("toast.videoFrameSaved");
  }
  if (captureType === "video_screenshot") {
    return t("toast.videoScreenshotSaved");
  }
  return null;
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
