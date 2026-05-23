# Issues Execution Plan (2026-05-06)

本文档把 GitHub Issues #1–#14 的修复工作拆解为 5 个 Wave、11 个可独立执行的任务（T1–T11）。新智能体打开本文档即可直接执行，不依赖任何外部上下文。

## 0. 全局信息

- 仓库: `ginger4soda-netizen/Snaplex`
- 当前分支: `feat/snake-ip-rebrand`
- 工作目录: `snaplex/`
- 包管理: pnpm
- 关键命令:
  - `pnpm dev` — Web 端预览
  - `pnpm tauri:dev` — 桌面端预览（用于桌面端验证）
  - `pnpm test` — Vitest 单测
  - `pnpm build` — Web 构建（type-check 兜底）
- 关键路径:
  - i18n: [src/translations.ts](../src/translations.ts)
  - 三栏布局: [src/components/layout/](../src/components/layout/)
  - 详情/Chat: [src/components/detail/](../src/components/detail/)
  - 设置/About: [src/components/shared/Settings.tsx](../src/components/shared/Settings.tsx)、[src/components/About.tsx](../src/components/About.tsx)
  - XLS 导入: [src/utils/importLegacy.ts](../src/utils/importLegacy.ts)、[src/utils/importHistory.ts](../src/utils/importHistory.ts)
  - 浏览器扩展: [extension/](../extension/)

## 1. Wave 与 PR 策略

| Wave | 任务 | 关联 Issue | PR 策略 |
|---|---|---|---|
| 1 | T1, T2, T3 | #2, #7, #8, #9 | **合并 1 个 PR**（清理类小改） |
| 2 | T4 | #10, #13, #14 | 1 个 PR（i18n 集中） |
| 3 | T5, T6, T7 | #5, #6, #11 | 1 个 PR 或按任务拆 3 个，由执行者自行判断 |
| 4 | T8 | #1 | 1 个 PR |
| 5 | T9, T10, T11 | #3, #4, #12 | 每个任务先方案确认 → 再独立 PR |

**Wave 之间严格串行**：上一波合入后再开下一波。Wave 内任务可并行，但 Wave 1 的 3 个任务统一打包为一个 PR。

## 2. 通用约定（所有任务必读）

### 2.1 分支与提交
- 每个 Wave 开一个分支：`fix/wave-N-<topic>`，从 `feat/snake-ip-rebrand` 切出。
- 提交信息遵循仓库现有 conventional commit 风格（参考 `git log --oneline`）：`feat:` `fix:` `chore:` `refactor:` 等。
- 每个任务在提交信息或 PR body 中关联 issue 号：`Closes #11` / `Refs #11`。

### 2.2 i18n key 命名规则（Wave 2 起强制）
- 命名空间用点号分层，全小写：`sidebar.library`、`prompt.section.subject`、`search.placeholder`、`empty.title`、`about.description`。
- 同一个 key 必须在 `zh` 与 `en` 两个语言块同步添加，缺一不可。
- 不要在 JSX 直接写中文/英文字面量；统一走 `t('...')`。

### 2.3 验证最低门槛
- 每完成一个任务，至少执行 `pnpm test` 与 `pnpm build`，通过后再提交。
- 涉及 UI 的任务必须在 `pnpm tauri:dev` 桌面端实际操作复测；不能仅靠 type-check 声称完成。
- 若无法在桌面端验证（例如缺少环境），在 PR 描述里明确写出"未做桌面端实测"，**不要**声称已完成。

### 2.4 HITL 任务协作方式（仅适用于 T9/T10）
- 第一阶段产出**方案报告**（独立 markdown 放在 `docs/discovery/`），包括失败矩阵、技术路线对比、推荐选项。
- 在 issue 中评论或新开 discussion 等待用户拍板，**不要**直接进入实现阶段。
- 第二阶段用户拍板后再开实现 PR。

---

## Wave 1 — 低风险独立修复（合并 1 个 PR）

