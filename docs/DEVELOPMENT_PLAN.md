# Snaplex 桌面应用开发计划

> 最后更新：2026-03-22

## 项目目标

将 Snaplex 从纯 Web SPA 转型为类 Eagle 的本地桌面图库管理应用：三栏布局、本地存储、语义搜索、色卡提取、浏览器插件。

---

## 已确认决策

| 项 | 决策 |
|----|------|
| 桌面框架 | **Tauri v2** + GitHub Releases 自动更新 |
| 搜索方案 | **混合搜索**：FTS5 + API Text Embedding + 本地 CLIP 视觉向量 |
| Text Embedding | 纯 API（用户已有 key，费用极低，导入时缓存，搜索不消耗） |
| 视觉搜索 | CLIP ViT-B-32 INT8（153MB，随 App 打包，~10ms/张） |
| 文件夹 | Obsidian 式双向文件系统同步 |
| 一图多文件夹 | 主文件夹存物理文件 + 其他文件夹 symlink |
| 色卡 | K-means 聚类，默认 8 色，用户可配 |
| 翻译 | 提示词卡片背面用 Google Translate 免费 API |
| 多图库 | 支持多个 `.snpx` 库文件夹 |
| Provider | Gemini / OpenAI / Claude / SiliconFlow 全保留 |
| 右键菜单 | 复制 / 下载 / 打开文件夹 / 分析 / 移动 |
| 按需分析 | 单图：按维度刷新；多图：功能菜单批量操作 |
| 主题 | Light（沿用网页端）+ Dark |
| Schema | 预留 `asset_type` 为多模态做准备 |
| Changelog | Conventional Commits + release-please 自动生成 |
| 插件 | Chrome 优先 |
| Eagle 导入 | Phase 3 |

---

## 架构总览

```
┌─────────────────────────────────────────────────┐
│                 Tauri Desktop App                │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ React UI │←→│ Tauri IPC│←→│ Rust Backend  │  │
│  │ 三栏布局  │  │ Commands │  │ SQLite+FTS5   │  │
│  └──────────┘  └──────────┘  │ 文件系统       │  │
│                               │ CLIP (本地)    │  │
│                               │ HTTP Server    │  │
│                               └───────────────┘  │
└─────────────────────────────────────────────────┘
        ↑                              ↑
   浏览器插件                    AI API (分析/Embed)
  POST localhost              Gemini/OpenAI/Claude/SF
```

---

## 三栏布局设计

```
┌─────────────┬────────────────────────┬──────────────────┐
│  文件夹导航   │  ┌─ 搜索栏 ────────┐  │  图片详情          │
│             │  └─────────────────┘  │                  │
│ 📁 全部图片   │  🖼️ 🖼️ 🖼️ 🖼️ 🖼️      │  [🖼️ 预览]       │
│ 📁 收藏      │  🖼️ 🖼️ 🖼️ 🖼️ 🖼️      │  [── 色卡 8色 ──] │
│ 📁 项目 A   │  🖼️ 🖼️ 🖼️ 🖼️ 🖼️      │  [── 来源链接 ──]  │
│  └ 子文件夹  │                      │  [▶ Subject    ]  │
│ 📁 项目 B   │  ← 拖拽上传区域       │  [▶ Environment]  │ 可折叠
│             │  ← 右键菜单           │  [▶ Composition]  │
│─────────────│                      │  [▶ Lighting   ]  │
│ 🔧 Tools    │                      │  [▶ Mood       ]  │
│  🖨️ 打印机   │                      │  [▶ Style      ]  │
│  🧩 更多...  │                      │  [── Memo ──]     │
└─────────────┴────────────────────────┴──────────────────┘
```

**中栏**：沿用现有图库网格样式，搜索栏在顶部，支持拖拽上传图片。点击图片 → 右栏加载详情。多选后弹出功能菜单（生成提示词 / 批量删除 / 导出 / 移动）。

**右栏详情页内容顺序**：色卡 → 来源链接 → 6 维度卡片（可折叠/展开）→ Memo → Chat

**按需分析**：未分析的图片显示空白 N/A 面板，用户按需刷新单个维度。

---

## 搜索架构

```
用户输入 → ┬─ FTS5 全文匹配（提示词/memo 关键词）
           ├─ Embedding 余弦相似度（已分析图片的语义向量）
           └─ CLIP 跨模态匹配（未分析图片的视觉向量）
           └─→ 融合排序 → 去重 → 返回结果
```

