# 实施计划 — Snaplex 浏览器插件

**Status:** Active
**Owner:** TBD
**Last updated:** 2026-05-05
**Source PRD:** [`docs/prd-browser-extension.md`](./prd-browser-extension.md)

本文件把 PRD 的决策落到具体工程任务上。每个 Phase 可独立验收；Phase 之间的依赖关系在每节顶部标注。

---

## Phase 0 — 仓库结构与开发约定

**依赖**：无
**目标**：为后续工作准备好仓库目录骨架，避免 Phase 1+ 反复决策放在哪里。

### 任务

- 在仓库根新增 `extension/` 目录（与 `snaplex/` 同级），用于浏览器扩展源码（独立 package，不进 Tauri 构建）。
- 在 `snaplex/src-tauri/` 内新增 `bridge/` 子 crate（Cargo workspace 成员），用于 `snaplex-bridge` 二进制。Tauri app 自身保持原结构。
- `snaplex/src-tauri/Cargo.toml` 改为 workspace：成员 `["app", "bridge"]`。把现有 Tauri 代码从根 crate 迁到 `app/` 子目录。
- 新增 `scripts/` 目录（仓库根），后续放安装/卸载 Native Messaging manifest 的脚本。

### 验收

- `cargo build` 在 `snaplex/src-tauri/` 内一次构建出 Tauri app 和 bridge 两个二进制。
- `extension/` 内 `pnpm install && pnpm build` 产出 `extension/dist/`（即便此时只是骨架）。
- 现有的 vitest / Tauri 测试全部通过。

### 关键文件

- `snaplex/src-tauri/Cargo.toml`（workspace 化）
- `snaplex/src-tauri/app/`（原 Tauri 代码迁入）
- `snaplex/src-tauri/bridge/Cargo.toml`、`bridge/src/main.rs`（占位）
- `extension/package.json`、`extension/manifest.json`、`extension/src/`
- `scripts/install-dev-manifest.sh`、`scripts/install-dev-manifest.ps1`（占位）

---

## Phase 1 — Schema 调整与最小 migration 机制

**依赖**：Phase 0
**目标**：把单 `source_url` 字段升级为多 `image_sources` 表；引入最小可用的 migration 机制，使后续 schema 改动可重复执行。

### 任务

#### 1.1 引入最小 migration 机制
- 在 `snaplex/src-tauri/app/src/db/` 新增 `migrations.rs`：
  - 维护一个 `schema_migrations` 表 `(version INTEGER PRIMARY KEY, applied_at TEXT)`。
  - 提供 `run_migrations(conn: &Connection)` 函数：遍历内置 migration 列表，跳过已 applied 的，按 version 升序执行未 applied 的。
  - 每个 migration 是 `pub struct Migration { pub version: u32, pub name: &'static str, pub up: fn(&Connection) -> Result<()> }`。
- 在 Desktop 启动路径里调用 `run_migrations` —— 当前的 `init_db` 之后立即跑。
- 把现有手写的 `CREATE TABLE` SQL 视为"version 0"基线，**不**回填到 migration 列表（避免风险）；migrations 从 v1 开始记录新增改动。

#### 1.2 新增 `image_sources` 表
- Migration v1：
  ```sql
  CREATE TABLE image_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    capture_type TEXT NOT NULL,
    source_url TEXT,
    page_url TEXT,
    page_title TEXT,
    source_domain TEXT,
    captured_at TEXT NOT NULL,
    client_id TEXT NOT NULL,
    metadata_json TEXT,
    UNIQUE(image_id, page_url, captured_at)
  );
  CREATE INDEX idx_image_sources_image_id ON image_sources(image_id);
  CREATE INDEX idx_image_sources_source_domain ON image_sources(source_domain);
  ```
- 保留 `images.source_url` 列；约定：仅在首次入库时写入；后续 source 全部进 `image_sources`。

#### 1.3 ImageSource 模型与 CRUD
- 在 `snaplex/src-tauri/app/src/db/` 新增 `image_sources.rs`：
  - `pub struct ImageSource { ... }` 与上面字段对齐。
  - `pub fn append_source(conn, image_id, src: ImageSourceInput) -> Result<ImageSourceId>`：UPSERT-like，遇 UNIQUE 冲突视为已存在，返回现有 id。
  - `pub fn list_sources_for_image(conn, image_id) -> Result<Vec<ImageSource>>`。