**目标**：用一个 PR 消化 4 个独立小问题。三任务彼此**无依赖**，可同分支并行修改。

**分支**：`fix/wave-1-cleanup`

### T1 · #2 浏览器扩展自定义截图快捷键

**依赖**：无。

**关键文件**：
- [extension/manifest.json](../extension/manifest.json) — `commands.start-region-screenshot`
- `extension/src/popup.*`（HTML + 入口脚本）
- 扩展自身的 i18n（不一定走 `src/translations.ts`，需先在 `extension/` 内确认）

**执行步骤**：
1. 在 `manifest.json` 中将 `start-region-screenshot` 的 `default` 快捷键调整为不写死冲突值（可保留为可选默认，但要允许浏览器层覆盖）。
2. Popup 加载时调用 `chrome.commands.getAll()`，找到 `start-region-screenshot` 命令的 `shortcut` 字段；为空时显示"未设置 / Not set"，否则显示实际值。
3. Popup 增加按钮"自定义快捷键 / Customize"，点击 `chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })`。Edge 下需 fallback 到 `edge://extensions/shortcuts`，可通过 `navigator.userAgent` 判断或两个都尝试。
4. 中英文文案同步更新（移除"按 Cmd+Shift+S 开始区域截图"硬编码提示）。

**验收标准**：
- [ ] Popup 显示当前实际生效快捷键；未配置时显示"未设置"。
- [ ] 点击"自定义快捷键"按钮跳到浏览器扩展快捷键设置页。
- [ ] 中英文 i18n 文案均已更新，不再误导用户使用 `Cmd+Shift+S`。
- [ ] 装一个占用 `Cmd+Shift+S` 的扩展时，Snaplex popup 显示为空或新值，不冲突误导。

---

### T2 · #8 + #9 删除 Capture Diagnostics + Settings 顶部上移

**依赖**：无。

**关键文件**：
- [src/components/shared/Settings.tsx](../src/components/shared/Settings.tsx)（重点行：254–280；89 行 `defaultPath`；任何 `isExportingDiagnostics` 相关 state/handler/import）

**执行步骤**：
1. 删除 `Capture Diagnostics` 整段 JSX（约 254–280）。
2. 删除 `isExportingDiagnostics` state、`handleExportDiagnostics` handler、相关 IPC import 与 `defaultPath` 变量。grep 确认无残留引用：
   ```
   grep -rn "Capture Diagnostics\|Export diagnostics\|isExportingDiagnostics\|capture-diagnostics" src/
   ```
   预期：0 命中。
3. 调整 Settings 容器顶部 `padding-top` / `margin-top`，让首个模块上移。具体数值由 `pnpm tauri:dev` 桌面端目视确定，参考"模块间垂直间距保持一致"。
4. 不保留诊断功能（按用户决策直接删除）；若发现其他文件仍调用 `import_legacy_item` 之外的诊断 IPC，可一并清理。

**验收标准**：
- [ ] Settings 页不再展示 `Capture Diagnostics` 区块和 `Export diagnostics` 按钮。
- [ ] grep 检查上述关键字 0 命中。
- [ ] 桌面端 Settings 首屏首个模块上移，顶部留白显著缩小，模块间距未变形。
- [ ] 其他页面顶部布局不受影响。
- [ ] `pnpm test` `pnpm build` 通过。

---

### T3 · #7 Dark mode Chat 文字对比度

**依赖**：无。

**关键文件**：
- [src/components/detail/ChatPanel.tsx](../src/components/detail/ChatPanel.tsx)
- 其他 markdown 渲染容器（grep `react-markdown` `prose` 找到）

**执行步骤**：
1. 定位 Chat 回复渲染容器（react-markdown 包裹层）。
2. 加 dark variant 样式：
   - 正文：`dark:text-stone-200`
   - 引用块：`dark:border-stone-600 dark:bg-stone-800/50 dark:text-stone-300`
   - 代码 inline：`dark:bg-stone-800 dark:text-stone-100`
   - 标题、强调：根据现有 light mode 颜色派生
   - 如果项目用 `@tailwindcss/typography`，优先用 `prose dark:prose-invert`。
