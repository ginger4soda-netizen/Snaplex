# Wave 6 — HITL Implementation Plan (#3, #4)

本文档承接 [issues-execution-plan.md](issues-execution-plan.md) 的 Wave 5 HITL 第一阶段（discovery 文档），落实第二阶段实现。新智能体打开本文档即可直接执行。

## 0. 决策已确认（2026-05-07）

| Issue | 决策 |
|---|---|
| #3 小红书右键 | Route C（hover 按钮 + 区域截图 fallback）；默认开启；详情页优先 |
| #4 视频取帧 | Route C（直接取帧 + 区域截图 fallback）；YouTube 非 DRM 走直接取帧；X / Bilibili / TikTok 直接走区域截图；保留 DRM 红线 |

完整背景见 [docs/discovery/xhs-context-menu.md](discovery/xhs-context-menu.md)、[docs/discovery/video-frame-extract-matrix.md](discovery/video-frame-extract-matrix.md)。

## 1. 全局约定

- **分支**：`feat/wave-6-hitl-impl`，从 `feat/snake-ip-rebrand`（待 Wave 3/4/5 PR 合并后）切出
- **依赖**：Wave 5 (PR #20) 必须先合入，因为 discovery 文档与决策段在该分支内
- **PR 策略**：T12 与 T13 各开独立 PR（互不依赖）
- **测试基线**：`pnpm test` + 手动跑扩展（`extension/scripts/build.sh` 后用 `chrome://extensions` 加载 unpacked）
- **关键文件参考**：
  - 背景脚本：[extension/src/background/](../extension/src/background/)（`index.js` 注册菜单，`capture-image.js`、`capture-screenshot.js`、`capture-video-frame.js`）
  - 内容脚本：[extension/src/content/](../extension/src/content/)（`video-capture-injected.js` 现有 video drawImage 逻辑；`region-overlay/` 现有区域截图覆盖层）
  - 工具：[extension/src/util/drm-detect.js](../extension/src/util/drm-detect.js)
  - manifest：[extension/manifest.json](../extension/manifest.json)

## 2. 通用要求

- **不得绕过 DRM/EME/受保护内容**。检测到黑帧或受保护页面统一返回 `video_drm_protected` 错误码，UI 层显示 DRM 提示。
- **元数据语义保留**：每次发送到 Snaplex 的 payload 要明确 `capture_kind`（`original_image` / `screenshot_fallback` / `video_frame` / `video_screenshot`），便于桌面端区分与后续分析。
- **i18n**：扩展 popup 与 content script 用户可见文案中英文双版本。
- **错误反馈**：失败路径要有明确的中英文 toast/通知，不要静默失败。

---

## T12 · #3 小红书右键发送实现

### 依赖
- Wave 5 (PR #20) 已合入

### 关键文件
- [extension/manifest.json](../extension/manifest.json) — 加 content script 匹配 `*.xiaohongshu.com` 与 `*.xhscdn.com`
- 新建 `extension/src/content/xhs/` 目录，含：
  - `xhs-hover.js` — hover 探测 + 浮按钮注入
  - `xhs-hover.css` — 浮按钮样式（用 shadow DOM 隔离）
- [extension/src/background/capture-image.js](../extension/src/background/capture-image.js) — 接收 hover 按钮 message，调用既有原图抓取逻辑
- [extension/src/background/capture-screenshot.js](../extension/src/background/capture-screenshot.js) — fallback 路径
- [extension/src/background/index.js](../extension/src/background/index.js) — message router 增加 `xhs:capture` 处理

### 执行步骤

**Stage 1 · Manifest + 注入**
1. `manifest.json` 增加 `content_scripts` 条目，`matches: ["https://*.xiaohongshu.com/*", "https://*.xhscdn.com/*"]`，`js: ["content/xhs/xhs-hover.js"]`，`css: ["content/xhs/xhs-hover.css"]`，`run_at: document_idle`，`world: ISOLATED`。
2. host_permissions 同步加上述域名。

**Stage 2 · Hover 探测**
1. `xhs-hover.js` 内监听 `mousemove`（节流到 ~60ms）：
   - 用 `document.elementFromPoint(e.clientX, e.clientY)` 取命中元素
   - 沿 composedPath / 父链查找媒体候选，按优先级：
     - `<img>` 含 `currentSrc` 或 `src`
     - `<picture> > img`
     - 元素 `getComputedStyle().backgroundImage` 含 `url(...)`
     - 高分辨率 attr（如 `data-src`、`data-original`、`srcset`）
   - 记录 `xhsCandidateSource`：`'img' | 'background' | 'dom-attr' | 'region-fallback'`
2. 候选存在且有 bounding rect 时，注入悬浮按钮（attach 到 shadow root 容器，避免站点 CSS 影响）。按钮跟随鼠标位置，鼠标离开候选 → 隐藏。

**Stage 3 · 候选 → 后台**
1. 用户点击浮按钮 → `chrome.runtime.sendMessage({ type: 'xhs:capture', payload })`，payload 含：
   - `candidateSource`
   - `srcUrl`（如能解析）
   - `pageUrl`、`pageTitle`、`rect`（视口坐标）、`devicePixelRatio`
2. 背景脚本 `xhs:capture` 处理器：
   - `candidateSource !== 'region-fallback'` 且 `srcUrl` 可访问 → 走 `capture-image.js` 现有原图下载链路；payload 加 `capture_kind: 'original_image'`
   - 抓取失败（404 / CORS / 受保护）或 `candidateSource === 'region-fallback'` → 调用 `capture-screenshot.js` 的区域截图，使用客户端传上来的 rect；payload 加 `capture_kind: 'screenshot_fallback'`、原 `candidateSource` 透传

**Stage 4 · 用户反馈**
1. 浮按钮成功 → 短暂"已发送"icon 反馈
2. fallback 触发 → 通知文案"原图无法获取，已截图发送 / Original image unavailable, captured screenshot instead"
3. 全部失败 → "发送失败：<原因>"

### 验收标准
- [ ] 小红书图片详情页 hover 出现 Snaplex 浮按钮，点击后桌面端收到图片
- [ ] 详情页 ≥ 5 张不同图片：能取到原图 URL 的走原图路径（payload `capture_kind: 'original_image'`）
- [ ] 故意打开纯 CSS 背景图或 canvas 渲染的卡片：自动 fallback 到区域截图，桌面端收到图（payload `capture_kind: 'screenshot_fallback'`）
- [ ] 浮按钮 shadow DOM 隔离，不被站点深色模式/字体/层级污染
- [ ] 浮按钮**不影响**站点正常右键菜单和滚动
- [ ] 信息流卡片不强制启用（仅详情页路径），但若 hover 命中可显示按钮（不强制要求；可记录为 phase-2）
- [ ] 中英文 toast 文案到位
- [ ] 关闭 issue #3

---

## T13 · #4 视频取帧分流实现

### 依赖
- Wave 5 (PR #20) 已合入
- 与 T12 互不依赖，可并行

### 关键文件
- [extension/src/background/capture-video-frame.js](../extension/src/background/capture-video-frame.js) — 主入口，需要按站点分流
- [extension/src/content/video-capture-injected.js](../extension/src/content/video-capture-injected.js) — 直接取帧逻辑（保留 + 增强诊断）
- [extension/src/background/capture-screenshot.js](../extension/src/background/capture-screenshot.js) — 区域截图 fallback
- [extension/src/util/drm-detect.js](../extension/src/util/drm-detect.js) — DRM 检测扩展
- 新建 `extension/src/util/video-route.js` — 站点 → 路由策略

### 执行步骤

**Stage 1 · 站点路由策略**
1. 新建 `video-route.js`，导出 `pickVideoRoute(url: string): 'direct' | 'screenshot'`：
   - YouTube (`*.youtube.com`、`youtu.be`)：返回 `'direct'`
   - Twitter/X (`*.twitter.com`、`*.x.com`)：返回 `'screenshot'`
   - Bilibili (`*.bilibili.com`、`*.bilivideo.com`)：返回 `'screenshot'`
   - TikTok (`*.tiktok.com`)：返回 `'screenshot'`
   - 其他：默认 `'direct'`，失败时 fallback `'screenshot'`
2. 加单测覆盖每条规则。

**Stage 2 · 直接取帧路径增强**
1. `video-capture-injected.js` 改造：
   - 遍历 `document.querySelectorAll('video')` + 穿透 shadow DOM、可访问 iframe（同源）
   - 命中策略：(a) 优先 click-target/closest video，(b) 其次最大可见正在播放的 video，(c) 否则取 readyState ≥ 2 的最大 video
   - 取帧前诊断：`currentSrc`、`readyState`、`videoWidth`、`videoHeight`、`paused`
   - `drawImage` 后 try `toDataURL`，捕获 `SecurityError` / canvas taint
   - 黑帧检测：取 ImageData，若 99% 像素 RGB 总和 < 阈值 → 标记 `black_frame`
2. 失败结果统一返回结构：`{ ok: false, code: 'security_error' | 'black_frame' | 'no_video' | 'not_ready' | 'video_drm_protected', diag: {...} }`

**Stage 3 · DRM 检测扩展**
1. `drm-detect.js` 增加判定：
   - 页面含 `MediaKeys` 注册（通过页面世界 hook）
   - 已知 DRM 域名（Netflix、Disney+、HBO、爱奇艺会员、腾讯视频会员等可选清单）
2. 直接取帧返回 `black_frame` 且 DRM 检测命中 → 改报 `video_drm_protected`，**不**降级到截图

**Stage 4 · 主入口分流**
1. `capture-video-frame.js`：
   - 调 `pickVideoRoute(tab.url)` 决定主路径
   - `'screenshot'` 路径：直接走 Stage 5
   - `'direct'` 路径：注入并执行 video-capture-injected；
     - 成功 → 发送 payload `capture_kind: 'video_frame'`
     - 失败码 `video_drm_protected` → 终止，UI 显示 DRM 文案
     - 其他失败码 → 走 Stage 5 fallback

**Stage 5 · 截图裁剪 fallback**
1. 在 content script 内取目标 video 的 `getBoundingClientRect()` + DPR
2. 后台 `chrome.tabs.captureVisibleTab()` → 后台 OffscreenCanvas 裁剪到 video rect
3. payload 加 `capture_kind: 'video_screenshot'`、`source_route: 'fallback' | 'site_default'`、`current_time` 字段（若可拿）

**Stage 6 · UI 反馈**
1. 直接取帧成功："已发送视频帧 / Video frame captured"
2. 截图 fallback："已截取视频区域 / Video region captured"
3. DRM："此视频受 DRM 保护，无法捕获 / Video is DRM-protected"
4. 完全失败：明确错误码

### 验收标准
- [ ] YouTube 普通视频右键 Snaplex → 桌面端收到精确帧（`capture_kind: 'video_frame'`）
- [ ] Twitter/X / Bilibili / TikTok 视频 → 桌面端收到视频区域截图（`capture_kind: 'video_screenshot'`、`source_route: 'site_default'`）
- [ ] YouTube DRM/付费内容 → UI 显示 DRM 提示，桌面端不收到任何 payload
- [ ] YouTube 普通视频取帧偶发失败（如 SecurityError）→ 自动走截图 fallback，payload 标 `source_route: 'fallback'`
- [ ] `pickVideoRoute` 单测全绿
- [ ] 中英文 toast 与 DRM 文案到位
- [ ] 关闭 issue #4

---

## 3. 提交与回归清单

- [ ] T12 PR：`feat: xhs hover capture (#3)`
- [ ] T13 PR：`feat: video frame route + screenshot fallback (#4)`
- [ ] 两个 PR body 各含截图/录屏（hover 按钮、video 截图）与至少 3 个站点的实测记录
- [ ] 两个 PR 合并后回归：扩展原有图片右键、区域截图、YouTube 视频帧三条路径仍可用，无副作用

## 4. 给执行智能体的注意事项

- **不要修改 `feat/snake-ip-rebrand` 的非扩展代码**——本 wave 严格限定在 `extension/` 目录与必要的 i18n。
- **DRM 红线不可破**：哪怕能技术上绕过也不要做。
- **shadow DOM 隔离必须做**：浮按钮如果用普通 div + 高 z-index，会被站点 CSS 影响。
- **区域截图 rect 要乘以 DPR**：高分屏裁剪不正确是常见 bug。
- **不要扩大范围**：不顺手"重构"扩展现有结构、不改未涉及的 capture 路径。
