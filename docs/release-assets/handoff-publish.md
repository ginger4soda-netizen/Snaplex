# 交接文档 — Snaplex 浏览器扩展发布全流程

**Status:** Ready to start (trader account 审核中)
**Last updated:** 2026-05-05
**配套文档:**
- [`handoff-browser-extension.md`](../handoff-browser-extension.md) — 工程现状（前置阅读）
- [`release-assets/README.md`](./README.md) — 发布素材索引
- [`release-assets/release-checklist.md`](./release-checklist.md) — 提交前最终核对

---

## 0. 这份文档是干什么的

下一会话进入时**先读这份**。它把"从现在到扩展上架"全流程拆成步骤，每步明确：

- 🧑 **必须用户亲自做**（涉及凭证 / 个人信息 / 钱 / 不可逆操作 / 外部网站操作）
- 🤖 **智能体可以做**（改代码、跑测试、写文案、打包、检查 manifest）
- 🤝 **协作**（智能体做主、用户审核或反之）

并标出**依赖关系**：每一步前置必须完成。

---

## 1. 当前阻塞与先决条件（开会话先核对）

| 项目 | 状态 | 谁负责解决 |
|---|---|---|
| Chrome Trader account 审核 | ⏳ 等审核 | 🧑 用户（无法加速） |
| `extension/` 目录在 git repo 外 | ❌ 待修复 | 🧑 用户决策 + 🤖 智能体执行 |
| `feat/search-foundation` 分支与扩展工作混在一起 | ❌ 待整理 | 🧑 用户决策 + 🤖 智能体执行 |
| Snaplex Desktop 公开下载渠道 | ❌ 还没有 | 🧑 用户（涉及代码签名 / 公证 / 域名） |
| `PRODUCTION_EXTENSION_ID` 占位符 | ❌ 待回填 | 🤖 智能体（拿到 ID 后） |
| 隐私政策公开 URL | ❌ 还没托管 | 🧑 用户托管 + 🤖 智能体起草（已草稿） |
| 5 张商店截图 | ❌ 没拍 | 🧑 用户拍（涉及 UI 截图） |
| 占位符（`<your-org>`/邮箱/下载 URL）替换 | ❌ 待替换 | 🧑 用户提供值 + 🤖 智能体批量替换 |

> **重要现实**：Snaplex Desktop 还没有公开下载，扩展即使上架，普通用户装了也用不了（popup 会一直显示 "Snaplex Desktop is not reachable"）。**所以发布节奏应该是：先 Unlisted 提交拿 extension ID → 再发布 Desktop 公开包 → 最后切扩展为 Public**。

---