3. **不破坏 light mode**：所有改动用 `dark:` 前缀，不修改原有 light 样式。

**验收标准**：
- [ ] Dark mode 下贴一段含 `# 标题 / ## 小标题 / > 引用 / **粗体** / 列表 / inline code` 的回复，所有元素清晰可读（目视对比度 WCAG AA 合格即可，不要求精确测量）。
- [ ] Light mode 同样回复样式与改动前一致，不退化。
- [ ] 至少手动验证 1 条多段落 + 引用块 + 列表的回复。

---

### Wave 1 PR 合并清单

PR 标题建议：`fix: wave 1 cleanup (#2, #7, #8, #9)`

PR body 必须包含：
- 每个 issue 的简短修复说明
- 桌面端实测截图：Settings 改动前/后、Dark mode Chat 截图、扩展 popup 截图
- `Closes #2`、`Closes #7`、`Closes #8`、`Closes #9`

---

## Wave 2 — i18n 集中补齐

**目标**：消灭三栏布局 + About + 中间栏搜索/空状态的所有英文硬编码。

**分支**：`fix/wave-2-i18n`

**前置依赖**：Wave 1 已合入主分支。

### T4 · #10 + #13 + #14 i18n 全量补齐

**关键文件**：
- [src/translations.ts](../src/translations.ts)
- [src/components/layout/Sidebar.tsx](../src/components/layout/Sidebar.tsx)
- [src/components/search/SearchBar.tsx](../src/components/search/SearchBar.tsx)
- [src/components/layout/ImageGrid.tsx](../src/components/layout/ImageGrid.tsx)（empty state）
- [src/components/About.tsx](../src/components/About.tsx)
- prompt 分组组件（位置需 grep 定位，关键字 `SUBJECT` `ENVIRONMENT` `COMPOSITION` `LIGHTING` `MOOD` `STYLE`）

**执行步骤**：
1. **审计阶段**：跑 grep 收集所有硬编码字符串。
   ```
   grep -rn "LIBRARY\|FOLDERS\|TOOLS\|SOURCES\|PROMPT\|NOTES" src/components/
   grep -rn "SUBJECT\|ENVIRONMENT\|COMPOSITION\|LIGHTING\|MOOD" src/components/
   grep -rn "No images found\|Drag & drop\|Search snaps" src/components/
   ```
   产出待替换清单（建议先列在 PR description 里）。

2. **加 keys**：在 `translations.ts` `zh` / `en` 块中补齐：
   - `sidebar.library`、`sidebar.folders`、`sidebar.tools`、`sidebar.sources`、`sidebar.prompt`、`sidebar.notes`
   - `prompt.section.subject` 等 6 个分组
   - `search.placeholder`（含示例）
   - `empty.title`（"未找到图片"/"No images found"）
   - `empty.hint`（"拖放图片或点击导入"/"Drag & drop images or click to import"）
   - `about.title`、`about.description`、`about.builtWith`、`about.license`、`about.version` 等

3. **替换硬编码**：所有 JSX 字面量改 `t('...')`。

4. **About 页特殊处理（#13）**：
   - 替换 logo 资源：与 Wave 4 T8 收起态 logo 同源，使用新版 Snaplex 品牌资源（参考 `branding/` 目录或现有 [src/components/web/](../src/components/web/) Logo 组件）。
   - 版本号动态读取：从 `package.json` 的 `version` 字段（Vite 通过 `import.meta.env` 或直接 import package.json）或 Tauri config（`@tauri-apps/api/app` 的 `getVersion()`）。**不再写死 `v0.1.0`**。
   - Dark mode 排版/对比度顺手过一遍。

5. **语言切换刷新**：确认现有 i18n 实现在切换语言后无需重启即生效；若需要刷新机制，遵循项目已有规则。