- 在 TS 端 `src/types.ts` 新增 `ImageSource` 类型；并在图片详情视图（如已存在）后续 Phase 准备好挂上。

### 验收

- `cargo test -p app db::migrations` 通过：测试覆盖 (a) 全新库执行所有 migration、(b) 重复运行 idempotent。
- 集成测试用 in-memory SQLite (`Connection::open_in_memory()`) 验证 `append_source` 行为：同 image_id + page_url + captured_at 不重复插入；不同 page_url 多条共存。
- 启动一次 Desktop，确认 `schema_migrations` 表存在且包含 v1。

### 关键文件

- `snaplex/src-tauri/app/src/db/migrations.rs`（新建）
- `snaplex/src-tauri/app/src/db/image_sources.rs`（新建）
- `snaplex/src-tauri/app/src/db/mod.rs`（导出新模块）
- `snaplex/src-tauri/app/src/db/schema.rs`（无改动；migrations 是新主路径）
- `snaplex/src-tauri/app/src/main.rs`（启动时调用 `run_migrations`）
- `snaplex/src/types.ts`（追加 `ImageSource`）

---

## Phase 2 — SHA256 内容哈希与去重 + Source append

**依赖**：Phase 1
**目标**：给图片入库管线加上内容哈希、去重命中、source append 三件事。这一段对 image 类型最有用，对 screenshot/video frame 透明降级（哈希算了，但几乎不会命中）。

### 任务

#### 2.1 给 images 表加 `content_sha256` 列
- Migration v2：
  ```sql
  ALTER TABLE images ADD COLUMN content_sha256 TEXT;
  CREATE UNIQUE INDEX idx_images_content_sha256 ON images(content_sha256) WHERE content_sha256 IS NOT NULL;
  ```
  - 为什么 partial unique index：老数据可能没哈希，避免回填阻塞。
- 后台一次性回填任务（可选 v1.1）：扫描 `content_sha256 IS NULL` 的 images，逐个算哈希写回。Phase 2 先不做，保留接口。

#### 2.2 入库前哈希计算 & 去重命中
- 新增 `app/src/services/ingest.rs`（如未存在）作为统一入库入口：
  ```rust
  pub struct IngestRequest {
    pub bytes: Vec<u8>,            // 或 path: PathBuf 用于 tempfile 路径
    pub content_type: String,
    pub filename_hint: Option<String>,
    pub source: ImageSourceInput,
  }
  pub enum IngestOutcome {
    Saved { image_id: ImageId },
    Duplicate { image_id: ImageId, source_appended: bool },
    Rejected { reason: IngestRejection },
  }
  pub fn ingest(req: IngestRequest) -> Result<IngestOutcome>;
  ```
- 实现：
  1. 计算 SHA256（`sha2` crate，已可加入依赖）。
  2. 查 `images.content_sha256` 是否已存在：
     - 命中 → 调 `image_sources::append_source`，返回 `Duplicate`。
     - 未命中 → 走原有保存路径（`commands::image_commands::import_images` 内的逻辑提取出来），写文件、写 `images` 行（含 sha256）、写第一条 source 到 `image_sources`、写 `images.source_url` 兼容字段。
  3. 异步 schedule 缩略图、色卡、CLIP（沿用现有调度）。
- 把现有 `import_images` Tauri command 改为 `ingest` 的薄包装，行为对老调用方保持兼容。

#### 2.3 拒绝条件
- `IngestRejection` 包括：`UnsupportedContentType`、`InvalidImageBytes`、`NoActiveLibrary`、`PayloadTooLarge`（>50 MB）。
- 每种返回 `code: &'static str` 字符串，前端/扩展可对齐文案。

### 验收

- 单元测试覆盖：
  - 同字节入库两次 → 第二次返回 `Duplicate`，且 `image_sources` 多一条记录。
  - 不同字节入库两次 → 两条 image，各自 sha256 不同。
  - `images.source_url` 仅在第一次写入。
  - 无效 content_type 返回 `Rejected`。
- 现有 `import_images` 集成测试仍通过。

### 关键文件

