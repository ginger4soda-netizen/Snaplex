# PRD — Snaplex 浏览器插件

**Status:** Proposed (v2)
**Owner:** TBD
**Last updated:** 2026-05-05
**Related:** `docs/implementation_plan.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/AGENT_SPEC.md`, `docs/impl-browser-extension.md`

## Problem Statement

Snaplex 已经具备本地图库、图片分析、色卡、CLIP 视觉索引、来源链接和桌面端三栏浏览能力，但用户在浏览网页、看视频、收集视觉参考时，仍然需要先下载图片或截图，再手动导入 Snaplex。这个流程打断灵感采集，尤其不适合设计师、摄影师、AI 创作者在网页上快速保存视觉素材。

第一版 PRD 曾考虑用 localhost HTTP + 配对码 + bearer token 的方案，但那条路把端口、配对、握手、token 生命周期等问题摆到了用户面前 —— 即便每一步都做对，用户体验仍然带配置感。本轮 PRD 改为**用 Chrome Native Messaging 把传输信任交给 OS**：用户安装 Snaplex Desktop 和浏览器插件后，二者直接互通，**没有端口、没有配对码、没有 token、没有任何用户可见的连接配置**。

用户明确本轮目标不是 Snaplex 应用内第三方插件系统，而是浏览器插件方向。第一版只实现浏览器插件；外部应用（Raycast / Alfred / Figma 等）集成、Eagle 导入留给独立 PRD 后置。

## Solution

第一版实现一个 Chrome / Chromium 系浏览器插件，用右键菜单和 popup 截图入口把网页上的视觉素材保存到本机 Snaplex Desktop。Snaplex Desktop 是唯一主控方：插件只负责采集用户主动选择的内容并提交，桌面端负责持久化、入库、去重、来源记录、缩略图、色卡、CLIP 索引和 UI 刷新。

**浏览器扩展与 Desktop 之间通过 Chrome Native Messaging 通信**：
- Snaplex Desktop 安装时由安装器在 OS 指定路径写入 Native Messaging Host Manifest，manifest 内声明允许哪些扩展 ID 接入。
- 扩展声明 `nativeMessaging` 权限，运行时由 Chrome 启动 Snaplex 自带的 bridge 二进制，通过 stdio 通信。
- bridge 把消息转发给运行中的 Snaplex Desktop（本地 socket / 命名管道），Desktop 未运行时由 bridge 唤醒。
- 不存在 localhost HTTP server、不存在端口、不存在 bearer token、不存在配对弹窗。

**库模型简化为单库**：Snaplex Desktop 同一时刻只有一个活动 .snpx 库；浏览器插件捕获永远入这个唯一库。schema 仍预留多库扩展面，但 v1 在产品层面不暴露多库切换。

第一版体验强调快速采集：

- 图片右键保存到 Snaplex。
- 页面右键或 popup 触发可视区截图。
- popup 触发区域截图，区域截图需要预览，可调整裁剪框后保存。
- 视频右键保存当前帧；无法直接截取时提示用户改用区域截图。
- 默认入库（在 All Images 主页可见），不挂任何文件夹，用户可事后归类。
- 保存成功后在网页内显示轻量 toast；toast 注入失败时降级为扩展 icon badge 短时变色。
- 保存后不自动触发 AI 分析，只完成本地入库、缩略图、色卡、CLIP 索引和来源记录。
- Snaplex Desktop 未运行时，bridge 自动唤醒 Desktop，无需用户手动启动。

## User Stories