**验收标准**：
- [ ] grep 上述硬编码关键字在 `src/components/` 内 0 命中。
- [ ] 中文界面下三栏标题、搜索框 placeholder、空状态、About 页全中文，无英文残留。
- [ ] 英文界面同样正常。
- [ ] About 页 logo 为新版 Snaplex 品牌资源；版本号与 `package.json` 一致（手动改 `package.json` 验证一次）。
- [ ] 切换语言后立即刷新，或符合项目原有刷新规则。
- [ ] `pnpm test` `pnpm build` 通过。

---

## Wave 3 — 交互正确性

**目标**：修复 Chat 停止、解析串图、拖拽误触发三个状态/事件相关 bug。

**分支**：`fix/wave-3-interaction`

**前置依赖**：Wave 2 已合入。

### T5 · #11 Chat 回答停止生成

**关键文件**：
- [src/components/detail/ChatPanel.tsx](../src/components/detail/ChatPanel.tsx)
- chat 调用所在 service（grep `streamChat` `sendMessage` `chat` 在 `src/services/` 定位）

**执行步骤**：
1. 在 ChatPanel 里持有 `controllerRef = useRef<AbortController|null>(null)`。
2. 发送时 `controllerRef.current = new AbortController()`，把 `signal` 传入 fetch / SSE 流。
3. `isStreaming` 为 true 时，发送按钮切换图标为停止（方/圆停止图标），点击触发 `controllerRef.current?.abort()` 并设 `aborted=true`。
4. stream 读取循环里捕获 `AbortError` 静默忽略；同时 `if (aborted) break` 防止迟到 chunk 写入。
5. 已生成的部分回答**保留**，标记为"已停止"（可在末尾追加 `[stopped]` 或 UI 灰化），符合 issue 验收"按产品规则处理"。
6. 发送框/按钮在 abort 完成后立即可用（reset `isStreaming`）。
7. 防快速连点：abort 后立即把按钮切回发送态，不依赖 stream 自然结束。

**验收标准**：
- [ ] 长回答中点停止，文字立即停止增长。
- [ ] 输入框立即可用，可再发新问题。
- [ ] 快速连点停止 → 无重复请求、无异常 toast。
- [ ] 已生成的部分回答保留可见。
- [ ] provider 不支持真正取消时，UI 至少停止继续写入并丢弃迟到结果（在代码注释里说明此 fallback 行为）。

---

### T6 · #6 提示词解析按 ID 隔离 + AI 角标刷新

**关键文件**：
- 解析状态所在 store / context（grep `analyzing` `Analyze prompt` `analyzePrompt` 定位）
- [src/components/detail/DetailPanel.tsx](../src/components/detail/DetailPanel.tsx)
- [src/components/layout/ImageGrid.tsx](../src/components/layout/ImageGrid.tsx)（角标渲染）

**执行步骤**：
1. **状态结构改造**：把全局单值 `analyzing: boolean` 改为 `analyzingIds: Set<string>` 或 `Record<string, 'idle'|'analyzing'|'done'>`。所有 `setAnalyzing(true)` 调用改为 `add(imageId)`，完成时 `delete(imageId)`。
2. **完成回调ID校验**：解析完成的回调里携带 `imageId`，更新数据时只写入 `images[imageId]`。**不要**直接更新右栏当前显示内容；让右栏 UI 自己根据"当前选中 image.id 是否等于 result.id"决定是否渲染。
3. **右栏渲染**：DetailPanel 渲染 `Analyzing...` 的条件改为 `analyzingIds.has(currentImage.id)`；渲染结果的条件改为 `currentImage.analysis != null`（不依赖独立的 lastResult 字段）。
4. **AI 角标同步**：解析成功后，确保该 image record 的 `hasAnalysis` / `analysis` 字段已更新，并触发列表重渲染（如果用 store，dispatch 一次 `imageUpdated`；如果用本地 state，调用 `loadImages()` 或局部更新）。ImageGrid 角标基于此字段渲染。