- `snaplex/src-tauri/app/src/services/ingest.rs`（新建）
- `snaplex/src-tauri/app/src/db/migrations.rs`（追加 v2）
- `snaplex/src-tauri/app/src/db/images.rs`（新增 `find_by_sha256`、写哈希）
- `snaplex/src-tauri/app/src/commands/image_commands.rs`（`import_images` 改为薄包装）
- `snaplex/src-tauri/app/Cargo.toml`（加 `sha2 = "0.10"`，如未存在）

---

## Phase 3 — Bridge 二进制与本地 socket 协议

**依赖**：Phase 0；可与 Phase 1+2 并行
**目标**：实现 `snaplex-bridge`（Chrome Native Messaging 的 stdio host），并约定它和 Desktop 之间的本地 socket 协议。

### 任务

#### 3.1 Native Messaging 协议（Chrome 端 ↔ bridge）
- `bridge/src/main.rs`：
  - 读 stdin：4 字节 little-endian 长度前缀 + JSON 消息体；写 stdout：同格式。
  - 启动后立刻发 `hello` 消息：`{ kind: "hello", desktop_version, bridge_version, extension_version_min }`，从环境变量或编译时常量读取版本。
  - 收到扩展端 `hello_ack` 后进入正常转发循环。
  - 错误封装：`{ kind: "error", code, message }`。
- 关键边界条件：
  - stdin EOF → 优雅退出。
  - 单消息上限：Chrome → bridge 1 MB，bridge → Chrome 4 GB；超限返回 `payload_too_large` 错误。

#### 3.2 本地 socket 协议（bridge ↔ Desktop）
- 用 `interprocess` crate 抽象掉 macOS/Linux Unix socket 与 Windows 命名管道的差异。
- Socket 路径：
  - macOS / Linux：`$XDG_RUNTIME_DIR/snaplex.sock`，无则降级到 `$TMPDIR/snaplex-<uid>.sock`。
  - Windows：`\\.\pipe\snaplex`。
- 协议同 Native Messaging 格式（4 字节长度 + JSON），便于 bridge 几乎透传。
- bridge 启动时：
  1. 尝试连接 socket。
  2. 连接失败 → 调 `launch_desktop()`（macOS `open -a Snaplex`，Windows `ShellExecute`，Linux desktop file 或直接 spawn `snaplex` 二进制）。
  3. 在 5 秒内轮询 socket 直到能连上；超时则向 Chrome 发 `desktop_not_responding` 错误。
- 连接稳定后 bridge 维持双向转发：Chrome stdin → socket、socket → Chrome stdout。

#### 3.3 Desktop 一侧的 socket listener
- 在 Tauri app 启动路径里，spawn 一个 tokio 任务监听 socket。
- 每个连接进入独立 task：解码 4字节+JSON，路由到 `handle_capture_message`。
- 路由：
  - `kind: "hello_ack"` → 校验扩展版本，回 `{ kind: "ready", locale, library_name }`，把 Desktop 当前 UI locale 和活动库名发给扩展，用于 popup 显示与 i18n。
  - `kind: "write_tempfile"` → 接收 base64 内容，写入系统 tempdir，返回 `{ kind: "tempfile_path", path }`。
  - `kind: "capture"` → 解析 envelope，调 `services::ingest::ingest`，返回 `{ kind: "capture_result", outcome, image_id?, code? }`。
- 同 vendor 同进程组之间的 socket 不加鉴权层。

#### 3.4 版本握手
- bridge 的 `desktop_version` / `bridge_version` 写到 `Cargo.toml` 的 `[package].version`。
- 扩展端的版本从 `manifest.json` 读取。
- 不兼容时返回结构化错误，扩展 popup 显示升级提示。

### 验收

- `cargo run --bin snaplex-bridge` 在终端能用 `chrome-native-messaging-test` 之类工具或自写 stdio 测试 harness 完成 hello/hello_ack 往返。
- bridge ↔ Desktop 集成测试：spawn Desktop（用真实 binary 或 in-process tokio runtime 假 Desktop）+ spawn bridge + 模拟 Chrome stdin/stdout，跑通 capture 端到端，验证 image 入库。
- 杀掉 Desktop 进程，bridge 在 5 秒内能重新拉起来（macOS / Linux 验证；Windows 至少手动验证）。

