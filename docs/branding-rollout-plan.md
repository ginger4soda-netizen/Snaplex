# Snaplex 蛇形 IP Logo 实施文档

> **状态：✅ 已落地（branch `feat/snake-ip-rebrand`，2026-05-06）**
> 全部 6 个阶段完成并提交。下一步为本地构建 + 安装新版桌面应用与扩展 — 见文末「下一步」。

> **目的**：把新设计的"绿色蛇形 S + 米白圆角底"logo 全面落地为 Snaplex 的 IP 形象，覆盖桌面端、浏览器扩展、Web UI 与发布素材。
> **决策记录**：
> - 品牌色：在现有 cream / sunny / coral / softblue / mint / dark 之外新增 **`mascot: '#4a6f50'`（深橄榄绿）** 作为第五品牌色，**仅用于与 mascot 相关的展示位**（空状态、引导插画、加载、强调标识）。常规 UI 控件继续沿用原有 4 色。
> - 实施过程曾考虑用 mascot 直接替换 mint，最终决定 **保留 mint + 新增 mascot 并存**：mint 仍服务于 Environment / Mood 等功能维度色（StylePrinter、AnalysisView、DimensionCards 仍在引用），mascot 专属于 IP 形象表达，两者语义清晰不冲突。
> - Logo 资产做两版：
>   - **full**：带米白圆角方形背景 — 用于应用图标、商店图、社交头像等"独立展示"场景。
>   - **mark**：透明背景，仅蛇身 S — 用于 sidebar、header、内嵌入按钮等"已有容器"场景。

---

## 总览：阶段依赖图

```
              ┌──────────────────────────────────────────┐
              │ P0 资产生成（阻塞所有下游执行）              │
              │  - 准备 full / mark 两版源文件                 │
              │  - 输出 branding/ 下所有派生尺寸               │
              └──────┬───────────┬───────────┬──────────┘
                     ↓           ↓           ↓
              ┌──────────┐ ┌──────────┐ ┌──────────────┐
              │ P2 桌面端  │ │ P3 扩展端 │ │ P4 Web 应用品牌位│
              │ Tauri 图标│ │ 图标+popup│ │ favicon+Logo组件│
              └────┬─────┘ └────┬─────┘ └──────┬───────┘
                   │            │              │
┌────────────┐     │            │              ↓
│ P1 品牌色   │─────┼────────────┼────→ ┌─────────────┐
│ tailwind   │     │            │      │ P5 Mascot 衍生│
└────────────┘     │            │      │ 空状态/加载等 │
                   │            │      └──────┬──────┘
                   ↓            ↓             ↓
              ┌─────────────────────────────────────┐
              │ P6 发布素材重制（截图、商店图、宣传图）│
              └─────────────────────────────────────┘
```

**并行调度建议**：
- 第一批（串/并行同时启）：**P0**（必须先动） + **P1**（独立，不依赖 P0）
- 第二批（P0 完成后并发三路）：**P2 / P3 / P4** 互不冲突，可同时跑
- 第三批：**P5**（依赖 P1+P4） — 并发到收尾即可
- 第四批：**P6**（依赖 P2+P3+P4） — 最后做

---

## Phase 0 — 品牌资产生成（阻塞） ✅ 已完成

### 目标
在仓库里建立单一可信源 `snaplex/branding/`，并产出所有下游需要的派生资产。

### 输入
- 已有源文件：[snaplex/snaplex-logo.png](../snaplex-logo.png)（1254×1254，RGB，**无 alpha 通道**）

### 输出（必须全部生成）

```
snaplex/branding/
├── source/
│   ├── snaplex-mascot-full-1024.png       # 带米白底圆角方形，1024×1024，RGBA
│   └── snaplex-mascot-mark-1024.png       # 透明背景仅蛇身 S，1024×1024，RGBA
├── exports/
│   ├── full/                              # 多尺寸 full 版
│   │   ├── 16.png  32.png  48.png  64.png
│   │   ├── 128.png  256.png  512.png  1024.png
│   ├── mark/                              # 多尺寸 mark 版
│   │   ├── 24.png  32.png  48.png  64.png  128.png  256.png
│   └── favicon/
│       ├── favicon.ico                    # 16/32/48 三层
│       ├── favicon-32.png
│       └── apple-touch-icon-180.png
└── README.md                              # 资产索引与命名约定
```