**验收标准**：
- [ ] A 开始解析 → 切到 B（未解析）→ 右栏显示 `Analyze prompt`，不继承 `Analyzing...`。
- [ ] A 解析在 B 时刻完成 → B 右栏不变化，A 数据已落库。
- [ ] 切回 A → 显示已解析结果。
- [ ] A 在网格中出现 AI 角标（与批量解析后的样式一致）。
- [ ] 至少手动验证一次"A 解析中 → 切 B → A 完成 → 切回 A"完整序列。

---

### T7 · #5 拖拽事件类型守卫

**关键文件**：
- [src/components/layout/ImageGrid.tsx](../src/components/layout/ImageGrid.tsx)（dropzone）
- [src/components/detail/ChatPanel.tsx](../src/components/detail/ChatPanel.tsx) 或 Chat 标签组件（grep `Chat` 标签拖拽）
- 桌面端 Tauri 文件拖拽监听（如有）

**执行步骤**：
1. ImageGrid 的 `onDragEnter` `onDragOver` 入口加守卫：
   ```ts
   if (!Array.from(e.dataTransfer.types).includes('Files')) return;
   ```
   未通过守卫时不调用 `setShowDropOverlay(true)`。
2. Chat 标签拖拽组件的 drag handler 显式 `e.stopPropagation()`，防止冒泡到外层 dropzone。
3. 确认网页端与桌面端两路径都生效（Tauri 文件拖拽走单独事件，需要分别处理）。

**验收标准**：
- [ ] 拖动 Chat 问题标签可正常排序，行为与网页端一致。
- [ ] 拖动 Chat 标签时图库不显示 `Drop images here to import`。
- [ ] 拖入真实图片文件 → 图库正常出现导入提示并能完成导入。
- [ ] 拖动应用内任意非文件 UI（文本、按钮等）→ 图库不响应。
- [ ] 桌面端、Web 端各验证一遍。

---

## Wave 4 — 视觉/布局

**前置依赖**：Wave 3 已合入。

**分支**：`fix/wave-4-visual`

### T8 · #1 收起态 logo + 图库网格重排

**关键文件**：
- [src/components/layout/Sidebar.tsx](../src/components/layout/Sidebar.tsx)
- 品牌资源目录 `branding/`、`src/components/web/` 中的 Logo 组件
- [src/hooks/useGridDimensions.ts](../src/hooks/useGridDimensions.ts)
- [src/components/layout/ImageGrid.tsx](../src/components/layout/ImageGrid.tsx)
- 可能涉及 [src/components/layout/ThreeColumnLayout.tsx](../src/components/layout/ThreeColumnLayout.tsx)

**执行步骤**：

**Part A · 收起态 logo**：
1. 找到 Sidebar 收起态 logo 渲染位置（条件：`isCollapsed === true`）。
2. 替换为新版 Snaplex 品牌图标（与 Wave 2 About 页同源资源）。
3. 桌面端展开/收起切换检查品牌一致性。

**Part B · 图库网格重排**：

**复现条件**（由用户提供）：
- 应用窗口最大化时
- 展开/收起左侧栏时
- 展开/收起右侧栏时

这三个场景下出现：图片卡片重叠；列间距不固定。

**根因排查方向**（按可能性高到低）：
1. `useGridDimensions` 的 `ResizeObserver` 在 CSS transition 期间被节流，最终尺寸与渲染尺寸不一致 → 监听 transitionend 事件触发再算一次；或用 `requestAnimationFrame` 双重确认。
2. ImageGrid 的渲染层（很可能用 `@tanstack/react-virtual`）拿到旧 `cellSize` 计算 `top` 偏移，新 `cellSize` 只更新了宽度 → 给 virtualizer 传 `key={cellSize}` 强制重建；或使用 hook 返回的 `cellSize` 同时作为 `estimateSize` 与 `lanes` 的输入并 `measure()` 重测。
3. 瀑布流多列时图片高度异步加载，列高累加未在宽度变化后重置 → 在 cellSize 变化的 effect 里清空累加状态。

