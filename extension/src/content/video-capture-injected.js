// Runs in the page (MAIN) world via chrome.scripting.executeScript.
//
// Two modes:
//   { mode: "frame" }  → find the target video, drawImage to canvas, return dataUrl
//   { mode: "inspect" } → find the target video, return rect + diagnostics only
//
// Both modes always return rect + dpr + diag so the background can fall back
// to a captureVisibleTab + crop without a second injection.

export function captureVideoFrameInPage(targetInfo) {
  const mode = targetInfo?.mode === "inspect" ? "inspect" : "frame";

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

  function collectVideos(root, out, depth) {
    if (!root || depth > 6) {
      return;
    }
    let nodes;
    try {
      nodes = root.querySelectorAll("*");
    } catch {
      return;
    }
    for (const node of nodes) {
      if (node.tagName === "VIDEO") {
        out.push(node);
      }
      if (node.shadowRoot) {
        collectVideos(node.shadowRoot, out, depth + 1);
      }
      if (node.tagName === "IFRAME") {
        try {
          const doc = node.contentDocument;
          if (doc) {
            collectVideos(doc, out, depth + 1);
          }
        } catch {
          // Cross-origin iframes are not accessible; skip silently.
        }
      }
    }
  }

  function findTargetVideo() {
    const videos = [];
    collectVideos(document, videos, 0);
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
    const sampleWidth = Math.min(width, 96);
    const sampleHeight = Math.min(height, 96);
    let data;
    try {
      data = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    } catch {
      return false;
    }
    let nonBlack = 0;
    const total = data.length / 4;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] + data[index + 1] + data[index + 2] > 24) {
        nonBlack += 1;
      }
    }
    return nonBlack / total < 0.01;
  }

  function detectVideoDrm(video) {
    try {
      if (video && video.mediaKeys) {
        return true;
      }
    } catch {
      // Some browsers throw when reading mediaKeys on detached videos.
    }
    try {
      const html = document.documentElement?.outerHTML || "";
      if (/com\.widevine\.alpha|com\.microsoft\.playready|com\.apple\.fps/i.test(html)) {
        return true;
      }
    } catch {
      // Ignore.
    }
    return false;
  }

  function roundRect(rect) {
    return {
      x: Math.max(0, Math.round(rect.left)),
      y: Math.max(0, Math.round(rect.top)),
      w: Math.max(0, Math.round(rect.width)),
      h: Math.max(0, Math.round(rect.height))
    };
  }

  const video = findTargetVideo();
  const dpr = window.devicePixelRatio || 1;

  if (!video) {
    return {
      ok: false,
      code: "no_video",
      rect: null,
      dpr,
      diag: { videoCount: 0 }
    };
  }

  const rect = roundRect(video.getBoundingClientRect());
  const hasMediaKeys = detectVideoDrm(video);
  const diag = {
    currentSrc: video.currentSrc || video.src || null,
    readyState: video.readyState,
    videoWidth: video.videoWidth || 0,
    videoHeight: video.videoHeight || 0,
    paused: !!video.paused,
    ended: !!video.ended,
    duration: Number.isFinite(video.duration) ? video.duration : null,
    hasMediaKeys
  };

  const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : null;

  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return {
      ok: false,
      code: hasMediaKeys ? "video_drm_protected" : "not_ready",
      rect,
      dpr,
      currentTime,
      diag
    };
  }

  if (mode === "inspect") {
    return {
      ok: true,
      mode: "inspect",
      rect,
      dpr,
      currentTime,
      diag
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {
      ok: false,
      code: "video_capture_failed",
      rect,
      dpr,
      currentTime,
      diag
    };
  }

  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "SecurityError" ? "security_error" : "video_capture_failed",
      rect,
      dpr,
      currentTime,
      diag,
      message: error?.message || null
    };
  }

  if (isProbablyBlackFrame(context, canvas.width, canvas.height)) {
    return {
      ok: false,
      code: hasMediaKeys || targetInfo?.knownDrmPage ? "video_drm_protected" : "black_frame",
      rect,
      dpr,
      currentTime,
      diag
    };
  }

  let dataUrl;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "SecurityError" ? "security_error" : "video_capture_failed",
      rect,
      dpr,
      currentTime,
      diag,
      message: error?.message || null
    };
  }

  return {
    ok: true,
    mode: "frame",
    dataUrl,
    rect,
    dpr,
    currentTime,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    diag
  };
}