### 关键文件

- `snaplex/src-tauri/bridge/Cargo.toml`（依赖 `interprocess`、`serde_json`、`tokio` features）
- `snaplex/src-tauri/bridge/src/main.rs`、`bridge/src/native_messaging.rs`、`bridge/src/socket_client.rs`、`bridge/src/launch_desktop.rs`
- `snaplex/src-tauri/app/src/transport/local_socket.rs`（新建，监听 socket）
- `snaplex/src-tauri/app/src/transport/handlers.rs`（新建，路由 capture/hello/tempfile）
- `snaplex/src-tauri/app/src/main.rs`（启动 transport task）

---

## Phase 4 — 安装器写 Native Messaging manifest

**依赖**：Phase 3
**目标**：让 Snaplex Desktop 的安装动作自动写入 NM manifest，使用户安装即可与扩展互通。

### 任务

#### 4.1 Manifest 内容生成
- 在 Desktop 首次启动时（或 post-install 钩子）写 manifest 文件，而不是依赖 OS 安装器脚本（更跨平台、更可重复）：
  - 检查 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` 等路径是否存在；存在则写 manifest。
  - 同时为 Edge、Brave、Arc 的等价路径也写一份（best effort，路径不存在就跳过）。
  - 写入内容：
    ```json
    {
      "name": "com.snaplex.host",
      "description": "Snaplex Native Messaging Host",
      "path": "<absolute path to snaplex-bridge>",
      "type": "stdio",
      "allowed_origins": [
        "chrome-extension://<production-extension-id>/",
        "chrome-extension://<dev-extension-id>/"
      ]
    }
    ```
- `<absolute path to snaplex-bridge>` 在 macOS app bundle 内是 `/Applications/Snaplex.app/Contents/Resources/snaplex-bridge`；Windows 是安装目录下的 `snaplex-bridge.exe`；Linux 是 `/usr/lib/snaplex/snaplex-bridge` 或 AppImage 内对应位置。把这条计算逻辑放到 `app/src/transport/manifest.rs`。

#### 4.2 卸载/升级时的清理
- Desktop 关闭/卸载时不主动删 manifest（避免和并发更新打架）。下次启动会覆盖写入新版本。
- 卸载脚本（`.app` 卸载、`.msi` 卸载、`.deb` postrm）按平台规范删 manifest。

#### 4.3 Dev 模式 manifest 注入
- `scripts/install-dev-manifest.sh`（macOS / Linux）和 `.ps1`（Windows）：
  - 参数：`--bridge <path>`、`--ext-id <chrome-extension-id>`。
  - 在用户 Chrome NM 路径写 manifest，path 指向 `target/debug/snaplex-bridge`，allowed_origins 含 dev ext id。
  - 提供 `uninstall-dev-manifest.sh` 反向操作。

#### 4.4 扩展 ID 来源
- production：Web Store 发布后获得，写到 `app/src/transport/manifest.rs` 的常量。Phase 4 暂用占位 ID，待 Phase 10 发布时替换。
- dev：用 `chrome://extensions` 查看本地加载扩展的 ID；写到 `extension/scripts/dev-extension-id.txt`，dev manifest 脚本读取。

### 验收

- 在干净的 macOS 用户目录运行 Desktop 一次后，`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.snaplex.host.json` 存在，内容正确。
- 该路径写入对 Edge、Brave 路径同样成立（手动验证）。
- 在 Windows 用户运行 Desktop 一次后，`HKCU\Software\Google\Chrome\NativeMessagingHosts\com.snaplex.host` 注册表项存在（用 `reg query` 验证）。
- dev 脚本运行后，`chrome.runtime.connectNative('com.snaplex.host')` 在 dev 扩展中能成功连接。

### 关键文件

- `snaplex/src-tauri/app/src/transport/manifest.rs`（新建）
- `snaplex/src-tauri/app/src/main.rs`（启动时调 `manifest::ensure_installed`）
- `scripts/install-dev-manifest.sh`、`scripts/install-dev-manifest.ps1`、`scripts/uninstall-dev-manifest.sh`、`scripts/uninstall-dev-manifest.ps1`
- `extension/scripts/dev-extension-id.txt`（开发约定）