**执行**：
1. 用 `pnpm tauri:dev` 启动桌面端，按用户图示场景复现。
2. 在 React DevTools 或 console 里观察 `cellSize` / `width` 变化时机。
3. 优先尝试方案 1（transitionend 监听 + `ResizeObserver` 双触发），不奏效再走方案 2/3。
4. 如果根因是虚拟化库的 stale cache，记录在 PR 里。

**验收标准**：
- [ ] 应用最大化、最小化、还原 → 网格无重叠、列距均匀。
- [ ] 展开/收起左侧栏 → 网格无重叠、列距均匀。
- [ ] 展开/收起右侧栏 → 网格无重叠、列距均匀。
- [ ] 滚动、搜索、筛选、刷新后布局仍正确。
- [ ] 收起态 Sidebar logo 为新版品牌图标。
- [ ] 用户提供的图1 场景手动复测通过。
- [ ] 增加一条手动测试清单或 vitest 用例覆盖核心计算逻辑。

---

## Wave 5 — HITL 讨论项

**前置依赖**：Wave 4 已合入。Wave 5 内三个任务**互不依赖**，可并行推进。

### T9 · #3 小红书右键发送

**HITL 流程**：
1. **第一阶段（产出文档）**：
   - 在 [extension/](../extension/) 装载状态下复现：
     - 小红书图片详情页右键场景
     - 信息流图片右键场景
   - 记录拦截方式（站点 contextmenu preventDefault？元素事件冒泡拦截？）。
   - 撰写 `docs/discovery/xhs-context-menu.md`，包含：
     - 复现步骤 + 错误现象
     - 至少 2 套技术方案（推荐：A. content script 注入 hover 浮按钮；B. 区域截图 fallback）
     - 每套方案的：实现要点、保留语义（原图 / 页面 URL / 图片 URL）、降级元数据
     - 推荐选项 + 理由
   - **不要进入实现**。在对应 issue 评论 @ 用户拍板。
2. **第二阶段（实现）**：用户拍板后开实现 PR。

**第二阶段验收（拍板后）**：参照 issue #3 原始 acceptance criteria。

---

### T10 · #4 视频取帧站点矩阵

**HITL 流程**：
1. **第一阶段（产出文档）**：
   - 复现矩阵：YouTube ✓ / Twitter-X / Bilibili / TikTok。每站点记录失败的 console error、视频元素结构（`<video>` 直链 / blob URL / MSE / DRM）、跨域属性。
   - 失败原因分类：跨域 canvas taint、blob URL 无 crossOrigin、MSE/EME、iframe/Shadow DOM、站点事件拦截。
   - 撰写 `docs/discovery/video-frame-extract-matrix.md`，含：
     - 矩阵表（站点 × 失败原因）
     - 至少 3 套技术路线对比：A. 改进视频元素取帧；B. 区域截图裁剪视频区域；C. 按站点组合
     - 推荐选项（基于初步判断：除 YT 外统一改区域截图）
     - 红线：不绕过 DRM/受保护内容
   - **不要进入实现**。在 issue #4 评论 @ 用户拍板。
2. **第二阶段（实现）**：用户拍板后开实现 PR。

**第二阶段验收（拍板后）**：参照 issue #4 原始 acceptance criteria。

---

### T11 · #12 XLS 导入修通

**重要前置**：用户已确认目标格式 = 旧 Snaplex 自有导出（也是通用 Excel 格式）。**列结构固定**：

| 列 | 内容 |
|---|---|
| A | Image（嵌入图片缩略图）|
| B | Front Prompt（英文，6 段：`[SUBJECT]` `[ENVIRONMENT]` `[COMPOSITION]` `[LIGHTING]` `[MOOD]` `[STYLE]`，每段一段文字）|
| C | Back Prompt（中文，同 6 段结构）|

