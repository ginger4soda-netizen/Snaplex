# Video Frame Extract Matrix

Issue: #4
Date: 2026-05-07
Status: Discovery only. No implementation in this phase.

## Scope and Evidence

This document is based on code audit plus browser platform constraints. I could not install the unpacked extension and live-test YouTube, Twitter/X, Bilibili, and TikTok from this environment, so the matrix marks expected behavior and the manual evidence still required.

Relevant code:
- `extension/src/background/capture-video-frame.js`: runs `captureVideoFrameInPage` in the page's main world, then sends a PNG data URL to native messaging.
- `extension/src/content/video-capture-injected.js`: finds a `<video>`, calls `drawImage(video, ...)`, then `canvas.toDataURL("image/png")`.
- `extension/src/background/capture-screenshot.js`: visible and region screenshot paths already exist and avoid reading video pixels through canvas.
- `extension/src/util/drm-detect.js`: maps known protected-page failures to a DRM-specific message.

Platform facts:
- Drawing cross-origin media into canvas without CORS approval taints the canvas; reading it back with `toDataURL()` or `getImageData()` then fails.
- A `<video>` without a `crossorigin` attribute is fetched in no-CORS mode, which prevents non-tainted canvas reuse for cross-origin resources.
- `chrome.tabs.captureVisibleTab()` captures the visible tab area and is a separate screenshot path from DOM canvas extraction.

Sources:
- Chrome `tabs.captureVisibleTab`: https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab
- MDN canvas tainting with cross-origin media: https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
- MDN `<video crossorigin>` behavior: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video

## Site Matrix

| Site | Expected media structure | Expected current result | Likely failure class | Manual evidence to collect |
|---|---|---|---|---|
| YouTube | `<video>` with MSE/blob pipeline inside first-party player | Likely works for non-DRM videos, fails/black frame for protected videos | MSE/EME/DRM for protected content; otherwise canvas readable | Console result from injected function; `video.currentSrc`; whether frame is black; DRM flags |
| Twitter/X | `<video>` with blob/MSE media, often cross-origin CDN pipeline | Likely fails or intermittent | Blob/MSE + CORS/canvas taint or frame selection in dynamic DOM | `video.currentSrc`; canvas exception name; frameId/iframe/shadow info |
| Bilibili | `<video>` with MSE/blob; may include custom player and CDN resources | Likely fails or intermittent | MSE/blob/CORS; possible iframe/player wrapper | canvas exception; direct video readiness; currentSrc/blob info |
| TikTok | `<video>` in highly dynamic app shell, likely cross-origin/blob | Likely fails or picks wrong video on feed pages | Multiple videos, dynamic virtualization, CORS/canvas taint | selected video rect/score; currentSrc; canvas exception |

## Technical Routes

### A. Improve direct video element frame extraction

Implementation:
- Improve video selection with clicked frame/element metadata.
- Include shadow DOM and iframe handling where Chrome gives a `frameId`.
- Add diagnostics for `currentSrc`, `readyState`, `videoWidth`, `videoHeight`, exception name, and black-frame detection.

Pros:
- Preserves exact video frame pixels and original media metadata when allowed.
- Keeps current UX.

Cons:
- Cannot bypass CORS tainting or DRM/EME.
- Site-specific player complexity remains.
- High maintenance for X/TikTok/Bilibili.

### B. Region screenshot crop for video frame

Implementation:
- On video context-menu action, get the visible bounding rect for the target video, call `captureVisibleTab`, and crop to the rect.
- If the context-menu target is unreliable, fall back to selecting the largest visible playing video.
- Metadata should include page URL, video rect, DPR, and `video.currentTime` when available.

Pros:
- Avoids canvas CORS restrictions because it captures screen pixels rather than reading media pixels.
- Reuses existing region screenshot infrastructure.
- Works across most non-protected visible videos.

Cons:
- Captures overlays/subtitles/controls if visible.
- Resolution limited to displayed viewport.
- Does not preserve direct media URL in many cases.

### C. Combined route: direct extraction first, screenshot fallback

Implementation:
- Attempt direct `drawImage` only for sites/videos that are known to work.
- On `SecurityError`, black frame, missing current data, or unsupported structure, crop the video rect from `captureVisibleTab`.
- Keep DRM red line: if the page is classified as protected or black-frame DRM-like, do not try to bypass; show DRM-specific failure.

Pros:
- Best success rate without violating DRM boundaries.
- Preserves exact frames where allowed.
- Falls back gracefully for X/Bilibili/TikTok.

Cons:
- More branches and diagnostics.
- Needs clear UI feedback when fallback captured a visible screenshot rather than a decoded frame.

## Recommendation

Choose option C, with a default bias toward screenshot fallback for Twitter/X, Bilibili, and TikTok after manual matrix validation. Keep direct extraction for YouTube non-DRM videos only if the manual test confirms it is reliable.

Red line:
- Do not attempt to bypass DRM, EME, protected content, or browser media restrictions.
- If the direct path returns black frame on a known DRM page, report `video_drm_protected` and stop.

## Manual Validation Checklist

- Install unpacked extension.
- Open one public non-DRM sample video per site.
- Right-click video and select Snaplex video-frame action.
- Capture console output from injected function with:
  - selected video count and rect
  - `currentSrc` / `src`
  - `readyState`, `videoWidth`, `videoHeight`
  - thrown exception name/message, if any
  - whether screenshot fallback would have a visible rect
- Repeat one protected/paid/DRM sample only to verify the extension refuses with DRM messaging.