1. As a Snaplex user browsing visual inspiration, I want to save an image from a webpage through the browser context menu, so that I do not need to download and import it manually.
2. As a designer collecting references, I want saved web images to appear in Snaplex Desktop automatically, so that my browser collection flow lands in my local library.
3. As a user saving images from many websites, I want Snaplex to remember the source page and image URL, so that I can return to the original context later.
4. As a user saving repeated images, I want Snaplex to detect duplicates by content hash, so that my library is not polluted by repeated files.
5. As a researcher saving the same image from multiple pages, I want Snaplex to append multiple source records to the existing image, so that duplicate saves still preserve useful provenance.
6. As a user who values speed, I want right-click save to land directly in my library without prompts, so that collection is not interrupted by modals.
7. As a user with no folders set up yet, I want captured assets to land in the library and be visible in All Images, so that saving always succeeds without folder configuration.
8. As a user taking web screenshots, I want to capture the current visible area from the popup, so that I can save page compositions that are not individual images.
9. As a user capturing part of a webpage, I want to select an area, preview it, adjust the crop, and then save, so that minor selection mistakes do not create bad assets.
10. As a user adjusting a region screenshot, I want drag handles and save/cancel controls, so that the crop interaction is predictable.
11. As a keyboard-oriented user, I want `Enter` to save and `Esc` to cancel during screenshot preview, so that I can finish the capture without extra pointer movement.
12. As a designer with muscle memory, I want a keyboard shortcut to start region screenshot, so that I can capture without opening the popup first.
13. As a user watching a video, I want to save the current video frame through the video context menu, so that video references can enter my Snaplex library.
14. As a user on a CORS-tainted video, I want a clear failure message and a suggestion to use area screenshot, so that I understand why frame capture failed.
15. As a user on a DRM-protected video, I want a different failure message that does not falsely suggest a workaround, so that I do not waste effort.
16. As a user, I want browser feedback after save, duplicate, source-appended, or failure, so that I know whether my action succeeded without switching to Snaplex.
17. As a user on a chrome:// or restricted page where toast cannot be injected, I want the extension icon badge to flash success or failure, so that I still get feedback.
18. As a first-time user who just installed Snaplex Desktop and the extension, I want them to recognize each other automatically, so that I do not have to copy tokens, scan codes, or configure ports.
19. As a user whose Snaplex Desktop is not currently running, I want capture to wake Desktop automatically, so that I do not have to find and launch the app first.
20. As a user, I want the popup to show whether Snaplex Desktop is reachable, so that I can diagnose why capture is unavailable.
21. As a developer, I want the capture envelope to be a unified shape across capture types, so that image, screenshot, video frame, and future captures share one contract.
22. As a developer, I want the browser plugin to send image bytes by default and URLs as metadata, so that resources behind cookies, signed URLs, or hotlink protection can still be captured.
23. As a developer, I want Desktop to own final file naming, sanitization, deduplication, and persistence, so that browser-side code stays thin.
24. As a user on Chrome, I want the first version to work reliably in developer-mode local loading, so that we can test before Chrome Web Store submission.
25. As an Edge, Arc, or Brave user, I want the plugin to be best-effort compatible, so that Chromium users are not blocked even if Chrome is the only officially tested browser.
26. As a user unfamiliar with context menus, I want the popup to mention that images and videos can be saved by right-clicking them, so that the main capture path is discoverable.
27. As a user whose Snaplex UI is in a particular language, I want the extension popup, toast, and context menu to follow the same language, so that the experience feels coherent.
28. As a user reporting a capture problem, I want Snaplex to keep recent capture logs locally so I can export and share them, so that debugging does not depend on memory.

## Implementation Decisions

### Product Scope

- First version targets the official Snaplex browser extension only.
- Official support is Chrome with Manifest V3.
- Edge, Arc, and Brave are best-effort because they are Chromium based.
- Firefox is out of scope for the first version.
- Eagle import is out of scope for this PRD.
- Snaplex application-internal third-party plugins are out of scope.
- External application integration (Raycast / Alfred / Figma plugins / Photoshop scripts) is out of scope for this PRD; if pursued later, it gets its own PRD with its own transport (likely HTTP/socket + pairing/token).
- Browser image batch collection is out of scope for the first version.
- Hover-logo image buttons are out of scope; right-click is the canonical path because it is reliable across DOM contexts and does not conflict with site UI.

### System Boundary