- 搜索「排版 无衬线字体」→ FTS5 命中 + Embedding 语义扩展
- 搜索「红色」→ CLIP 视觉匹配未分析图片中的红色内容

---

## 本地文件存储

```
~/Snaplex Libraries/
└── MyLibrary.snpx/
    ├── metadata.json
    ├── snaplex.db           # SQLite 数据库
    ├── images/              # 图片文件（按文件夹组织）
    │   ├── ProjectA/
    │   └── ProjectB/
    └── thumbnails/          # 256px 缩略图
```

整个 `.snpx` 文件夹可拖到其他电脑直接打开。

---

## 分阶段计划

### Phase 0：Tauri 基础设施 ⏱️ ~1 周

搭建项目骨架：Tauri v2 + React + SQLite + 文件系统读写 + CLIP 集成 + 自动更新 + CI/CD。

**🧪 你可以测试**：`pnpm tauri dev` 运行开发模式，验证应用窗口能正常启动、图片能导入、Finder 中能看到文件。

---

### Phase 1：三栏 UI ⏱️ ~1.5 周

实现三栏桌面布局：
- 左栏：Obsidian 式文件夹树 + Tools 区域
- 中栏：图片网格 + 搜索栏 + 拖拽上传 + 右键菜单 + 多选操作
- 右栏：详情页（色卡 → 元信息 → 6维度可折叠 → Memo → Chat）
- Light / Dark 主题切换
- Google Translate 翻译卡片背面

**🧪 你可以测试**：文件夹创建/拖拽/重命名、图片导入和浏览、右键菜单、维度按需分析、主题切换。**这是重点测试+设计反馈阶段。**

---

### Phase 2：搜索 + 色卡 ⏱️ ~1.5 周

- FTS5 全文搜索 + API Text Embedding + CLIP 视觉搜索
- 混合搜索排序
- K-means 色卡提取 + UI（点击复制 HEX/RGB/HSL）
- 网页端导出数据导入

**🧪 你可以测试**：各种搜索场景（关键词/语义/视觉）、搜索速度、色卡准确度和交互。

---

### Phase 3：浏览器插件 + Eagle 导入 ⏱️ ~1.5 周

- Chrome Extension（悬浮 Logo + 一键保存 + 视频截图）
- 桌面端 HTTP Server 接收
- Eagle `.library` 数据导入

**🧪 你可以测试**：安装插件后在任意网页悬浮保存图片、导入 Eagle 库。

---

### Phase 4：全面测试 ⏱️ ~1 周

- 单元测试 + E2E 测试 + 跨平台构建验证
- 性能基准（搜索 < 200ms/1000图）
- 修复所有 bug

**🧪 你可以测试**：完整使用流程，提交 bug 报告。

---

### Phase 5：Landing Page ⏱️ ~1 周

> ⚠️ 放到最后，功能和设计稳定后再做。

- 首页重构为产品展示页（Hero + Feature + 下载区）
- 路由拆分：`/` Landing，`/demo` 在线体验
- SEO 优化

---

## 你的测试操作指南

### 日常开发测试（不需要安装打包版）

```bash
# 进入项目目录
cd /Users/ccginger/Downloads/Antigravity/Snaplex-1231/snaplex

# 启动 Tauri 开发模式（自动热重载）
pnpm tauri dev
```

这会同时启动 Vite 前端 + Tauri 窗口，你直接在桌面应用窗口中操作和测试。每次代码修改后自动刷新。

### 打包测试（验证安装体验）

```bash
# 构建安装包
pnpm tauri build
```

生成的 `.dmg`（macOS）在 `src-tauri/target/release/bundle/` 下，双击安装测试。

### 反馈方式

在每个 Phase 完成后，Agent 会通知你进行测试。你可以：
1. 运行 `pnpm tauri dev` 启动应用
2. 按照该阶段的测试要点操作
3. 在终端中直接告诉 Agent 你的反馈（bug / 设计调整 / 功能需求）

---

## Changelog 自动化

提交代码使用 Conventional Commits 格式：
- `feat: 新增色卡提取` → 自动生成 minor 版本
- `fix: 修复搜索崩溃` → 自动生成 patch 版本

release-please GitHub Action 自动生成 CHANGELOG.md + GitHub Release。App 内更新弹窗自动展示更新内容。