### 关键步骤

1. **拷贝源文件**：把 `snaplex/snaplex-logo.png` → `snaplex/branding/source/snaplex-mascot-full-1024.png`，并用 sharp 缩放到 1024×1024 同时补 alpha 通道。

2. **生成 mark 版（透明背景）**：源文件无 alpha，需用色彩抠图。建议方案：
   - 使用 `sharp` + `flatten` 反向操作不可行；改用 Node 脚本逐像素扫描，把奶白色（约 RGB ≈ 245,243,232 ± 阈值 12）的像素 alpha 设为 0；
   - 或更稳的方案：让用户在 Figma / Photoshop 里手动导出一份透明版，放到 `snaplex/branding/source/snaplex-mascot-mark-1024.png`。
   - **优先尝试脚本，若边缘出现锯齿/残影则提示用户提供手工版**。

3. **写生成脚本** `snaplex/scripts/generate-branding.mjs`：用 `sharp` 一次性输出 `exports/` 下所有尺寸；ico 用 `to-ico` 包；脚本要 idempotent（重复跑不报错）。

4. **依赖安装**：`pnpm add -D sharp to-ico` （若已有则跳过）。

### 验证
- [ ] `node snaplex/scripts/generate-branding.mjs` 无报错跑通
- [ ] `branding/exports/` 下所有文件存在且非 0 字节
- [ ] mark 版用图片查看器打开，背景为透明（棋盘格可见）
- [ ] full 版 1024×1024 在 macOS Finder 大图预览下，圆角清晰、无白边

### 不要做
- 不要替换 `src-tauri/app/icons/` 或 `extension/icons/` —— 那是 P2/P3 的事
- 不要改 tailwind 配置 —— 那是 P1 的事

### 给 agent 的自包含 prompt
> 在 `snaplex/` 目录下建立品牌资产中心。源文件是 `snaplex/snaplex-logo.png`（1254×1254 RGB 无 alpha 的绿色蛇形 S 图标）。需要产出：
> 1. `snaplex/branding/source/snaplex-mascot-full-1024.png`：缩到 1024×1024，加 alpha 通道
> 2. `snaplex/branding/source/snaplex-mascot-mark-1024.png`：把奶白色背景抠成透明，只留蛇身
> 3. `snaplex/branding/exports/full/{16,32,48,64,128,256,512,1024}.png`
> 4. `snaplex/branding/exports/mark/{24,32,48,64,128,256}.png`
> 5. `snaplex/branding/exports/favicon/{favicon.ico, favicon-32.png, apple-touch-icon-180.png}`
> 6. `snaplex/scripts/generate-branding.mjs`：可重复执行的生成脚本（用 sharp + to-ico）
> 7. `snaplex/branding/README.md`：说明命名约定、何时用 full / 何时用 mark
>
> 抠背景的颜色阈值要保守（RGB(245,243,232)±12），出现毛边时优先保留蛇身完整性而非彻底去白。
> 完成后跑一次脚本验证 idempotent，并截图一张 mark 版透明背景的预览。

---

## Phase 1 — Tailwind 品牌色扩展（独立） ✅ 已完成

### 目标
新增 `mascot: '#4a6f50'` 作为第五品牌色。**最终采用并存方案**（保留 `mint`），原因：StylePrinter / AnalysisView / DimensionCards 仍在用 `text-mint` / `bg-mint` 表达 Environment / Mood 维度色，与 mascot 的 IP 语义不应混用。

### 输入
- [snaplex/tailwind.config.js](../tailwind.config.js)（现有 cream / sunny / coral / softblue / mint / dark）

### 输出
```js
colors: {
    cream: '#FFFDF5',
    dark: '#2D2D2D',
    sunny: '#FFD166',
    coral: '#EF476F',
    softblue: '#118AB2',
    mint: '#06D6A0',
    mascot: '#4a6f50',  // 新增
}
```