- Snaplex Desktop is the main controller.
- Browser extension is a thin capture and trigger layer.
- Browser extension does not call AI providers.
- Browser extension does not write `.snpx` libraries directly.
- Browser extension does not maintain an offline upload queue.
- Browser extension sends user-initiated capture payloads to Snaplex Desktop via Native Messaging.
- Desktop performs validation, file persistence, deduplication, source recording, thumbnailing, color extraction, CLIP indexing, and UI refresh notification.

### Browser ↔ Desktop Transport

- Transport is **Chrome Native Messaging** (stdio between Chrome and a Snaplex-shipped bridge binary).
- No HTTP server, no listening port, no bearer token, no user-visible pairing flow.
- Snaplex Desktop installer registers a Native Messaging Host Manifest at the OS-specific path:
  - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.snaplex.host.json`
  - Windows: registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.snaplex.host`
  - Linux: `~/.config/google-chrome/NativeMessagingHosts/com.snaplex.host.json`
  - Equivalent paths for Edge, Brave, Arc are written when those browsers are detected (best effort).
- Manifest declares:
  - `name`: `com.snaplex.host`
  - `path`: absolute path to the bridge binary shipped with Snaplex Desktop
  - `type`: `stdio`
  - `allowed_origins`: list of extension IDs (production Web Store ID + dev IDs as compiled-in)
- Bridge binary (`snaplex-bridge`) is a small process spawned by Chrome on demand:
  - Reads stdin / writes stdout using Chrome's length-prefixed JSON message format.
  - Forwards messages to running Snaplex Desktop via local Unix socket (macOS / Linux) or named pipe (Windows). Same-vendor processes; no auth layer between bridge and Desktop.
  - If Snaplex Desktop is not running, bridge launches it via platform-native means (`open -a Snaplex` on macOS, ShellExecute on Windows, desktop file on Linux) and waits for a ready signal before forwarding messages.
- Trust model:
  - Chrome enforces `allowed_origins` — only listed extension IDs can connect to the manifest.
  - The manifest path was written by the OS install of Snaplex Desktop, so the binary at `path` is Snaplex's own.
  - Forging an extension ID requires write access to the manifest file, which requires the user's own filesystem permissions; out of scope as a threat.
- Version compatibility:
  - Bridge sends a `hello` message on connect: `{ desktop_version, bridge_version, extension_version_min }`.
  - Extension responds with its own version. If incompatible, bridge returns a structured error and the extension's popup shows an upgrade prompt.
  - This is the only place where versions are explicitly negotiated; individual capture messages carry no version field.

### Capture Envelope

- All captures share one JSON envelope shape:
  ```
  {
    "type": "image" | "screenshot_visible" | "screenshot_region" | "video_frame",
    "payload_ref": { "kind": "inline" | "tempfile", "value": <base64 string | absolute file path>, "content_type": <mime> },
    "metadata": {
      "source_url": <string?>,
      "page_url": <string>,
      "page_title": <string?>,
      "filename_hint": <string?>,
      "captured_at": <ISO 8601 string>,
      "type_specific": { ... }
    }
  }
  ```
- Native Messaging single-message limit (~1 MB inbound to extension, ~64KB practical comfort) makes inlining large captures unsafe. Strategy:
  - Bridge accepts both `inline` (small) and `tempfile` (large) payload references.
  - Extension writes large bytes to a temp file via the bridge first (`write_tempfile` request returns a path), then sends the capture envelope referencing the path.
  - Desktop reads the tempfile, then deletes it.
  - Threshold for switching to tempfile: 256 KB (well below the safe NM message size).
- Type-specific metadata:
  - `screenshot_region`: `{ rect: { x, y, w, h }, dpr }`.
  - `video_frame`: `{ media_current_time_seconds }` when available.
  - `image`: `{ original_image_url }` (which may differ from `source_url` when image was loaded via redirect).

### Library Model