---

## Phase 5 — 扩展骨架（MV3 manifest、popup、context menu、命令）

**依赖**：Phase 0；与 Phase 1-4 并行可起步，但端到端验收依赖 Phase 3+4
**目标**：搭起 MV3 扩展骨架，跑通"打开 popup → 显示连接状态"。

### 任务

#### 5.1 MV3 manifest
- `extension/manifest.json`：
  ```json
  {
    "manifest_version": 3,
    "name": "Snaplex",
    "version": "0.1.0",
    "permissions": [
      "contextMenus", "storage", "activeTab", "scripting", "tabs",
      "nativeMessaging", "commands"
    ],
    "host_permissions": ["<all_urls>"],
    "background": { "service_worker": "background.js", "type": "module" },
    "action": { "default_popup": "popup.html" },
    "icons": { ... },
    "commands": {
      "start-region-screenshot": {
        "suggested_key": { "default": "Ctrl+Shift+S", "mac": "Command+Shift+S" },
        "description": "Start region screenshot"
      }
    }
  }
  ```

#### 5.2 Service Worker（background）
- `extension/src/background/index.ts`：
  - 进程启动时建立 NM 长连接：`chrome.runtime.connectNative('com.snaplex.host')`。
  - 维护 `connectionState: 'connecting' | 'ready' | 'error'`。
  - 收到 `ready` 消息后存下 `locale` 和 `libraryName` 到 `chrome.storage.session`，给 popup 用。
  - 注册 context menus（image / page / video，三项）。
  - 注册 `chrome.commands.onCommand` 监听器（`start-region-screenshot`）。
  - 提供消息中枢：popup / content script 发消息进来 → 包装成 capture envelope → 通过 NM 发出 → 把结果回传给请求方。

#### 5.3 Popup
- `extension/popup.html` + `extension/src/popup/`：极简 React/Preact 或纯 HTML。
- 显示：
  - 顶部：连接状态徽章（已连接 / Snaplex 未启动 / 不兼容版本 / 无活动库）。
  - 中部：当前活动库名（来自 `ready` 消息）。
  - 按钮："Capture visible area"、"Select area"。
  - 底部小字：右键提示 "Right-click any image or video on a page to save it directly. Press Cmd+Shift+S to start region screenshot."
- 不出现：端口、token、folder tree、tag 输入。

#### 5.4 i18n 框架
- 定义 `messages.zh.json`、`messages.en.json`，提供 `t(key)` 工具。
- 语言来源：`chrome.storage.session` 里的 `locale`（来自 Desktop hello）；fallback 到 `chrome.i18n.getUILanguage()`。

### 验收

- 在 dev 模式加载扩展后，popup 打开显示"已连接 Snaplex"+ 当前库名。
- 关闭 Desktop，popup 在 5-10 秒内变为"Snaplex 未启动"或"正在启动 Snaplex"。
- `Cmd+Shift+S` 触发会调用 `start-region-screenshot` handler（此时只 console.log，下个 Phase 再实现 overlay）。
- 右键菜单三项可见（点击会发消息到 background，下个 Phase 真实 wire 起来）。

### 关键文件

- `extension/manifest.json`
- `extension/src/background/index.ts`、`background/native-messaging.ts`、`background/context-menus.ts`、`background/commands.ts`
- `extension/src/popup/index.tsx`（或 `.ts`）、`popup/styles.css`、`extension/popup.html`
- `extension/src/i18n/`、`messages.{zh,en}.json`

---

## Phase 6 — 图片右键保存端到端

**依赖**：Phase 1+2+3+4+5
**目标**：把"右键图片 → Save image to Snaplex → 出现在 All Images"打通。这是最小可发布功能。

### 任务

#### 6.1 Content script：图片获取
- 当用户在 `<img>` 上右键 → background 通过 `chrome.contextMenus.onClicked` 拿到 `info.srcUrl`。
- background 调 content script（用 `chrome.scripting.executeScript`）抓取图片字节：
  - 优先用 `fetch(srcUrl, { credentials: 'include' })` 取得 blob，规避 hotlink/cookie 保护图片。
  - 失败则尝试 `chrome.scripting.executeScript` 注入函数定位 `<img>` DOM、用 canvas drawImage 取得 dataURL（CORS-tainted 时失败）。
