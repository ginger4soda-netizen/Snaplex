# 交接文档 — Snaplex 浏览器插件 v1（打包前）

**Status:** Ready for pre-release fixes
**Last updated:** 2026-05-05
**Source PRD:** [`docs/prd-browser-extension.md`](./prd-browser-extension.md)
**Implementation plan:** [`docs/impl-browser-extension.md`](./impl-browser-extension.md)
**Pre-flight audit summary:** below

下一会话的入口：先读这份文件，然后从 §6 的待办按顺序执行。

---

## 1. 项目当前状态（Snapshot）

### 1.1 已完成

| 范围 | 内容 |
|---|---|
| 工程结构 | Cargo workspace 拆 `app` + `bridge` 两个 crate；`extension/` 独立目录；`scripts/` 含 dev manifest 安装脚本 |
| 后端 | Migration 框架 + `image_sources` 表 + `images.content_sha256` 列；`services::ingest` 走 SHA256 去重 + source append；本机 socket transport（macOS / Linux）；Native Messaging manifest 自动安装；capture 200 条环形日志 + 诊断 zip 导出 |
| Bridge | stdio Native Messaging host；自动连本机 socket，连不上时调 `open -a Snaplex` + 5s 重试 |
| 扩展 | MV3 manifest，nativeMessaging + commands 权限；popup 显示连接状态 + 库名；右键菜单（图片 / 页面 / 视频）；`Cmd+Shift+S` 区域截图快捷键；in-page toast + 失败降级 badge |
| 测试 | `cargo test --workspace` 64/64 通过；前端 vitest 8 文件 / 54 测试通过；扩展构建产物完整 |

### 1.2 已通过的人工冒烟测试

用户在浏览器里手动验证过下面 3 条核心路径，**全部成功**：
- 右键图片 → Save image to Snaplex → 出现在 Desktop 图库
- 右键视频 → Save current video frame → 出现在 Desktop 图库
- popup / 快捷键 → 区域截图 / 可视区截图 → 出现在 Desktop 图库

去重路径（重复保存同图）也工作正常。

### 1.3 已知的"踩到了"案例（本次会话排查清楚的）

**用户描述的现象**：smoke test 一开始正常；关闭 Desktop 重启后，扩展再保存就一直显示"Snaplex Desktop is not reachable"，popup 仍然显示 connected，没有重连交互。

**根因**：用户机器上**同时存在两个 Snaplex**：
- `/Applications/Snaplex.app`（旧版本，**没有 local_socket transport 的代码**）
- `pnpm tauri:dev` 跑出来的 dev 实例（带新代码）

第一次冒烟 dev 实例在跑，正常。用户关掉 dev 实例后，bridge 失去连接，下次请求时进入"自动唤醒 Desktop"路径，调用 `open -a Snaplex` —— **正好把旧的 `/Applications/Snaplex.app` 拉了起来**。旧 Snaplex.app 不监听 socket，于是 bridge 持续 `Connection refused`。

**确认证据**：
- `~/.snaplex/logs/bridge.log` 里满屏 `Connection refused (os error 61)`
- `ps aux | grep snaplex` 显示运行的是 `/Applications/Snaplex.app/Contents/MacOS/snaplex`，没有 dev 进程
- socket 文件存在但孤儿（`nc -U` refused）

**结论**：这不是代码 bug，是开发环境二义性。**装上带新代码的 production 包后会自然解决**。但 bridge 自动唤醒到错误进程是真实的弱点，见 §3 P2。

---

## 2. 关键文件地图（新会话可以直接 grep）

### 后端（`snaplex/src-tauri/`）
- Workspace: [`Cargo.toml`](../src-tauri/Cargo.toml)
- App lib 入口（启动 transport + manifest installer）：[`app/src/lib.rs`](../src-tauri/app/src/lib.rs)
- Migrations：[`app/src/db/migrations.rs`](../src-tauri/app/src/db/migrations.rs)
- ImageSource CRUD：[`app/src/db/image_sources.rs`](../src-tauri/app/src/db/image_sources.rs)
- Ingest 服务（去重 + 入库）：[`app/src/services/ingest.rs`](../src-tauri/app/src/services/ingest.rs)
- 本机 socket 监听：[`app/src/transport/local_socket.rs`](../src-tauri/app/src/transport/local_socket.rs)
- 消息路由：[`app/src/transport/handlers.rs`](../src-tauri/app/src/transport/handlers.rs)
- NM manifest 安装器：[`app/src/transport/manifest.rs`](../src-tauri/app/src/transport/manifest.rs)
- Capture 日志 + zip 导出：[`app/src/services/capture_log.rs`](../src-tauri/app/src/services/capture_log.rs) + [`app/src/commands/fs_commands.rs`](../src-tauri/app/src/commands/fs_commands.rs)（搜 `export_capture_diagnostics`）