### 验证
- [ ] `pnpm dev` 启动无报错
- [ ] 在任意组件临时加 `<div className="bg-mascot text-cream">test</div>` 能渲染出深橄榄绿
- [ ] 验证完删除测试代码

### 不要做
- 不要改其他颜色的值
- 不要把 `mascot` 用到现有组件 —— 那是 P5 的事

### 给 agent 的自包含 prompt
> 在 `snaplex/tailwind.config.js` 的 `theme.extend.colors` 里新增 `mascot: '#4a6f50'`。这是为 Snaplex 蛇形 IP 形象准备的第五品牌色。其他配色不要动。改完起一次 `pnpm dev` 验证不报错。

---

## Phase 2 — 桌面端 Tauri 图标替换（依赖 P0） ✅ 已完成

### 目标
替换 [snaplex/src-tauri/app/icons/](../src-tauri/app/icons/) 下全部 17 个图标文件。

### 输入
- `snaplex/branding/source/snaplex-mascot-full-1024.png`（来自 P0）
- [snaplex/src-tauri/app/tauri.conf.json](../src-tauri/app/tauri.conf.json)（无需修改，仅作引用确认）

### 推荐路径
**优先用 Tauri 官方 CLI 一键生成**，比手写尺寸列表更可靠：
```bash
cd snaplex/src-tauri
cargo tauri icon ../branding/source/snaplex-mascot-full-1024.png
```
这会一次性覆盖：`32x32.png` / `128x128.png` / `128x128@2x.png` / `icon.icns` / `icon.ico` / 全部 9 个 `Square*Logo.png` / `StoreLogo.png` / `icon.png`。

如果 `cargo tauri` 不可用，回退到手工方案：用 sharp 生成所有 PNG 尺寸 + `png2icns`/`to-ico` 生成 icns/ico。

### 验证
- [ ] 17 个图标文件 mtime 都已更新
- [ ] `pnpm tauri build`（或 `cargo tauri build --debug`）能产出 dmg/msi，且 Finder/资源管理器里显示新 logo
- [ ] macOS Dock 与 Windows 任务栏图标在小尺寸下仍可辨识（蛇 + S 形清晰）

### 不要做
- 不要改 `tauri.conf.json` —— 文件名引用没变
- 不要碰 `extension/` 或 `src/`

### 给 agent 的自包含 prompt
> 替换 Snaplex 桌面端（Tauri）所有应用图标。源文件位于 `snaplex/branding/source/snaplex-mascot-full-1024.png`（绿蛇 S + 米白圆角底，1024×1024 RGBA）。
> 优先方法：`cd snaplex/src-tauri && cargo tauri icon ../branding/source/snaplex-mascot-full-1024.png`，会自动覆盖 `src-tauri/app/icons/` 下全部 17 个文件（PNG 系列 + icon.icns + icon.ico + Square*Logo.png 系列）。
> 若 cargo tauri 不可用，回退为 sharp + to-ico 手工生成（参考 `tauri.conf.json` 中 icon 字段列出的尺寸清单）。
> 完成后跑一次 debug 构建验证图标已嵌入。

---

## Phase 3 — 浏览器扩展图标 + popup（依赖 P0） ✅ 已完成