- 拿到 bytes + content_type + filename_hint（从 URL path basename 提取）。

#### 6.2 通过 bridge 入库
- background 把 bytes base64 化（如果 < 256 KB）或先调 `write_tempfile` 拿到 path（>= 256 KB），再发 capture envelope：
  ```json
  {
    "kind": "capture",
    "capture": {
      "type": "image",
      "payload_ref": { ... },
      "metadata": {
        "source_url": <img-src>,
        "page_url": <tab.url>,
        "page_title": <tab.title>,
        "filename_hint": <basename>,
        "captured_at": <ISO>,
        "type_specific": { "original_image_url": <img-src> }
      }
    }
  }
  ```
- 收到 `capture_result` 后：
  - `Saved` → toast "Saved to Snaplex"。
  - `Duplicate` 且 `source_appended` → toast "Already in your library — added new source"。
  - `Duplicate` 且未 append → toast "Already in your library"。
  - `Rejected` → 按 `code` 显示对应错误文案。

#### 6.3 In-page toast 注入
- background 通过 `chrome.scripting.executeScript` 把 toast 函数注入活动 tab 的 main world。
- toast 是一个 shadow DOM 元素，固定右下角，1.8 秒自动消失。
- 如果注入失败（chrome:// 等），回退到扩展 icon badge：颜色（绿/黄/红）+ 1.5 秒后清除。

### 验收

- 在 unsplash / pinterest / 普通新闻站右键图片，1 秒内 toast 提示 saved，Snaplex Desktop All Images 出现该图。
- 重复保存同一图：第二次 toast 显示 "Already in your library — added new source"，Desktop 端该图的 sources 列表多一条。
- chrome:// 页面右键菜单不显示保存项。
- 关闭 Desktop 后右键保存：bridge 自动拉起 Desktop，几秒后 toast 提示 saved（或 popup 显示 "Starting Snaplex..."）。

### 关键文件

- `extension/src/background/capture-image.ts`
- `extension/src/background/messaging.ts`（capture envelope 构造与发送）
- `extension/src/content/toast.ts`（注入函数）
- `extension/src/background/badge.ts`
- `snaplex/src-tauri/app/src/transport/handlers.rs`（capture 路由已有，确认 image 路径打通）

---

## Phase 7 — 可视区截屏

**依赖**：Phase 6
**目标**：popup "Capture visible area" 按钮 + 页面右键 "Capture visible area to Snaplex" 工作。

### 任务

- 用 `chrome.tabs.captureVisibleTab(null, { format: 'png' })` 拿到 dataURL。
- 转 Blob → base64（或 tempfile，按大小路由）。
- 构造 envelope：`type: "screenshot_visible"`，metadata 含 `page_url`、`page_title`、`captured_at`。
- 发给 bridge，沿用 Phase 6 的反馈机制。

### 验收

- popup 按钮触发后出现 toast saved，Desktop 出现截图，文件名格式如 `<domain>-visible-<timestamp>.png`。
- 页面右键触发等价行为。
- 4K Retina 显示器下截图为原生像素分辨率，不是 CSS 像素。

### 关键文件

- `extension/src/background/capture-screenshot.ts`

---

## Phase 8 — 区域截屏 overlay

**依赖**：Phase 7
**目标**：实现选区→预览→可调裁剪→Enter/Esc 的完整 UX。

### 任务

#### 8.1 Overlay 注入
- 入口：popup "Select area" 按钮 OR 命令快捷键 `Cmd+Shift+S`。
- background 通过 `chrome.scripting.executeScript` 注入 overlay JS + CSS（独立 shadow DOM 避免站点样式污染）。
- overlay 抓取键盘事件、鼠标事件，遮盖整个视口，初始化为半透明黑色蒙层。

#### 8.2 选区状态机
- **idle** → 鼠标按下 → **dragging**（实时绘制矩形）→ 鼠标抬起 → **preview**（蒙层 + 矩形透明区域 + 8 个调整 handle + 工具条）。
- preview 状态：
  - 矩形可整体拖动（捕获矩形内 mousedown）。
  - 8 个 handle（4 边 4 角）可拖动调整。
  - 工具条按钮：Save、Reselect、Cancel。
  - 键盘：`Enter` = Save、`Esc` = Cancel。