- Snaplex Desktop has exactly one active .snpx library at a time in v1.
- Browser extension capture always lands in the active library.
- Schema retains multi-library shape for future expansion but no v1 UI exposes it.
- If no library is open in Desktop (e.g. fresh install pre-onboarding), capture is rejected with an error code that the extension surfaces as a clear toast: "Open a Snaplex library to start capturing."
- Switching libraries is an explicit Desktop action; extension does not need to know about it.

### Browser Extension UX

- First version does not use image hover buttons.
- Image context menu includes `Save image to Snaplex`.
- Page context menu includes `Capture visible area to Snaplex`.
- Video context menu includes `Save current video frame to Snaplex`.
- Context menus are suppressed on chrome://, Web Store, and other restricted URL patterns where content scripts cannot run.
- Popup is lightweight: connection status, current library name, screenshot actions, right-click hint.
- Popup actions:
  - Capture visible area.
  - Select area.
- Popup text mentions that images and videos can be saved by right-clicking them.
- Popup does not show a folder tree, history list, AI analysis controls, tag inputs, memo inputs, or transport settings.
- A keyboard shortcut (default `Cmd/Ctrl+Shift+S`) launches region screenshot directly without opening the popup.
- Default feedback is an in-page toast injected by the extension.
- When toast injection fails (restricted pages, CSP issues), feedback degrades to an extension icon badge that flashes for ~1.5 seconds.
- System notifications are not requested or used by default.
- Save feedback states: saved, duplicate, source appended, capture failed, Desktop not reachable, no active library.

### Region Screenshot UX

- Region screenshot is not frame-and-save immediately.
- User starts region selection from the popup or via the keyboard shortcut.
- The page enters an overlay selection mode.
- After the initial drag, the user sees a preview/crop state.
- The crop rectangle can be moved.
- The crop rectangle can be resized with edge and corner handles.
- The user can save or cancel from controls near the crop area.
- `Enter` saves.
- `Esc` cancels.
- A reselect action may restart selection from the overlay.
- Region screenshots do not include annotation tools in v1.
- Text, arrows, blur, brush, color markup, and other screenshot editor features are out of scope.
- Tiny regions (smaller than 8×8 CSS px) are rejected with a validation hint.
- Crop coordinates must be scaled by `devicePixelRatio` when cutting from `chrome.tabs.captureVisibleTab` output (which returns at native pixel density).
- Switching tabs during overlay mode cancels the selection.

### Video Frame Capture

- Video frame capture is best effort.
- The extension first attempts direct frame capture from the video element via canvas.
- If canvas is CORS-tainted, the extension shows a failure toast suggesting area screenshot as a workaround.
- If the video is EME / DRM protected, the extension shows a different failure toast that does not suggest area screenshot (since the screen frame would also be black / blocked).
- The extension does not bypass DRM or platform protection.
- Platform-specific adapters for YouTube or other sites are out of scope.
- When available, video capture metadata includes media current time in seconds.

### Destination And Ingestion

- Captures land in the active library and are not assigned to any folder by default.
- They are visible in the All Images main view immediately.
- The user may move captured images to specific folders later through Desktop.
- First version does not open a save-before-organizing panel.
- First version does not sync or display the folder tree in the extension.
- Saving does not automatically trigger AI analysis.
- Ingestion still generates or schedules local thumbnailing, color palette extraction, and CLIP visual indexing according to existing Desktop behavior.

### Deduplication And Sources

- Desktop deduplicates by SHA256 content hash in v1.
- Perceptual hashing is deferred to a later milestone.
- Duplicate content does not copy a new file.
- Duplicate capture returns the existing image id.
- Duplicate capture appends a source record rather than overwriting the original source.
- The data model supports multiple source records per image via a new `image_sources` table; the legacy `images.source_url` column is retained read-only for backward compatibility and is populated only on first capture.
- Source records include: capture type, source URL, page URL, page title, source domain, captured time, client identifier ("browser-extension"), and capture-type-specific metadata.
- SHA256 dedup applies primarily to `image` captures. Screenshot and video frame captures will rarely match because every render produces unique bytes; PRD acknowledges this as a known limitation rather than expanding to perceptual hashing.
- Re-encoded copies of the same visual (different bytes, same image content) are treated as new images in v1.

