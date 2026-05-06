# Web Store Screenshot Checklist

Chrome Web Store 要求至少 1 张、最多 5 张商店截图。**规格：1280×800 或 640×400 PNG，1280×800 显示效果更好**。

## 拍摄前准备

- [ ] 干净的 macOS 用户目录（避免你私人桌面里出现任何敏感内容）
- [ ] 干净的 Chrome profile（菜单 → Profile → Add → "Snaplex Demo"）
- [ ] Snaplex Desktop 启动，准备一个空的演示库（命名 "Design Refs"）
- [ ] 准备 3-4 张演示用图（建议：开源设计作品集站点、Unsplash 等版权清晰的图）
- [ ] macOS 系统外观切到 Light（避免菜单栏对比度问题）
- [ ] 关掉所有可能弹通知的 app（Slack / 邮件 / 日历）
- [ ] 把 Chrome 窗口尺寸调到 1280×800 用于截图，命令：

```bash
osascript -e 'tell application "Google Chrome" to set bounds of front window to {0, 0, 1280, 800}'
```

## 5 张截图脚本

每张截图导出为 `release-assets/screenshots/<编号>-<名字>.png`，1280×800。

### 1. `01-popup-connected.png` — popup 显示已连接 + 库名

**画面**：浏览器窗口右上角弹出的 Snaplex popup，状态显示 "Connected"，库名 "Design Refs"，下方有快捷键提示 "Right-click any image or video on a page to save it directly. Press Cmd+Shift+S to start region screenshot."

**怎么拍**：访问任意一个图片丰富的演示站点（建议 dribbble.com 或 awwwards.com 的 work feed 页），点 Snaplex 扩展图标打开 popup，连同浏览器一起截图。

**Caption（要在图上叠的文字 / 商店字段填的标题）**：
- EN: "Connect once. Capture forever."
- ZH: "一次连接，随手保存"

---

### 2. `02-context-menu-image.png` — 右键图片菜单

**画面**：在演示站点对一张精选图右键，菜单展开，"Save image to Snaplex" 高亮。

**怎么拍**：右键时按 Cmd+Shift+4 → Space → 点窗口区域截图（macOS 自带），保留菜单。然后裁到 1280×800。

**Caption**：
- EN: "Right-click any image — saved."
- ZH: "右键任意图片 —— 直接保存"

---

### 3. `03-region-screenshot-overlay.png` — 区域截图 overlay 正在选区

**画面**：页面上半透明黑色蒙层 + 一个明亮的选区矩形 + 矩形右下角的 "Save / Reselect / Cancel" 按钮组。

**怎么拍**：访问演示页面，按 Cmd+Shift+S，拖出一个有意义的矩形（比如选某个 UI 卡片），保持 overlay 状态截图。

**Caption**：
- EN: "Cmd+Shift+S — drag, drop, done."
- ZH: "Cmd+Shift+S，框选即保存"

---

### 4. `04-toast-saved.png` — 保存成功 toast

**画面**：页面右下角浮现 "Saved to Snaplex" toast，背景是刚刚保存图片的页面。

**怎么拍**：保存任意一张图后立刻 Cmd+Shift+5（macOS 录屏工具）开屏幕截图。toast 大约 2-3 秒后消失，需要快。
> 备选：直接改一行 [`extension/src/background/feedback.js`](../../extension/src/background/feedback.js) 里 toast 的 timeout 临时拉长到 30s 来截图，截完恢复。

**Caption**：
- EN: "Confirmation in the page — no app-switch needed."
- ZH: "页面内即时反馈，无需切换窗口"

---

### 5. `05-desktop-library.png` — Snaplex Desktop 收到内容

**画面**：Snaplex Desktop 主窗口的 All Images 视图，3-4 张刚通过扩展保存的图整齐排列，每张下方显示 "from <site>"。

**怎么拍**：用扩展连续保存 3-4 张，切到 Desktop 截图，保留最近保存的卡片在最上面。

**Caption**：
- EN: "Lands instantly in your local Snaplex library."
- ZH: "瞬间出现在你本机的 Snaplex 素材库"

---

## 导出与命名约定

```
snaplex/docs/release-assets/screenshots/
├── 01-popup-connected.png
├── 02-context-menu-image.png
├── 03-region-screenshot-overlay.png
├── 04-toast-saved.png
└── 05-desktop-library.png
```

中文版本（如果分别上传）后缀 `-zh.png`。

## 检查项

每张截图导出后：

- [ ] 确认尺寸为 **1280×800**（命令：`sips -g pixelWidth -g pixelHeight <file>.png`）
- [ ] 不含任何邮箱、姓名、内部 URL、未公开的功能
- [ ] 不含 Chrome 书签栏里能识别身份的项（最好临时隐藏书签栏：Cmd+Shift+B）
- [ ] 不含其他扩展图标（在 chrome://extensions/ 把其他扩展暂时禁用，只留 Snaplex）
- [ ] PNG 文件 < 1 MB（Web Store 上限是 16 MB，但保持精简方便加载）

## Promo tile（可选但建议）

- **Small promo tile**: [`promo/small-promo-440x280.png`](./promo/small-promo-440x280.png)。
- **Large promo tile**: [`promo/large-promo-920x680.png`](./promo/large-promo-920x680.png)。
- **Marquee tile**: [`promo/marquee-promo-1400x560.png`](./promo/marquee-promo-1400x560.png)。仅在 Editor's Pick / 首页推广时被用到，可后补。

重新生成：

```bash
cd snaplex
node scripts/generate-release-promos.mjs
```