- 选区面积 < 8×8 CSS px 时禁用 Save 并显示 "Selection too small"。
- 切 tab → background 收到 `tabs.onActivated` → 销毁 overlay。

#### 8.3 截图与裁剪
- Save 时：调 `chrome.tabs.captureVisibleTab`（含整个可视区）→ 在内存中按 `(rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr)` 用 OffscreenCanvas 裁剪。
- 输出 PNG blob → 走 capture envelope 流程，`type: "screenshot_region"`，metadata 含 `rect`、`dpr`、`page_url`、`page_title`。

### 验收

- 选区拖出 → 进入 preview → 拖动整体、8 角调整、Reselect 重来、Esc 取消、Enter 保存：每条交互手动验证一次。
- Retina 下选 100×100 区域，保存的 PNG 是 200×200 像素。
- 选区切 tab 中途取消。
- 在 Snaplex 详情页查看新建图片，metadata 含 rect 信息。

### 关键文件

- `extension/src/content/region-overlay/index.ts`、`region-overlay/state-machine.ts`、`region-overlay/handles.ts`、`region-overlay/styles.ts`
- `extension/src/background/capture-region.ts`

---

## Phase 9 — 视频帧捕获

**依赖**：Phase 6
**目标**：右键视频 → 保存当前帧；CORS / DRM 失败时给清晰文案。

### 任务

- 视频右键菜单 click → background 通过 `chrome.scripting.executeScript` 在主世界执行：
  ```js
  function captureVideoFrame(targetElementInfo) {
    const v = document.querySelector(...); // 由 contextMenus.onClicked 的 frameId / pageX/pageY 定位
    const canvas = new OffscreenCanvas(v.videoWidth, v.videoHeight);
    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(v, 0, 0);
      return { ok: true, blob: await canvas.convertToBlob({ type: 'image/png' }), currentTime: v.currentTime };
    } catch (e) {
      // SecurityError → CORS-tainted
      // 其他/黑帧 → DRM 嫌疑
      return { ok: false, kind: classifyFailure(e, v) };
    }
  }
  ```
- `classifyFailure`：
  - `SecurityError` → `cors_tainted`（toast 文案：建议改用区域截图）。
  - 视频源域 在 已知 EME 站列表（YouTube DRM 流、Netflix、Disney+ 等）→ `drm_protected`（toast 文案：DRM 受保护，无法捕获）。
  - 否则归为 `cors_tainted`（保险默认）。
- 成功路径：blob → base64 / tempfile → envelope `type: "video_frame"`，metadata 含 `media_current_time_seconds`。

### 验收

- 在 HTML5 video 设了 `crossorigin="anonymous"` 的页面（如 archive.org）保存帧成功。
- 在普通无 CORS 头的视频上失败 → toast "Cannot capture this video frame, try region screenshot"。
- 在 DRM 流（手动找一个）上失败 → toast "This video is DRM-protected"。

### 关键文件

- `extension/src/background/capture-video-frame.ts`
- `extension/src/content/video-capture-injected.ts`
- `extension/src/util/drm-detect.ts`

---

## Phase 10 — 打磨与发布前清单

**依赖**：Phase 6-9
**目标**：把所有"应该有但没必要单独 Phase"的细项收尾，跑通发布前 checklist。

### 任务

- **受限页菜单屏蔽**：context menus 的 `documentUrlPatterns` 排除 `chrome://*`、`chrome-extension://*`、`*.chromewebstore.google.com/*`、`devtools://*` 等。
- **Badge fallback 完善**：toast 注入失败的检测必须可靠（用 `executeScript` 返回值判定）；badge 颜色：saved=绿、duplicate=黄、failed=红，~1.5s 后清除。
- **本地日志**：
  - Desktop ring buffer：在 `app/src/services/capture_log.rs` 维护 `Mutex<VecDeque<CaptureLogEntry>>`，cap 200。每次 ingest 写一条。
  - Bridge log：`~/.snaplex/logs/bridge.log`，rotate at 1 MB（用 `tracing-appender`）。
  - Settings 加 "Export capture diagnostics" 按钮：把 ring buffer + bridge log 打 zip，弹 save dialog。