### 目标
1. 替换 [snaplex/extension/icons/](../extension/icons/) 下图标，**借机补齐 16 / 48 尺寸**
2. 更新 [extension/manifest.json:23-26](../extension/manifest.json#L23-L26) 引用
3. 给 [extension/popup.html:140](../extension/popup.html#L140) 的 h1 前加 mascot 小图

### 输入
- `snaplex/branding/exports/full/{16,32,48,128}.png`（来自 P0）
- `snaplex/branding/exports/mark/24.png`（用于 popup header）

### 改动列表
1. **复制图标**：`branding/exports/full/{16,32,48,128}.png` → `extension/icons/{16,32,48,128}.png`
2. **manifest.json**：扩展 icons 字段为 `{ "16":..., "32":..., "48":..., "128":... }`
3. **popup.html**：
   - 把 mark/24.png 复制到 `extension/icons/popup-logo.png`（24×24）
   - 在 `<h1>Snaplex</h1>` 前插入 `<img src="icons/popup-logo.png" alt="" width="24" height="24" />`
   - 适当调 header flex 间距

### 验证
- [ ] Chrome `chrome://extensions/` 加载 unpacked，工具栏图标为新 logo
- [ ] 点击扩展图标，popup 顶部显示绿蛇 + "Snaplex" 文字
- [ ] manifest.json 通过 Chrome 校验无 warning

### 不要做
- 不要改 `popup.js` 或 `background.js`
- 不要改 popup 的现有功能/按钮

### 给 agent 的自包含 prompt
> 给 Snaplex 浏览器扩展换 logo。新资产由 P0 阶段产出：
> - `snaplex/branding/exports/full/{16,32,48,128}.png` → 复制为 `snaplex/extension/icons/{16,32,48,128}.png`
> - `snaplex/branding/exports/mark/24.png` → 复制为 `snaplex/extension/icons/popup-logo.png`
> 改 `snaplex/extension/manifest.json` 的 `icons` 字段，从只有 32/128 扩展为 16/32/48/128 四档。
> 改 `snaplex/extension/popup.html`：在 `<h1>Snaplex</h1>` 元素前插入 `<img src="icons/popup-logo.png" alt="" width="24" height="24" />`，并把 header 的 flex 布局调成 logo + 标题 + 状态徽标三栏。
> 不要动 popup.js 或 background.js。

---

## Phase 4 — Web 应用品牌位（依赖 P0） ✅ 已完成

### 目标
在 React 应用内统一用上新 logo，并新建可复用 Logo 组件。

### 输入
- `snaplex/branding/exports/mark/{32,64,128}.png`（sidebar/header 嵌入用）
- `snaplex/branding/exports/full/256.png`（社交分享卡用）
- `snaplex/branding/exports/favicon/*`（浏览器 tab）

### 改动列表

1. **资产复制到 public**：把 `branding/exports/favicon/*` 复制到 `snaplex/public/`（让 vite 直接走根路径）。
   - `public/favicon.ico`
   - `public/favicon-32.png`
   - `public/apple-touch-icon.png`
   - `public/snaplex-mascot.png`（mark/256.png）

2. **更新 [snaplex/index.html](../index.html) head**，在 `<title>` 后加：
   ```html
   <link rel="icon" type="image/x-icon" href="/favicon.ico" />
   <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
   <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
   ```

3. **新建 [snaplex/src/components/shared/Logo.tsx](../src/components/shared/Logo.tsx)**：
   ```tsx
   type Variant = 'mark' | 'full';
   type Props = { variant?: Variant; size?: number; className?: string; alt?: string };
   // mark → /snaplex-mascot.png（透明）
   // full → /favicon-32.png 或 import full 大图
   ```
   暴露三种用法：单图（mark）、单图（full）、wordmark（图 + 文字）。

4. **替换 [snaplex/src/components/layout/Sidebar.tsx:281](../src/components/layout/Sidebar.tsx#L281)**：
   - 删掉 `<div className="w-8 h-8 bg-blue-600 rounded-lg ...">S</div>` 占位
   - 替换为 `<Logo variant="mark" size={32} />`

5. **更新 [snaplex/src/components/web/Header.tsx:30-37](../src/components/web/Header.tsx#L30-L37)**：
   - Mobile header 的"Snaplex"白底框前面加 `<Logo variant="mark" size={24} />`，保留原有 wordmark 风格不要破坏 shadow-pop 效果

### 验证
- [ ] 浏览器 tab 显示新 favicon
- [ ] `pnpm dev` 启动，sidebar 顶部、移动 header 都换成蛇 logo
- [ ] 暗色模式下 mark 透明背景与 sidebar 背景融合不冲突（深绿在 dark:bg-stone-900 上仍可辨识，必要时给一个浅色描边）
- [ ] Logo 组件被 sidebar 与 header 同时复用，没有图片路径硬编码散落他处

### 不要做
- 不要改 Header.tsx 的 desktop 文字 wordmark（line 91-98 的"Archivo Black"风格）—— 那是文字 wordmark，与图形 mark 是不同表达
- 不要碰 Sidebar 折叠状态的图标（line 270 那个圆形小按钮）—— 那是导航控件不是 logo

### 给 agent 的自包含 prompt
> 给 Snaplex Web 应用接入新 IP 图标。
> **资产前置**：从 `snaplex/branding/exports/` 复制以下文件到 `snaplex/public/`：
> - `favicon/favicon.ico` → `public/favicon.ico`
> - `favicon/favicon-32.png` → `public/favicon-32.png`
> - `favicon/apple-touch-icon-180.png` → `public/apple-touch-icon.png`
> - `mark/256.png` → `public/snaplex-mascot.png`
>
> **改动 1**：在 `snaplex/index.html` 的 `<title>` 后添加三个 `<link rel="icon">` 标签（favicon.ico / 32px / apple-touch-icon）。
>
> **改动 2**：新建 `snaplex/src/components/shared/Logo.tsx`，导出一个 `<Logo variant="mark"|"full" size={n} className?/>` 组件，从 `/snaplex-mascot.png` 取图。`full` 变体可暂时用同一张（后续 P5 再扩展）。
>
> **改动 3**：在 `snaplex/src/components/layout/Sidebar.tsx` 第 281 行，把 `<div className="w-8 h-8 bg-blue-600 rounded-lg ...">S</div>` 占位替换为 `<Logo variant="mark" size={32} />`。
>
> **改动 4**：在 `snaplex/src/components/web/Header.tsx` 移动 header 的 logo 区（第 30-37 行）的 `<h1>Snaplex</h1>` 前插入 `<Logo variant="mark" size={24} />`，保留 shadow-pop 卡片造型。**不要碰 desktop header（line 78 之后）**，desktop 用的是 Archivo Black 文字 wordmark，要保留。
>
> 完成后 `pnpm dev` 自查：tab favicon、sidebar、移动 header 都已换成绿蛇。

---

## Phase 5 — Mascot 衍生展示位（依赖 P1 + P4） ✅ 已完成

### 目标
把蛇 IP 形象用到空状态、加载、引导等情感化表达位，扩大 IP 触达。

### 前置条件
- P1 完成：`bg-mascot text-mascot border-mascot` 等 utility 可用
- P4 完成：`<Logo />` 组件已建立

### 改动列表（可拆子任务给独立 agent）

1. **空 library 状态**：搜索 [snaplex/src/components/](../src/components/) 中渲染空列表的位置（`Library is empty` / `No images yet` 一类文案），在文案上方放 `<Logo variant="mark" size={96} />` + mascot 色描述文字。

2. **扩展 popup `Connecting...` 状态**：[extension/popup.html](../extension/popup.html) 的 `.status[data-tone="connecting"]`，把背景从 `#fff1c7` 改为 mascot 色淡化版（如 `#e9efe7`），保留可读性。

3. **首次连接引导卡**：若有 onboarding 组件，在 hero 区放一个 `<Logo variant="full" size={128} />` + 友好欢迎语。

4. **加载态吉祥物**：评估是否替换 [snaplex/src/components/web/CrabProgressBar.tsx](../src/components/web/CrabProgressBar.tsx) — 这是螃蟹角色，可能要保留作为另一只 IP 伙伴，**不要直接覆盖，先和用户确认**。

### 验证
- [ ] 至少 1 处空状态用上 mascot
- [ ] mascot 色仅出现在 IP 相关位置，未污染常规按钮/链接

### 不要做
- 不要替换 CrabProgressBar 等已有角色 —— 先保留共存
- 不要在导航/按钮等高频 UI 控件上用 mascot 色

### 给 agent 的自包含 prompt
> 把 Snaplex 的蛇 IP 形象延伸到情感化展示位。前提：P1（tailwind `mascot: #4a6f50` 已加）和 P4（`<Logo />` 组件已存在于 `src/components/shared/Logo.tsx`）已完成。
> 任务：
> 1. 在 `snaplex/src/components/` 下找到所有渲染空状态/empty placeholder 的位置（grep `empty|no\s+result|nothing yet|未找到|空`），至少给 1-2 处加上 `<Logo variant="mark" size={96} />` + 用 `text-mascot` 颜色的友好提示。
> 2. 修改 `snaplex/extension/popup.html` 的 `.status[data-tone="connecting"]` 配色，背景换成 mascot 色淡版（如 `#e9efe7`），文字保持可读对比度。
> 3. **不要**碰 `CrabProgressBar.tsx`，那是另一只角色，等用户确认是否替换。
> 4. **不要**把 mascot 色用到导航、按钮等常规控件 —— 仅用于 IP 相关展示位。
> 完成后 `pnpm dev` 自查空状态视觉。

---

## Phase 6 — 发布素材重制（依赖 P2 + P3 + P4） ✅ 已完成

### 目标
把 Chrome Web Store / 桌面分发渠道的所有上架素材按新 logo 重出。

### 输入
- 已替换好图标的应用（P2 出 dmg/msi、P3 出扩展 zip）
- [snaplex/docs/release-assets/](.) 现有素材清单与规格

### 改动列表

1. **截图全部重出**：参考 [docs/release-assets/screenshot-checklist.md](release-assets/screenshot-checklist.md) 列表，在新 logo 应用上重新截图（sidebar、settings、empty state 等）。

2. **Chrome Web Store 宣传图**：按 Webstore 规格出图：
   - Small tile: 440×280
   - Large promo: 920×680 / 1400×560
   - Marquee: 1400×560
   主视觉用 `branding/exports/full/512.png` 作为 hero。

3. **更新 store-listing**：
   - [docs/release-assets/store-listing-en.md](release-assets/store-listing-en.md)
   - [docs/release-assets/store-listing-zh.md](release-assets/store-listing-zh.md)
   若文案里有"图标 / icon"描述需同步。

4. **README hero**：[snaplex/README.md](../README.md) 顶部加新 logo banner（如果原本就有 logo 的话）。

### 验证
- [ ] 所有截图中应用图标、扩展图标都是新 logo
- [ ] Webstore 规格图通过 Chrome Developer Dashboard 上传校验
- [ ] README 在 GitHub 渲染正常

### 不要做
- 不要改 store listing 的功能/价值描述（除非涉及 logo / 视觉描述）
- 不要在没有 P2/P3/P4 完成的情况下提前出图

### 给 agent 的自包含 prompt
> Snaplex 已经替换了应用图标（P2）、扩展图标（P3）、Web 内品牌位（P4），现在重制发布素材。
> 任务：
> 1. 按 `snaplex/docs/release-assets/screenshot-checklist.md` 列表，在新版应用上重新截图，覆盖原 `docs/release-assets/` 下的截图（如果有）。
> 2. 出 Chrome Web Store 上架图：440×280、920×680、1400×560 三档，hero 用 `snaplex/branding/exports/full/512.png`，背景配色用 cream / mascot 双色。输出到 `snaplex/docs/release-assets/promo/`。
> 3. 检查 `docs/release-assets/store-listing-{en,zh}.md`，如有 logo / 图标视觉描述同步更新。
> 4. 在 `snaplex/README.md` 顶部加 logo banner（用 `branding/exports/full/256.png`）。
> 不要改文案的功能描述。

---

## 附录 A：执行节奏建议

| 时段 | 并行 agent | 备注 |
|---|---|---|
| T+0 | **P0**（主） + **P1**（小） | P1 5 分钟内可完成 |
| T+P0 完成 | **P2** ‖ **P3** ‖ **P4** | 三路并行，无文件冲突 |
| T+P4 完成 | **P5** | 也需要 P1 |
| T+P5 收尾 | **P6** | 最后一波 |

## 附录 B：文件冲突表（验证并行安全）

| Phase | 写入路径 | 与其他 Phase 重叠？ |
|---|---|---|
| P0 | `snaplex/branding/**`, `snaplex/scripts/generate-branding.mjs` | 无 |
| P1 | `snaplex/tailwind.config.js` | 无 |
| P2 | `snaplex/src-tauri/app/icons/**` | 无 |
| P3 | `snaplex/extension/icons/**`, `extension/manifest.json`, `extension/popup.html` | 无 |
| P4 | `snaplex/public/favicon*`, `public/snaplex-mascot.png`, `index.html`, `src/components/shared/Logo.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/web/Header.tsx` | 无（与 P5 不同文件） |
| P5 | `extension/popup.html` (CSS 部分) **, 多个 empty-state 组件文件 | ⚠️ 与 P3 同文件不同区域，建议 **P3 完成后再启 P5** |
| P6 | `docs/release-assets/**`, `README.md` | 无 |

> **注**：P5 改 popup.html 的 `.status[data-tone="connecting"]` CSS，与 P3 改的 `<header>` HTML 不冲突，但同文件并发写入会出 merge 冲突 —— 让 P5 在 P3 完成后启动。

## 附录 C：回滚预案

- 所有图标替换前，原文件已在 git 里（即便没 git，也建议 P0 阶段先把现存的 `src-tauri/app/icons/` 和 `extension/icons/` 整体复制一份到 `snaplex/branding/legacy/` 备份）。
- tailwind 新增颜色不影响现有 UI（不改原色）。
- `<Logo />` 组件被替换的位置，git diff 可逐处回退。

---

## 落地总结（2026-05-06）

- 分支：`feat/snake-ip-rebrand`，从 `feat/browser-extension` 切出
- 提交粒度：P0 / P1 / P2 / P3+P5(popup) / P4+P5(empty state) / P6 共 6 个 commit
- 与计划的偏差：
  - **P1 决策修订**：原计划 "用 mascot 替换 mint"，最终选 "并存"（保留 mint 作为 Environment/Mood 维度色，避免 4 处源码引用失效）
  - **P5 popup 改色**与 P3 popup 改 header 同文件、同次执行，故合并到一个 commit
  - **CrabProgressBar** 按计划保留，未替换
- 资产落点速查：
  - 应用图标源：`branding/source/snaplex-mascot-full-1024.png`
  - Web 运行时引用：`/snaplex-mascot.png`（mark）/ `/snaplex-mascot-full.png`（full）
  - 扩展弹窗 logo：`extension/icons/popup-logo.png`
  - 重新生成派生图：`node scripts/generate-branding.mjs`

## 下一步（手工部署）

桌面端与扩展的旧版本仍在你机器上跑，需要构建并安装新版本：

### 1. 桌面应用（Tauri）

```sh
cd snaplex
pnpm tauri build         # 出 dmg / msi 到 src-tauri/target/release/bundle/
# 或快速看效果：
pnpm tauri dev           # 开发模式，热重载
```

macOS：双击 `src-tauri/target/release/bundle/dmg/Snaplex_<version>_*.dmg`，把 Snaplex.app 拖到 Applications。**先把旧的 Snaplex.app 删掉**，否则 Dock 图标缓存可能仍是旧 logo（极端情况下还要 `killall Dock`）。

### 2. 浏览器扩展

```sh
cd snaplex/extension
pnpm build               # 输出到 extension/dist/
```

Chrome：
1. 打开 `chrome://extensions/`，移除旧 Snaplex 扩展
2. 开发者模式 → "加载已解压的扩展程序" → 选 `snaplex/extension/dist/`
3. 工具栏图标应为绿蛇，点开 popup 顶部 logo + 标题，连接中状态淡绿色背景

### 3. Native Messaging 桥（如果重装了桌面 app 或扩展 ID 变了）

```sh
cd snaplex
scripts/install-dev-manifest.sh \
  --bridge src-tauri/target/debug/snaplex-bridge \
  --ext-id <新扩展ID>
```

### 4. 验收清单
- [ ] macOS Dock / Windows 任务栏显示绿蛇图标
- [ ] 浏览器工具栏显示绿蛇图标
- [ ] Web tab favicon 显示绿蛇
- [ ] 桌面 sidebar 顶部、移动 header 卡片是绿蛇 mark
- [ ] 空 library 状态出现 96px mascot + mascot 色文案
- [ ] 扩展 popup 顶部 logo + 标题排版正常，连接中状态背景为淡绿

完成后建议合并 `feat/snake-ip-rebrand` → 主开发分支。