行 1 为表头：`Image` / `Front Prompt` / `Back Prompt`。每张图片占多行（包含 6 个分段）。

**关键文件**：
- [src/utils/importLegacy.ts](../src/utils/importLegacy.ts)
- [src/utils/importHistory.ts](../src/utils/importHistory.ts)（`parseExportedFile`）
- [src/components/layout/ImageGrid.tsx](../src/components/layout/ImageGrid.tsx) `handleImportXLS`（约 823 行）
- Rust 后端 IPC `import_legacy_item` (`src-tauri/` 下 grep)

**执行步骤**：

**Stage 1 · 端到端诊断**：
1. 用图2 同格式的 XLS 文件本地试跑 `handleImportXLS`。
2. 在 `parseExportedFile` 与 `import_legacy_item` 两端打日志，定位失败点：
   - 是 parseExportedFile 返回空数组（解析失败）？
   - 是 IPC `import_legacy_item` 报错（后端不存在或字段不匹配）？
   - 是写库后图库未刷新？
3. 把诊断结论写入 PR description。

**Stage 2 · 修复**：
- 若解析层失败：扩展 `parseExportedFile` 兼容图2 格式：
  - 解析嵌入图（xlsx 用 `xlsx` 或 `exceljs` 库读 `media/`）。
  - 按行 group 把多行 6 段聚合为一条 prompt 记录。
  - Front Prompt 与 Back Prompt 都解析为结构化 `{ subject, environment, composition, lighting, mood, style }`；存为双语字段（如 `analysis.en` / `analysis.zh`）。
- 若 IPC 后端缺失或字段不匹配：补 Rust 端 `import_legacy_item` 实现 / 字段。
- 若刷新失败：Stage 4 处理。

**Stage 3 · 边界处理**：
- 嵌入图取不到 → 跳过该行图片，仅导入文本（toast 提示 N 条降级）。
- 重复行 → 按 image hash 去重。
- 缺字段 → 保留已有字段，不阻断整体。
- 错误条目计入 `result.failed` 并在 errors 中记录原因。

**Stage 4 · 反馈与刷新**：
- 完成后 toast：`已导入 N 项（M 项失败）` / `Imported N items (M failed)`，i18n 化。
- `await loadImages()` 刷新图库。

**验收标准**：
- [ ] 用与图2 同格式的 XLS 文件导入 ≥ 5 条记录，全部成功落入图库。
- [ ] 每条记录的图片、英文 prompt、中文 prompt 均正确显示在右栏。
- [ ] 网格中新导入图片显示 AI 角标（已分析状态）。
- [ ] 故意构造缺失字段、缺失图片、重复行的测试文件，导入流程不崩溃，按设计降级。
- [ ] Tooltip / 按钮可访问名称 i18n 化（与 Wave 2 一致）。
- [ ] 桌面端实测通过。

---

## 3. 验收回归清单（Wave 全部合入后）

完成所有 Wave 后，在主分支上跑一次回归：

- [ ] 所有 14 个 issue 的 acceptance criteria 全部勾选。
- [ ] `pnpm test` `pnpm build` 通过。
- [ ] 桌面端 + Web 端各跑一遍主流程：导入 → 浏览 → 分析 → Chat → 设置切换语言/主题。
- [ ] 中英文各一遍，dark/light 各一遍。

## 4. 给执行智能体的注意事项

- **不要扩大改动范围**：每个任务只改其涉及文件，不要顺手重构无关代码。
- **不要绕过 hooks/CI**：commit hook 失败先修复，不要 `--no-verify`。
- **HITL 任务不要直接跳到实现阶段**：T9/T10 必须先产出 discovery 文档等用户拍板。
- **PR 描述必须有截图/录屏**：UI 类改动无截图视为未完成。
- **遇到本文档与代码现实冲突**：以代码现实为准，并在 PR 中说明本文档需要更新的点。