- **性能预算验证**：
  - 加埋点测量 user-action → toast 显示的 wall clock。
  - 在 dev 控制台输出，确保 image 类 < 500ms。
  - 缩略图、色卡、CLIP 索引必须 spawn task，绝不在 ingest 主路径里 await。
- **i18n 完整化**：所有 popup / toast / 错误文案过一遍 zh/en，挂上 `t()`。
- **隐私文案**：popup 加 footer "Captured content is stored only on your computer. Snaplex never sends it to a server." Web Store 上架前会复用。
- **README / 文档**：在 `extension/README.md` 写 dev 加载流程、安装 dev manifest 步骤、调试技巧。
- **发布前 checklist**（不在本 Phase 完成，但记录下来）：
  - 把 production extension ID 写进 `app/src/transport/manifest.rs`。
  - Web Store 上架材料：截图、隐私政策、权限说明（host permissions 为何需要）。
  - Edge / Brave / Arc 在三个 OS 至少各冒烟一遍。

### 验收

- 在 chrome:// 页面右键，看不到 Snaplex 菜单项。
- 在受限页用快捷键截图，badge 闪烁，toast 不出现，badge 颜色正确反映结果。
- Desktop Settings 导出诊断包能拿到包含最近捕获记录的 zip。
- 触发到 toast 在普通 image 流程下 < 500ms（dev 机器）。

### 关键文件

- `extension/manifest.json`（context menus URL patterns）
- `extension/src/background/badge.ts`
- `snaplex/src-tauri/app/src/services/capture_log.rs`（新建）
- `snaplex/src-tauri/bridge/src/logging.rs`（新建）
- `extension/src/i18n/messages.{zh,en}.json`（补全）
- `extension/README.md`

---

## 跨 Phase 测试基础设施

可以在 Phase 0 后随时建立，并在每个 Phase 复用：

- **Rust**：
  - 用 `rusqlite::Connection::open_in_memory()` 跑 db 层集成测试。
  - 用 mock socket（`tokio::io::duplex`）测 transport handlers。
- **TS**：
  - 用 vitest（已存在）+ jsdom 测 popup 行为。
  - 用 `chrome-webstore-mock` 之类 stub 模拟 chrome.* API。
  - Native Messaging 边界用一个 fake bridge：内存 stream，按协议回放。
- **端到端**：
  - Playwright + extension load 加载 dev 扩展跑真实 UI（在 Phase 5 之后引入）。

---

## 依赖图速览

```
Phase 0
  ├─→ Phase 1 ─→ Phase 2 ──┐
  ├─→ Phase 3 ─→ Phase 4 ──┤
  └─→ Phase 5 ─────────────┴─→ Phase 6 ─→ Phase 7 ─→ Phase 8
                                  └────────→ Phase 9
                                                       └─→ Phase 10
```

可并行的独立轨道：
- 后端轨：Phase 1 → 2
- Bridge / 安装器轨：Phase 3 → 4
- 扩展骨架轨：Phase 5
- 三轨在 Phase 6 处汇合做端到端。

---

## 当前未决问题（不阻塞动工，但实施中可能撞上）

- macOS 上 `interprocess` crate 的 Unix socket 路径长度限制（macOS sun_path 104 字节）—— 如果 `$XDG_RUNTIME_DIR` 路径过长可能要回退到短路径。
- Windows `ShellExecute` 拉起 Desktop 时是否需要管理员权限—— 取决于 Tauri 安装位置；MSI 默认装到 `Program Files`，普通用户启动应该没问题，但需在 Phase 4 验证。
- Chrome 之外的 Chromium 派生（Edge/Brave/Arc）的 Native Messaging 路径是否完全兼容 Chrome 的 manifest 格式 —— 文档上是兼容的，但 Phase 4 应在 macOS + Windows 各冒烟一遍。
- 区域截图能否在浏览器 fullscreen 视频上正常工作 —— captureVisibleTab 在 fullscreen 通常有效，但 Phase 8 应明确测试。
- 图片 fetch 用 `credentials: 'include'` 在某些跨域 cookie 严格的站点上仍然拿不到字节 —— Phase 6 用 `<img>` canvas drawImage 作为兜底，再失败就报 `image_fetch_failed`。
