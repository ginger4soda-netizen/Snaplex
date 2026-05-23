# Snaplex 重构项目阶段性对话与执行记录 (Phase 1 & 2)

**日期**: 2026-03-22
**项目**: Snaplex Desktop (Tauri v2 + React)
**执行 Agent**: Agent B (UI/Layout) & Agent C (Search/Color)

---

## 1. 任务背景与目标
将原有的 Web SPA 版 Snaplex 重构为类 Eagle 的本地桌面应用。
- **Phase 1**: 实现三栏布局、文件夹树、图片网格及详情面板骨架。
- **Phase 2**: 实现混合搜索（FTS5 + CLIP）、增强色卡提取、Google 翻译集成及旧数据导入。

---

## 2. 执行历程与关键决策

### Phase 1: 布局与核心组件实现 (Agent B)
1.  **代码目录重构**: 
    - 将所有前端源码从根目录移动至 `src/`，并配置 Vite 别名 `@` 指向 `./src`。
    - 更新 `index.html` 入口路径。
2.  **核心 Hook 开发**:
    - `useTauriIPC`: 封装了 §5 定义的所有 Tauri 命令调用（Library, Folder, Image, Analysis, Search）。
    - `useTheme`: 支持 Light (`bg-cream`) 和 Dark (`bg-stone-900`) 主题切换。
3.  **三栏布局实现**:
    - **左栏 (Sidebar)**: 实现文件夹树 (FolderTree)，支持从后端动态获取目录结构。
    - **中栏 (ImageGrid)**: 实现虚拟滚动网格，集成搜索栏容器。
    - **右栏 (DetailPanel)**: 实现可折叠的 6 维度 AI 分析卡片、颜色条预览、Memo 记事本及 Chat 交互面板。
4.  **视觉规范**:
    - 统一使用内联 SVG 图标，避免外部库依赖。
    - 沿用 Eagle 风格，保持 240px / flex-1 / 380px 的典型桌面分布。

### Phase 2: 搜索与色卡增强 (Agent C 成果整合)
1.  **混合搜索集成**:
    - 引入 `SearchBar.tsx`，支持 FTS5 全文搜索与 CLIP 视觉向量搜索并行。
    - **融合排序算法**: 对 FTS (0.4)、Embedding (0.35)、CLIP (0.25) 进行加权评分，并对多路命中的结果进行 15% 的分值提升。
2.  **色卡 UI 升级**:
    - 实现 8 色比例展示，宽度根据颜色占比动态调整。
    - 支持 HEX/RGB/HSL 格式一键切换。
    - 增加 Hover 详情显示与点击复制反馈。
3.  **翻译与导入**:
    - 集成 Google Translate 服务，支持提示词卡片的离线/低成本翻译。
    - 实现 `importLegacy.ts`，兼容原 Web 版的 XLS 导出数据导入。

---

## 3. 文件变更清单

### 新增文件 (Frontend)
- `src/hooks/useTauriIPC.ts`
- `src/hooks/useTheme.ts`
- `src/components/layout/ThreeColumnLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/ImageGrid.tsx`
- `src/components/folders/FolderTree.tsx`
- `src/components/images/ImageCard.tsx`
- `src/components/detail/DetailPanel.tsx`
- `src/components/detail/ImagePreview.tsx`
- `src/components/detail/ColorPalette.tsx` (由 Agent C 增强)
- `src/components/detail/DimensionCards.tsx`
- `src/components/detail/MemoCard.tsx`
- `src/components/detail/ChatPanel.tsx`
- `src/components/search/SearchBar.tsx`
- `src/components/search/SearchResults.tsx`
- `src/services/tauriBridge.ts`
- `src/services/googleTranslate.ts`
- `src/utils/importLegacy.ts`

### 修改的共享文件
- `index.html`: 更新入口点。
- `vite.config.ts`: 更新别名配置。
- `src/types.ts`: 扩展了 Tauri 相关的接口定义。
- `src/App.tsx`: 切换为三栏布局主入口，保留 Web 模式兼容逻辑。

---

## 4. 下步计划 (Phase 3)
- **Agent D**: 启动浏览器插件开发，实现图片/视频截图的一键保存。
- **HTTP Server**: 在 Rust 端启动接口接收插件数据。
- **Eagle 导入**: 实现对 Eagle 库文件的物理结构解析与导入。

---
*记录生成于: 2026-03-22*
