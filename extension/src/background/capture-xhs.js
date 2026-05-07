import { errorMessageForCode, feedbackForCaptureResult } from "./capture-common.js";
import { captureXhsImage } from "./capture-image.js";
import { captureXhsRegionFallback } from "./capture-screenshot.js";

const FALLBACKABLE_IMAGE_CODES = new Set([
  "image_fetch_failed",
  "image_canvas_tainted",
  "image_canvas_failed",
  "image_not_found",
  "unsupported_content_type",
  "invalid_image_bytes"
]);

export async function handleXhsCapture({ payload, tab, sendNativeRequest, showFeedback, getTranslator }) {
  const startedAtMs = performance.now();
  const t = await getTranslator();
  const candidateSource = payload?.candidateSource || "img";
  const srcUrl = typeof payload?.srcUrl === "string" ? payload.srcUrl : null;
  const rect = payload?.rect || null;
  const dpr = typeof payload?.devicePixelRatio === "number" ? payload.devicePixelRatio : 1;
  const pageUrl = payload?.pageUrl || tab?.url || "";
  const pageTitle = payload?.pageTitle || tab?.title || "";

  let imageResponse = null;
  if (candidateSource !== "region-fallback" && srcUrl) {
    imageResponse = await captureXhsImage({
      srcUrl,
      pageUrl,
      pageTitle,
      candidateSource,
      rect,
      tab,
      sendNativeRequest
    });

    if (imageResponse.kind !== "error") {
      const feedback = {
        ...feedbackForCaptureResult(imageResponse, t),
        captureType: "image",
        startedAtMs
      };
      await showFeedback(tab, feedback);
      return {
        ok: true,
        fallback: false,
        captureKind: "original_image",
        response: imageResponse
      };
    }
  }

  const fallbackReason = imageResponse?.code || (candidateSource === "region-fallback" ? candidateSource : "no_src_url");
  const screenshotResponse = await captureXhsRegionFallback({
    tab,
    rect,
    dpr,
    candidateSource,
    srcUrl,
    pageUrl,
    pageTitle,
    fallbackReason,
    sendNativeRequest
  });

  if (screenshotResponse.kind === "error") {
    const code = screenshotResponse.code || "screenshot_failed";
    const message = errorMessageForCode(code, t, screenshotResponse.message);
    await showFeedback(tab, {
      tone: "failed",
      message,
      captureType: "image",
      startedAtMs
    });
    return {
      ok: false,
      code,
      message
    };
  }

  if (screenshotResponse.outcome === "saved" || screenshotResponse.outcome === "duplicate") {
    const baseTone = screenshotResponse.outcome === "saved" ? "saved" : "duplicate";
    await showFeedback(tab, {
      tone: baseTone,
      message: t("toast.xhsFallback"),
      captureType: "screenshot_fallback",
      startedAtMs
    });
    return {
      ok: true,
      fallback: true,
      captureKind: "screenshot_fallback",
      response: screenshotResponse
    };
  }

  const feedback = {
    ...feedbackForCaptureResult(screenshotResponse, t),
    captureType: "screenshot_fallback",
    startedAtMs
  };
  await showFeedback(tab, feedback);
  return {
    ok: feedback.tone !== "failed",
    fallback: true,
    captureKind: "screenshot_fallback",
    response: screenshotResponse
  };
}

export function getXhsLabels(t) {
  return {
    capture: t("xhs.button.capture"),
    sending: t("xhs.button.sending"),
    sent: t("xhs.button.sent"),
    fallback: t("xhs.button.fallback"),
    failed: t("xhs.button.failed")
  };
}
