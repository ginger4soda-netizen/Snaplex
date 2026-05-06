export function captureVideoFrameInPage(targetInfo) {
  function absolute(value) {
    if (!value) {
      return "";
    }
    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return String(value);
    }
  }

  function videoUrls(video) {
    const urls = new Set();
    urls.add(absolute(video.currentSrc));
    urls.add(absolute(video.src));
    for (const source of Array.from(video.querySelectorAll("source"))) {
      urls.add(absolute(source.src));
    }
    urls.delete("");
    return urls;
  }

  function visibleArea(video) {
    const rect = video.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return width * height;
  }

  function findTargetVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) {
      return null;
    }

    const targetUrl = absolute(targetInfo?.srcUrl);
    if (targetUrl) {
      const exact = videos.find((video) => videoUrls(video).has(targetUrl));
      if (exact) {
        return exact;
      }
    }

    if (videos.length === 1) {
      return videos[0];
    }

    return videos
      .map((video) => {
        const area = visibleArea(video);
        const playing = !video.paused && !video.ended ? 1 : 0;
        const ready = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? 1 : 0;
        return { video, score: area + playing * 100000000 + ready * 1000000 };
      })
      .sort((left, right) => right.score - left.score)[0]?.video || null;
  }

  function isProbablyBlackFrame(context, width, height) {
    const sampleWidth = Math.min(width, 64);
    const sampleHeight = Math.min(height, 64);
    const data = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let nonBlack = 0;

    for (let index = 0; index < data.length; index += 4) {
      if (data[index] > 8 || data[index + 1] > 8 || data[index + 2] > 8) {
        nonBlack += 1;
      }
    }

    return nonBlack / (data.length / 4) < 0.01;
  }

  const video = findTargetVideo();
  if (!video) {
    return { ok: false, code: "video_not_found" };
  }

  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return { ok: false, code: "video_frame_unavailable" };
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { ok: false, code: "video_capture_failed" };
  }

  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (targetInfo?.knownDrmPage && isProbablyBlackFrame(context, canvas.width, canvas.height)) {
      return { ok: false, code: "video_drm_protected" };
    }

    return {
      ok: true,
      dataUrl: canvas.toDataURL("image/png"),
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : null,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight
    };
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "SecurityError" ? "video_security_error" : "video_capture_failed",
      message: error?.message || null
    };
  }
}