### Metadata And File Naming

- Single-image captures send the original image URL, current page URL, page title, and a filename hint when available.
- Visible screenshots use a Desktop-generated name based on source domain, capture type, and timestamp.
- Region screenshots use a Desktop-generated name based on source domain, capture type, timestamp, and selected rectangle.
- Video frames use a Desktop-generated name based on source domain, capture type, timestamp, and media current time.
- Desktop sanitizes filenames, handles collisions, and decides final extension based on content type.
- Region screenshots include the selected rectangle and `devicePixelRatio` in metadata.
- Video frames include current time metadata when available.

### Permissions

- First version uses Manifest V3.
- Required extension permissions:
  - `contextMenus`
  - `storage`
  - `activeTab`
  - `scripting`
  - `tabs`
  - `nativeMessaging`
  - `commands` (for keyboard shortcut)
- Required host permissions: `<all_urls>` (the core job is user-initiated capture from arbitrary webpages).
- The extension does not request notification permission in v1.
- Privacy messaging states that content is captured only after explicit user action and is sent to local Snaplex Desktop on the same machine — never to Snaplex cloud infrastructure.

### Performance Budget

- Time from user action (right-click confirm or `Enter` on crop) to "saved" toast: target < 500 ms.
- Thumbnailing, color palette extraction, and CLIP visual indexing are scheduled asynchronously and do not block the toast.
- Bridge spawn overhead is amortized: once Chrome connects to the bridge, the connection is held open for the session.
- If Desktop must be auto-launched, "saved" toast may take 2-5 seconds; popup shows a "Starting Snaplex…" state during this window.

### Localization

- Extension UI strings (popup, toast, context menus, error messages) are localized.
- Locale source: bridge's `hello` message includes Desktop's current UI locale; extension uses that locale for all user-facing text. This keeps the extension and Desktop visually consistent regardless of browser locale.
- Initial languages: Chinese (Simplified) and English. Additional languages follow Desktop's i18n cadence.

### Logging

- Desktop maintains a ring-buffer of recent captures (last 200 events) including: capture type, source domain, result (saved / duplicate / failed), timestamp, and error code if any.
- Bridge writes a separate diagnostic log file (`~/.snaplex/logs/bridge.log`) capturing connect / disconnect / message-error events. Rotated at 1 MB.
- Settings provides a "Export capture diagnostics" action that bundles both logs into a zip for users to share when reporting issues.

### Release Strategy

- First version ships as developer-mode local loading from the repository.
- A development helper script writes a Native Messaging manifest with the dev extension ID into the OS-specific path so the dev build can connect to Desktop.
- Chrome Web Store release is a later milestone after behavior, permissions copy, privacy policy, screenshots, and a fixed published extension ID are ready.
- The Web Store extension ID is added to the manifest's `allowed_origins` at Snaplex Desktop install time so production extension and production Desktop pair without any configuration.

## Testing Decisions

### What Makes A Good Test

- Tests verify externally visible behavior, not implementation details.
- Desktop tests call ingestion service interfaces and assert persistence, deduplication, source records, and library state.
- Browser extension tests exercise user flows through context menu handlers, popup actions, overlay interactions, keyboard shortcuts, and mocked Chrome APIs.
- Native Messaging boundary is mocked via a fake bridge that conforms to the message contract.
- Domain modules such as ingestion and deduplication run against real in-memory SQLite where practical (rusqlite supports `:memory:`).
- Tests avoid asserting exact internal filenames except for stable invariants (extension, sanitized components, uniqueness).

### Modules To Test

- Native Messaging bridge:
  - `hello` handshake including version negotiation.
  - Forwarding capture envelopes to Desktop.
  - Auto-launching Desktop when not running and waiting for ready signal.
  - Tempfile path negotiation for large payloads.
