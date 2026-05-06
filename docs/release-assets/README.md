# Snaplex Browser Extension — Release Assets

Chrome Web Store 上架所需的全部文案与素材清单。等 trader account 审核通过后即可使用。

## 文件清单

| 文件 | 用途 | 状态 |
|---|---|---|
| **[`handoff-publish.md`](./handoff-publish.md)** | **🚩 发布全流程交接（用户/智能体分工 + 5 个 Phase 依赖）** | **就绪** |
| [`store-listing-en.md`](./store-listing-en.md) | 英文商店列表（标题 / 简短描述 / 详细描述 / Single Purpose） | 草稿就绪 |
| [`store-listing-zh.md`](./store-listing-zh.md) | 简体中文商店列表 | 草稿就绪 |
| [`privacy-policy-en.md`](./privacy-policy-en.md) | 英文隐私政策（需托管为公开 URL） | 草稿就绪 |
| [`privacy-policy-zh.md`](./privacy-policy-zh.md) | 中文隐私政策 | 草稿就绪 |
| [`permissions-justification.md`](./permissions-justification.md) | Web Store 隐私页签需要逐项填写的权限用途 | 草稿就绪 |
| [`screenshot-checklist.md`](./screenshot-checklist.md) | 5 张商店截图的拍摄脚本 + 规格 | 待拍摄 |
| [`release-checklist.md`](./release-checklist.md) | 提交前的最终核对清单 | 草稿就绪 |

## 已打包产物

- 扩展 zip：[`extension/snaplex-extension-v0.1.0.zip`](../../extension/snaplex-extension-v0.1.0.zip) — 38 KB / 27 文件
- 构建命令：`cd extension && node scripts/build.mjs && (cd dist && zip -r ../snaplex-extension-v0.1.0.zip . -x ".*" "__MACOSX*")`

## 提交流程概览（参考）

1. Trader account 审核通过后登录 https://chrome.google.com/webstore/devconsole
2. New Item → 上传 `snaplex-extension-v0.1.0.zip`
3. 按 [`store-listing-en.md`](./store-listing-en.md) 填写 Store listing
4. 按 [`permissions-justification.md`](./permissions-justification.md) 填 Privacy practices
5. 隐私政策 URL 填托管后的 [`privacy-policy-en.md`](./privacy-policy-en.md) 渲染地址
6. 上传 [`screenshot-checklist.md`](./screenshot-checklist.md) 中产出的 5 张截图
7. **首次以 Unlisted 提交** → 拿 production extension ID → 回填 P1 → 重打 Desktop → 切 Public

## 阻塞项提醒

- 🔴 还没拿到 production extension ID，[`app/src/transport/manifest.rs:10`](../../src-tauri/app/src/transport/manifest.rs#L10) 仍是占位符。提交后立刻回填，否则发布版 Desktop 无法识别扩展。
- 🟡 [`screenshot-checklist.md`](./screenshot-checklist.md) 里的截图还没拍。需要在干净 Chrome profile + 干净 macOS 用户目录跑一遍。