### Bridge（`snaplex/src-tauri/bridge/`）
- 入口：[`bridge/src/main.rs`](../src-tauri/bridge/src/main.rs)
- NM 编解码：[`bridge/src/native_messaging.rs`](../src-tauri/bridge/src/native_messaging.rs)
- 与 Desktop socket 客户端：[`bridge/src/socket_client.rs`](../src-tauri/bridge/src/socket_client.rs)
- 唤醒 Desktop：[`bridge/src/launch_desktop.rs`](../src-tauri/bridge/src/launch_desktop.rs)
- 日志（`~/.snaplex/logs/bridge.log` ring）：[`bridge/src/logging.rs`](../src-tauri/bridge/src/logging.rs)

### 扩展（`extension/`）
- Manifest：[`extension/manifest.json`](../extension/manifest.json)
- Service worker 入口（连接管理 + context menu + commands）：[`extension/src/background/index.js`](../extension/src/background/index.js)
- Capture 模块：`extension/src/background/capture-{image,screenshot,video-frame}.js` + `capture-common.js`
- 反馈（toast + badge 兜底）：[`extension/src/background/feedback.js`](../extension/src/background/feedback.js)
- 区域截图 overlay：[`extension/src/content/region-overlay/index.js`](../extension/src/content/region-overlay/index.js)
- Popup：[`extension/popup.html`](../extension/popup.html) + [`extension/src/popup/index.js`](../extension/src/popup/index.js)
- i18n：[`extension/src/i18n/`](../extension/src/i18n/)
- 构建脚本（拷贝 src → dist）：[`extension/scripts/build.mjs`](../extension/scripts/build.mjs)

### 安装/运维脚本
- Dev manifest 注入（macOS/Linux）：[`scripts/install-dev-manifest.sh`](../scripts/install-dev-manifest.sh)
- Dev manifest 注入（Windows）：[`scripts/install-dev-manifest.ps1`](../scripts/install-dev-manifest.ps1)
- 卸载脚本：`scripts/uninstall-dev-manifest.{sh,ps1}`

### Chrome 端运行时位置
- 安装的 NM manifest（macOS Chrome）：`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.snaplex.host.json`
- 当前 dev 扩展 ID（用户机器上）：`plilihkbpoonppdlpclokjpoebdjifeb`
- 本机 socket 路径（macOS）：`$TMPDIR/snaplex-<uid>.sock`，例如 `/var/folders/.../T/snaplex-502.sock`
- bridge 诊断日志：`~/.snaplex/logs/bridge.log`

---

## 3. 打包前必须修的问题（按优先级）

### 🔴 P1 — Production extension ID 是占位符（必须改，否则发布版无法连接）