- Capture ingestion service:
  - Valid image payload saves into the active library.
  - SHA256 duplicate returns existing image id.
  - Duplicate source appends a new source record.
  - Invalid base64 and unsupported content types fail cleanly.
  - Capture-type-specific metadata roundtrip.
  - No active library returns the documented error.
- Source record storage:
  - Multiple source records per image.
  - `images.source_url` legacy column populated on first capture, untouched on subsequent.
- Browser extension popup:
  - Connected, Desktop-not-running, no-active-library states.
  - Screenshot actions trigger the right capture flow.
  - Popup never shows transport settings.
  - Right-click usage hint visible.
- Browser extension context menus:
  - Image context menu sends an image envelope.
  - Page context menu sends a visible screenshot envelope.
  - Video context menu attempts video frame capture and degrades correctly.
  - Restricted pages do not show context menu items.
- Region screenshot overlay:
  - Initial selection creates a crop rectangle.
  - Crop rectangle can be moved and resized.
  - `Enter` saves; `Esc` cancels.
  - Tab switch cancels selection.
  - Tiny regions are rejected.
  - Crop math respects `devicePixelRatio`.
- Video frame capture:
  - Direct capture succeeds for accessible videos.
  - CORS-tainted canvas fails with the area-screenshot suggestion.
  - DRM-protected video fails without the area-screenshot suggestion.
- Toast / badge fallback:
  - Toast renders on permitted pages.
  - Badge flashes on chrome:// / restricted pages.

### Prior Art

- Existing frontend tests mock Tauri IPC at the boundary and test UI behavior through rendered components.
- Existing Rust-side search and database work uses narrow service boundaries with real SQLite where possible.
- Browser extension tests follow the same pattern: behavior tests at public surfaces, real SQLite for schema-sensitive logic, mocks for Chrome APIs and the Native Messaging boundary.

## Out Of Scope

- Snaplex application-internal plugin runtime.
- Third-party plugin marketplace.
- Public stable third-party developer API.
- External application integration (Raycast / Alfred / Figma / Photoshop) — separate future PRD.
- localhost HTTP server / port 21931 / bearer token / pairing flow — replaced by Native Messaging.
- Multi-library UX in browser extension — Desktop limits itself to one active library in v1.
- Eagle `.library` import.
- Browser page image batch collection.
- Hover logo button on images.
- CSS background-image / inline SVG / canvas-rendered image right-click direct save (user can use region screenshot instead).
- Alt-right-click quick save.
- Save-before-organizing modal.
- Full folder tree selection inside the extension.
- Offline browser-side upload queue.
- Automatic AI analysis after capture.
- Webpage article body extraction.
- PDF parsing and PDF annotation.
- YouTube transcript capture, timestamped notes, AI summaries.
- Text highlight saving.
- Cross-browser Firefox support.
- Safari Web Extension support.
- Chrome Web Store publication.
- Screenshot annotations (arrows, text, blur, brush, markup).
- DRM bypass or platform-specific video capture adapters.
- Per-client fine-grained permissions.
- Perceptual hash deduplication.
- Reverse browser linkage (highlighting already-saved images on source pages).

## Further Notes

- Eagle is a useful interaction reference for fast image collection, but Snaplex deliberately does not copy Eagle's localhost-trust model. Native Messaging gives a stronger guarantee with simpler UX.
- YouMind is a useful reference for broader research material capture, but Snaplex v1 stays visual-first. Webpages, PDFs, highlights, transcripts, summaries, and cross-material Q&A belong in later PRDs if Snaplex expands beyond visual inspiration management.
- Future external application integration (Raycast / Alfred / Figma plugins) cannot use Native Messaging because they are not browsers. When that need materializes, a separate PRD will define a transport (likely local socket or HTTP with pairing/token) — kept entirely separate from this PRD so the browser path stays clean.
- No issue tracker configuration or triage label vocabulary is available in this workspace. This PRD is therefore written as a repository document.