## 2. 全流程依赖图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 0  代码就绪（已完成）                    │
│  handoff-browser-extension.md §6 Step 1-5 全部完成 ✅              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                Phase 1  仓库收口（本会话或下一会话）                 │
│  把 extension/ 移到 snaplex 仓库内 + 新建 feat/browser-extension    │
│  + commit + push                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│             Phase 2  发布素材定稿                                  │
│  替换占位符 + 隐私政策托管 + 截图拍摄                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│             Phase 3  Web Store 提交（Unlisted）                    │
│  Trader account 通过后才能开始；获得 production extension ID         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│             Phase 4  回填 ID + 发 Desktop 公开包                    │
│  把 production ID 写回代码 + tauri build + 代码签名 + 公证 + 上传     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│             Phase 5  扩展切 Public + 公告                          │
│  内测过关 + Web Store 切 Public + GitHub Release + 反馈渠道开启      │
└─────────────────────────────────────────────────────────────────┘
```

每个 Phase 必须**前一步全部完成**才能开始下一步。

---

## 3. Phase 1 — 仓库收口

**目标**：所有改动可被版本控制 + push 到远端，不再有掉地板风险。

### 1.1 决策：`extension/` 目录归属（🧑 用户）

二选一：

**A. 移到 `snaplex/extension/`（推荐，monorepo 风格）**
- 优点：所有内容在一个 repo / 一个分支管理，发版打 tag 一次到位
- 缺点：要更新 handoff 里所有 `../../extension/...` 路径

**B. 把 `extension/` 单独建一个 repo（如 `snaplex-extension`）**
- 优点：扩展的迭代节奏可以独立于 Desktop
- 缺点：跨 repo 协调 Native Messaging 协议变更比较烦

**默认走 A**，除非用户主动选 B。

### 1.2 执行（🤝 协作）

- 🧑 用户在新对话开头明确选 A 或 B
- 🤖 智能体执行（A 方案大致动作）：
  1. `mv Snaplex-1231/extension Snaplex-1231/snaplex/extension`
  2. 更新 `snaplex/scripts/install-dev-manifest.sh` 里的相对路径（如果引用了 extension）
  3. 更新 `snaplex/docs/handoff-browser-extension.md` 里所有 `../../extension/` → `../extension/`
  4. 更新 `snaplex/docs/release-assets/*.md` 里所有 extension 相对链接
  5. `cd snaplex/extension && node scripts/build.mjs` 验证还能构建
  6. 把 zip 重新打到 `snaplex/extension/snaplex-extension-v0.1.0.zip`

### 1.3 分支重组（🤝 协作）

- 🧑 用户决策：当前 `feat/search-foundation` 分支
  - 选项 1：把它**重命名**为 `feat/browser-extension`（如果搜索功能已合并 main）
  - 选项 2：**新开** `feat/browser-extension`，把当前改动转过去
  - 选项 3：分**两个 commit 系列**留在当前分支（不推荐，但最省事）
- 🤖 智能体执行用户选定的方案

### 1.4 Commit 与 push（🧑 用户操作 / 🤖 智能体起草）

- 🤖 智能体起草 commit message（按 conventional commits 风格，可能拆成多个 commit）：
  - `feat(extension): browser companion v0.1.0 (capture, region screenshot, NM bridge)`
  - `feat(desktop): native messaging transport + image_sources schema`
  - `feat(desktop): cargo workspace split into app + bridge crates`
  - `docs: browser extension handoff + release assets`
- 🧑 用户审 commit message → 同意 → 智能体执行 `git commit`
- 🧑 用户**亲自执行 `git push`**（涉及 GitHub 凭证）

### 1.5 验收

- [ ] `git status` 干净（或只剩明确想留的工作树文件）
- [ ] `git log --oneline -5` 显示新 commits
- [ ] 远端 GitHub 网页上能看到 `feat/browser-extension` 分支与最新 commits
- [ ] `cargo test --workspace` + `pnpm vitest run` 仍全绿
- [ ] `cd snaplex/extension && node scripts/build.mjs` 仍能构建

---

## 4. Phase 2 — 发布素材定稿

**前置**：Phase 1 完成（代码已 push）。

### 2.1 占位符替换（🤝 协作）

🧑 用户准备并提供以下值：

| 占位符 | 在哪里出现 | 例 |
|---|---|---|
| `<your-org>` | 隐私政策、商店描述 | `ginger4soda-netizen` |
| GitHub repo URL | 同上 | `https://github.com/ginger4soda-netizen/Snaplex` |
| `<download URL>` | 商店描述 | `https://github.com/.../releases` 或独立官网 |
| `<email or GitHub Issues link>` | 隐私政策、商店反馈渠道 | 推荐 GitHub Issues 链接 |
| 隐私政策公开 URL | Web Store privacy policy 字段 | GitHub Pages 渲染地址（见 2.2） |

🤖 智能体收到值后，批量替换 [`release-assets/`](.) 下所有文件中的占位符。

### 2.2 隐私政策托管（🧑 用户）

最简单方案：用 GitHub Pages 托管 [`privacy-policy-en.md`](./privacy-policy-en.md)。

🧑 用户选一种：

- **方案 a**：在 snaplex repo 启用 GitHub Pages → `main` 分支 `/docs` 目录 → 生成 `https://ginger4soda-netizen.github.io/Snaplex/release-assets/privacy-policy-en.html`
- **方案 b**：单独建一个 `snaplex-website` repo，专放隐私政策
- **方案 c**：自有域名 `snaplex.app/privacy`（需要域名 + 部署，最重）

🤖 智能体可以协助：
- 把 `privacy-policy-en.md` 放到 GitHub Pages 期望的目录
- 写 `_config.yml`（如用 Jekyll 默认主题）
- 写一个 minimal `index.html` 包一层

### 2.3 商店截图（🧑 用户）

按 [`screenshot-checklist.md`](./screenshot-checklist.md) 拍 5 张 1280×800 PNG。

**这一步必须用户亲自做**：
- 涉及个人 Chrome profile / 桌面环境 / 网络访问真实站点
- 智能体不能截 UI

🤖 智能体能做的辅助：
- 临时改 [`extension/src/background/feedback.js`](../../extension/src/background/feedback.js) 把 toast timeout 拉长（截完恢复）
- 写自动化脚本 resize Chrome 窗口到 1280×800
- 用 `sips` 校验截图尺寸符合规格

### 2.4 验收

- [ ] [`release-assets/`](.) 目录全文搜 `<` 找不到任何占位符
- [ ] 隐私政策 URL 浏览器可访问，HTTP 200
- [ ] `release-assets/screenshots/01-…05-*.png` 5 张全部存在，尺寸 1280×800
- [ ] [`release-checklist.md`](./release-checklist.md) §C 全部勾完

---

## 5. Phase 3 — Web Store 首次提交（Unlisted）

**前置**：Phase 2 完成 + Trader account 审核通过。

### 3.1 上传与表单填写（🧑 用户）

整个 Developer Console 提交流程必须用户亲自做（外部网站、登录账号、付款记录）。

🧑 用户操作步骤：
1. 登录 https://chrome.google.com/webstore/devconsole
2. New Item → 上传 [`snaplex/extension/snaplex-extension-v0.1.0.zip`](../../extension/snaplex-extension-v0.1.0.zip)
3. 把 [`store-listing-en.md`](./store-listing-en.md) 内容贴入对应字段
4. Add language → Chinese (Simplified) → 贴 [`store-listing-zh.md`](./store-listing-zh.md)
5. Privacy practices → 贴 [`permissions-justification.md`](./permissions-justification.md) 每一项
6. 上传 5 张截图
7. **Visibility 选 Unlisted**（极其重要）
8. Submit

🤖 智能体能做的辅助：
- 全程在旁边看 [`release-checklist.md`](./release-checklist.md) §E，一项一项 checklist
- 用户截屏 dev console 时帮检查"漏了什么字段"

### 3.2 拿到 production extension ID（🧑 用户读 + 🤖 智能体回填）

- 🧑 提交完 Web Store 立刻在 dev console 看到 32 字符 Item ID（形如 `kfnabcdefghijklmnopqrstuvwxyz1234`）
- 🧑 把 ID 贴给智能体
- 🤖 智能体执行：
  1. 编辑 [`app/src/transport/manifest.rs:10`](../../src-tauri/app/src/transport/manifest.rs#L10) 的 `PRODUCTION_EXTENSION_ID`
  2. `cargo test --workspace --no-fail-fast` 跑全绿
  3. 起草 commit `chore(release): bake production extension id`
- 🧑 用户审 commit → push

### 3.3 等审核（被动等待）

Native Messaging 扩展首审通常 **1-2 周**，期间可以并行做 Phase 4。

---

## 6. Phase 4 — Snaplex Desktop 公开发版

**前置**：Phase 3 完成（拿到了 production extension ID）。

这一 Phase 是**目前最大未解项**，因为 Desktop 还没公开发布。

### 4.1 代码签名 & 公证（🧑 用户，无法委托）

macOS 想让用户双击 .dmg 不被 Gatekeeper 拦，必须：

- 🧑 注册 **Apple Developer Program**（**$99/年**，用户付费）
- 🧑 申请 **Developer ID Application** 证书
- 🧑 配置 Tauri `tauri.conf.json` 里的 `bundle.macOS.signingIdentity`
- 🧑 设置环境变量 `APPLE_ID` / `APPLE_PASSWORD` (app-specific) / `APPLE_TEAM_ID`
- 🧑 跑 `pnpm tauri build` → Tauri 自动调 `xcrun notarytool submit`
- 🧑 等公证返回（10 分钟到 1 小时）
- 🧑 `xcrun stapler staple snaplex.dmg`

🤖 智能体能做的辅助：
- 起草 GitHub Actions workflow，让 push tag 自动触发 build + sign + notarize
- 写 README 安装指南
- 验证 `codesign --verify --verbose snaplex.app` 输出
- 写一个本地 `scripts/release-desktop.sh` 把流程串起来

### 4.2 分发渠道（🧑 用户）

- 选项 a：**GitHub Releases** —— 最简单，私有 repo 也行
- 选项 b：**自有官网** —— 长远更专业，但要域名 + 部署
- 选项 c：**Mac App Store** —— 不推荐，沙箱限制 NM 用不了

🤖 智能体可以：
- 起草 GitHub Release notes（基于 commit log）
- 准备 Sparkle 自动更新配置（如果以后想做）

### 4.3 Linux 包（可选）

- 🧑 用户决定是否打 Linux（`.AppImage` / `.deb`）—— Tauri 自动支持，无需公证
- 🤖 智能体处理 build script

### 4.4 验收

- [ ] 干净的 macOS 用户从 GitHub Release 下载 .dmg → 双击 → Gatekeeper 通过 → 装到 /Applications/
- [ ] 启动 Snaplex Desktop → 创建库
- [ ] 从 Web Store unlisted 链接装扩展
- [ ] 三条核心路径（右键图、视频帧、区域截图）全过

---

## 7. Phase 5 — 切 Public + 公告

**前置**：Phase 4 完成 + Web Store 审核通过 + 内测 OK。

### 7.1 内测（🧑 用户主导 / 🤝 智能体设计反馈表）

- 🧑 找 3-5 个真实用户（朋友、设计师圈子、Discord 群）发 unlisted 链接
- 🤖 起草反馈问卷（Google Forms / Tally），focus："装的时候顺不顺"、"3 条核心路径有没有踩坑"

### 7.2 切 Public（🧑 用户）

🧑 在 Web Store dev console 把 Visibility 从 Unlisted 改为 Public → Submit。第二次审核通常更快（24-72h）。

### 7.3 公告（🤝 协作）

- 🤖 起草 GitHub Release notes / Twitter 帖 / Hacker News Show HN
- 🧑 用户决定渠道、时机、亲自发

### 7.4 监听反馈

- 🧑 关注 Web Store reviews + GitHub Issues
- 🤖 帮分类 issue（bug / feature / 用户教育）、起草回复

---

## 8. 给"下一会话"AI 的口令模板

把下面这一段贴到新对话第一句：

> 请先读 `snaplex/docs/release-assets/handoff-publish.md`。我们目前处于 Phase **<填当前 Phase>**。本次目标是 **<填要推进什么>**。先确认 §1 的阻塞项状态，然后从对应 Phase 的"未完成步骤"开始执行；遇到任何 🧑 标记的步骤先问我，不要替我决定。

举例：

> 请先读 `snaplex/docs/release-assets/handoff-publish.md`。我们目前处于 Phase 1。本次目标是把 extension/ 目录移进 snaplex repo，新建 feat/browser-extension 分支，把所有改动 commit。决策 §3.1 我选 A，决策 §3.3 我选选项 2（新开分支）。先帮我列出会动到的文件清单让我审，再开始执行。

---

## 9. 风险登记（提醒未来的自己 / AI）

| 风险 | 触发场景 | 缓解 |
|---|---|---|
| 占位 extension ID 在 release 包里被忘了改 | Phase 4 之前漏了回填 | [`release-checklist.md`](./release-checklist.md) §F 第 2 项强制 |
| 截图含敏感信息 | 用 daily Chrome profile 截图 | [`screenshot-checklist.md`](./screenshot-checklist.md) §"拍摄前准备"强调干净 profile |
| 公开后 Desktop 还没好用 | Phase 5 抢先于 Phase 4 完成 | 严格按依赖图执行，Phase 4 没过就别切 Public |
| Apple 证书过期 / 续费忘了 | 一年后 | 日历提醒；GitHub Actions workflow 加 cert 过期检测 |
| Web Store 政策变更 | Google 偶尔改 NM 政策 | 关注 Chrome Web Store policy 邮件 |
| 公开后差评淹没 | 用户不知道要先装 Desktop | listing detailed description 和 popup 文案都强调依赖；不达预期立刻看 Web Store reviews |

---

## 10. 文件索引（一行一句）

- 工程现状回顾：[`../handoff-browser-extension.md`](../handoff-browser-extension.md)
- 发布素材索引：[`README.md`](./README.md)
- 商店列表（英）：[`store-listing-en.md`](./store-listing-en.md)
- 商店列表（中）：[`store-listing-zh.md`](./store-listing-zh.md)
- 权限说明：[`permissions-justification.md`](./permissions-justification.md)
- 隐私政策（英）：[`privacy-policy-en.md`](./privacy-policy-en.md)
- 隐私政策（中）：[`privacy-policy-zh.md`](./privacy-policy-zh.md)
- 截图脚本：[`screenshot-checklist.md`](./screenshot-checklist.md)
- 提交核对清单：[`release-checklist.md`](./release-checklist.md)
- **本文档**（流程总图）：`handoff-publish.md`