**位置**：[`app/src/transport/manifest.rs:10-11`](../src-tauri/app/src/transport/manifest.rs#L10)

```rust
const PRODUCTION_EXTENSION_ID: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DEV_EXTENSION_IDS: &[&str] = &[];
```

**两件事要做**：
1. Web Store 上架（或预发布）后拿到真实 production 扩展 ID，替换占位符。
2. **dev 模式下 Desktop 不要覆盖 dev manifest**：Desktop 启动时无条件写一份带占位 ID 的 manifest，会盖掉 `scripts/install-dev-manifest.sh` 注入的 dev manifest。建议在 [`app/src/lib.rs`](../src-tauri/app/src/lib.rs) 的 setup 里：
   ```rust
   if !cfg!(debug_assertions) {
       transport::manifest::install_native_messaging_manifests(...);
   }
   ```
   release 才安装；dev 完全靠 `scripts/install-dev-manifest.sh`。

### 🔴 P2 — Bridge 自动唤醒可能拉错进程

**位置**：[`bridge/src/launch_desktop.rs`](../src-tauri/bridge/src/launch_desktop.rs)

**问题**：bridge 用 `open -a Snaplex`，会拉起 `/Applications/Snaplex.app`。如果用户：
- 在开发期同时装了旧版 Snaplex.app，会拉错进程（本次会话踩到的坑）
- 装了新版但 socket transport 启动失败，会无限重试错误进程

**短期修法（强烈建议进发布版）**：
- bridge 在唤醒前用 instance handshake 校验：连上 socket 后先发一个 `ping`，如果 Desktop 回应包含合法的 `desktop_version` 和 `instance_id`，再继续；否则拒绝、提示用户。
- 至少在 bridge 日志里打印明确的"已找到/未找到 Snaplex"行，便于排错。

**长期修法**：
- production Snaplex 安装时把可执行路径写到一个 well-known 文件（如 `~/.snaplex/runtime.json`），bridge 优先 spawn 这个路径而不是 `open -a`。

### 🔴 P3 — Locale 没真正接到 Desktop

**位置**：[`app/src/transport/handlers.rs:40`](../src-tauri/app/src/transport/handlers.rs#L40)

```rust
fn handle_hello_ack(app: &AppHandle) -> Value {
    // ...
    json!({
        "kind": "ready",
        "locale": "en",   // ← 硬编码
        "library_name": library_name
    })
}
```

**修法**：从 Desktop 的设置/i18n 状态里读真实 locale。如果 Snaplex Desktop 还没把 locale 暴露给 Rust 侧，先添加一个 `commands::settings::get_current_locale()`，或读 `tauri.conf.json` 里的语言配置作为缺省。扩展端会用浏览器 locale 兜底，但用户体验会不一致。

---

## 4. 强烈建议在 v1 内补的（不阻塞打包）

### 🟡 S1 — 状态机 bug：error 响应到达 pending request 时 popup 状态没被更新

**位置**：[`extension/src/background/index.js:138-176`](../extension/src/background/index.js#L138)

**问题**：当 bridge 返回 `{kind: "error", code: ...}` 作为某个 capture 的回复时，`handleNativeMessage` 走的是"resolve pending → return"的早退路径，**跳过了下面 `if (message.kind === "error") setConnectionState(...)` 的状态更新分支**。结果 popup 一直显示 "connected"，但实际 capture 失败。

**修法**：把 `setConnectionState` 也调用一次（或者：error 响应总是走状态更新路径），并把 popup 的"已连接"状态改为更细的"ready / capture_failed / desktop_unreachable"等。

### 🟡 S2 — 没有手动重连的 UX

popup 现在没有"重试连接"按钮。当 connection 卡住时，用户除了关 Chrome / 重载扩展没别的办法。建议：
- popup 加 "Reconnect" 按钮，调用 `chrome.runtime.sendMessage('snaplex:force-reconnect')`。
- background 端实现 force-reconnect：disconnect 当前 nativePort、立刻 connectNative 重建。

### 🟡 S3 — Desktop UI 还没消费多 source 记录

后端已经在 `image_sources` 表里存了多来源记录，但 Desktop 的图片详情面板还显示老的单 `source_url`。需要：
- 加一个 Tauri command `get_image_sources(image_id) -> Vec<ImageSource>`
- 前端在图片详情视图渲染来源列表

### 🟡 S4 — Desktop Settings 加"导出诊断包"按钮

后端命令 `export_capture_diagnostics` 已就绪（[`app/src/commands/fs_commands.rs#L98`](../src-tauri/app/src/commands/fs_commands.rs#L98)），前端还没接。在 Settings 加按钮 → 弹 save dialog → 调命令。

### 🟡 S5 — Windows 命名管道 transport stub

[`bridge/src/socket_client.rs:48-75`](../src-tauri/bridge/src/socket_client.rs#L48) 与 [`app/src/transport/local_socket.rs:43-47`](../src-tauri/app/src/transport/local_socket.rs#L43) 的 Windows arm 都是空实现。**如果 v1 不打 Windows，删掉 manifest 安装器里的 Windows 注册表写入**（避免在 Windows 上写出有路径但没监听的"死 manifest"）。如果要打 Windows，用 `interprocess` 或 `tokio::net::windows::named_pipe` 实现。

---

## 5. v2 候选（已声明 OOS，仅记录）

- 感知哈希去重（重新编码的同一图视为同图）
- 区域截图标注工具（箭头、文字、马赛克）
- 网页正文 / PDF / 高亮 / 视频字幕等"非视觉"采集
- 外部应用集成（Raycast / Alfred / Figma 插件）—— 单独 PRD，走 HTTP/socket + 配对
- Firefox / Safari 支持

---

## 6. 推荐的下一会话行动顺序

按下面的次序做，每一步独立可验收。

### Step 1：修 P1 + P2 + P3

```
1. 改 app/src/lib.rs：dev 模式 (cfg!(debug_assertions)) 不调 install_native_messaging_manifests
2. 改 app/src/transport/handlers.rs::handle_hello_ack：读真实 locale（先用一个 commands::settings 暴露给 Rust）
3. 改 bridge：
   a. socket_client::connect 成功后，发一个 ping/handshake 确认对面是新版 Snaplex
   b. 不通过则拒绝并写明确日志，不再无限 retry
4. cargo test --workspace 全绿
```

验收：
- `pnpm tauri:dev` 启动 dev Desktop 后，dev manifest 不被覆盖（脚本注入一次后持续生效）
- bridge.log 第一条 hello 后出现 instance ack
- 故意启动一个不带 socket 的 fake "Snaplex" 测试，bridge 能识别并拒绝（不是无限 refused）

### Step 2：修 S1（状态机 bug）

```
1. 改 extension/src/background/index.js::handleNativeMessage：error 响应也走 setConnectionState
2. 改 extension/src/popup/index.js：根据细粒度状态显示不同文案（"capture failed"、"desktop unreachable"、"ready"）
```

验收：
- 杀 Desktop 后再做 capture，popup 应在 1-2 秒内变红，不再卡 connected

### Step 3：补 S2（手动重连）

```
1. extension popup 加 "Reconnect" 按钮（仅在 status !== ready 时显示）
2. background 加 snaplex:force-reconnect 处理：nativePort?.disconnect() + connectNative
```

验收：
- Desktop 重启后点 Reconnect，2-3 秒 popup 变 ready

### Step 4：S3 + S4（前端补完）

S3 和 S4 是纯 Desktop UI 工作，可以并行，没有外部依赖。

### Step 5：打包前最终回归

```
1. 全量 cargo test + vitest
2. 卸载 /Applications/Snaplex.app（旧版！）
3. tauri build 出 .dmg / .pkg
4. 干净的 macOS 用户目录 + 干净的 Chrome profile 再走一遍 §1.2 的冒烟（无需任何 dev 脚本）
5. 可选：Linux + Windows 同样冒烟（Windows 取决于 S5 是否做）
```

### Step 6（v1 之外）：Web Store 上架准备

- 隐私政策页（强调"内容只到本机 Snaplex Desktop，不到云"）
- Web Store 截图（popup、右键菜单、toast、区域截图）
- 拿到 production extension ID 后，回头修 P1（替换占位符）

---

## 7. 一些"再次踩坑"的快速排查表

| 现象 | 第一时间检查 |
|---|---|
| Popup 显示 connected 但 capture 失败 | `tail -50 ~/.snaplex/logs/bridge.log`；`ps aux \| grep snaplex` 看是 dev 实例还是 `/Applications/Snaplex.app`；`nc -U $TMPDIR/snaplex-$(id -u).sock` 测 socket |
| Popup 显示"Snaplex 未启动"但实际有进程 | `cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.snaplex.host.json`，确认 `path` 指向当前可执行 bridge，`allowed_origins` 包含真实 dev 扩展 ID |
| 重启 Desktop 后扩展失联 | 看 §1.3：是不是被 `open -a Snaplex` 拉起了旧版 `/Applications/Snaplex.app`。`pkill -f "Snaplex.app/Contents/MacOS/snaplex"`，然后 `pnpm tauri:dev` 重启 |
| capture 成功但 All Images 没出现 | Desktop 那边的活动库可能没打开；handlers.rs::save_capture 会返回 `no_active_library` |
| 区域截图比例错了（比例缩半 / 偏移） | DPR 缩放 bug：检查 `extension/src/background/capture-screenshot.js::cropDataUrl` 是否按 dpr 缩放 |

---

## 8. 测试基线（作为回归基准）

- Rust：`cd snaplex/src-tauri && cargo test --workspace --no-fail-fast` → 64 passed
- 前端：`cd snaplex && pnpm vitest run` → 8 files / 54 tests passed
- 构建：
  - `cd snaplex/src-tauri && cargo build` → only known dead_code warning (`fs::library::is_library`)
  - `cd extension && node scripts/build.mjs` → `Built extension/dist`

任何一项跌出来就说明改代码改坏了。

---
