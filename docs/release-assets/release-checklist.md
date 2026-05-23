# Pre-Submission Release Checklist

按顺序勾完才提交。每一项都对应一个真实的失败模式 —— 不是装样子。

---

## A. 代码与构建

- [ ] `cd snaplex/src-tauri && cargo test --workspace --no-fail-fast` → 64/64 通过（基线）
- [ ] `cd snaplex && pnpm vitest run` → 8 files / 54 tests 通过
- [ ] `cd snaplex/src-tauri && cargo build` → 仅有已知 dead_code warning
- [ ] `cd extension && node scripts/build.mjs` → "Built extension/dist"
- [ ] `cd extension && (cd dist && zip -r ../snaplex-extension-v0.1.0.zip . -x ".*" "__MACOSX*")` → 已生成 zip
- [ ] zip 内 manifest 顶层 `name` / `version` / `description` 正确
- [ ] 干净环境冒烟（参考 handoff §1.2 三条核心路径全过）

## B. 扩展 manifest 自检

- [ ] `manifest_version` = 3
- [ ] `version` 已 bump（首发建议 `1.0.0`，目前是 `0.1.0` —— 看你想怎么编号）
- [ ] `description` 与 store-listing 对应
- [ ] `permissions` 只列了真正用到的（已核对：contextMenus / storage / activeTab / scripting / tabs / nativeMessaging）
- [ ] 没有遗留 `<all_urls>` 之外的 `host_permissions`
- [ ] `commands` 快捷键描述与 store listing 一致
- [ ] icons 32 / 128 都存在且非空

## C. 文案与素材

- [ ] [`store-listing-en.md`](./store-listing-en.md) 中所有 `<...>` 占位符已替换（GitHub URL、support 渠道、download URL）
- [ ] [`store-listing-zh.md`](./store-listing-zh.md) 同上
- [ ] [`privacy-policy-en.md`](./privacy-policy-en.md) 中 `<your-org>` / 联系方式已替换
- [ ] [`privacy-policy-zh.md`](./privacy-policy-zh.md) 同上
- [ ] 隐私政策已托管为公开 URL（GitHub Pages / 自有域名都可），点开能正常访问
- [ ] 5 张商店截图全部产出，尺寸 1280×800（参见 [`screenshot-checklist.md`](./screenshot-checklist.md)）
- [ ] Promo tile 440×280 / 920×680 / 1400×560 已产出（参见 [`promo/`](./promo/)）

## D. Native Messaging 配套校验（防"扩展能装但永远连不上"）

- [ ] [`app/src/transport/manifest.rs:10`](../../src-tauri/app/src/transport/manifest.rs#L10) 的 `PRODUCTION_EXTENSION_ID` —— **首次提交时仍是占位符**，标记为 P1，submission 后立刻回填
- [ ] [`app/src/lib.rs`](../../src-tauri/app/src/lib.rs) 的 manifest 安装是否仅在 release 时执行（`!cfg!(debug_assertions)`） —— handoff §3 P1 已修
- [ ] Bridge 唤醒做了 instance handshake —— handoff §3 P2 已修
- [ ] Locale 不再硬编码 `"en"` —— handoff §3 P3 已修

## E. Web Store Developer Console 提交

- [ ] Trader account 已审核通过（用户当前阻塞点）
- [ ] New Item → 上传 `snaplex-extension-v0.1.0.zip`
- [ ] Store listing 英文字段全部填好
- [ ] Add language → Chinese (Simplified) → 中文字段全部填好
- [ ] Privacy practices → Single purpose 填入
- [ ] Privacy practices → 每个权限填好 justification（[`permissions-justification.md`](./permissions-justification.md)）
- [ ] Privacy practices → "Are you using remote code?" 选 **No**
- [ ] Data usage 三项 certification 全部勾选
- [ ] 隐私政策 URL 填入
- [ ] Notes for the reviewer 填入（[`permissions-justification.md`](./permissions-justification.md) 末尾段落）
- [ ] **Visibility 选 Unlisted（首次提交）**
- [ ] Distribution / regions / pricing 设好
- [ ] Submit for review

## F. 提交后立刻做

- [ ] 从 Developer Console 复制 **Item ID**（即 production extension ID）
- [ ] 编辑 [`app/src/transport/manifest.rs:10`](../../src-tauri/app/src/transport/manifest.rs#L10)，把 `aaaaaaaa...` 换成真实 ID
- [ ] `cargo test --workspace` 全绿
- [ ] `cd snaplex/src-tauri && pnpm tauri build` 重打 .dmg / .pkg
- [ ] 在干净的 macOS 用户上安装新 .dmg + 从 Web Store（unlisted 链接）装扩展，跑一遍 §1.2 三条核心路径

## G. 切公开之前

- [ ] 内测用户（建议 3-5 人）都跑通至少一条核心路径
- [ ] 桌面端下载站点 / GitHub release 已发布
- [ ] 隐私政策 URL 长期可用
- [ ] 反馈渠道（Issues / 邮箱）准备好接收消息

---

## 拒审常见原因（提前规避）

| 拒审原因 | 在本项目里如何规避 |
|---|---|
| Permissions 过宽 / 无说明 | 已逐项写说明（[`permissions-justification.md`](./permissions-justification.md)） |
| Single purpose 模糊 | 已明确：捕获网页视觉素材并通过本机 NM 投递到 Snaplex Desktop |
| 隐私政策 URL 失效 / 不存在 | 提交前自己点开确认 200 |
| Native Messaging 用途说不清 | 已在 reviewer notes 解释清楚，并指出测试方法 |
| 截图含敏感数据 | [`screenshot-checklist.md`](./screenshot-checklist.md) §"检查项" |
| 远程代码 | 答 No；本扩展全部为打包内 JS，无 eval / 无远程脚本 |
| 与桌面应用强耦合但未声明 | listing detailed description 中明确说明 "Requires Snaplex Desktop"，并在无桌面端时给出明确错误 toast |
