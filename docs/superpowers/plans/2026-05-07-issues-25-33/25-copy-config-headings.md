# Issue #25 — Copy Config 模块小标题字号自适应 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings 页面 "Copy Config" 模块（SUBJECT/ENVIRONMENT/COMPOSITION/LIGHTING/MOOD/STYLE 六个按钮）小标题字号在窄宽度下不溢出/不裁切，最长英文标题完整可读，且不影响其他设置模块。

**Architecture:** 不引入新组件。仅改动 [src/components/shared/Settings.tsx](../../../../src/components/shared/Settings.tsx) 的"2. Copy Config"栅格布局：把 `text-sm` 固定字号替换为稳定的小字号响应式阶梯，给中等宽度使用 3 列，宽屏再切 6 列，并允许长标题换行。验证范围只限该模块——不要全局改 `text-sm`。

**Tech Stack:** React 19, Tailwind 3.4 (`tailwindcss`)。

---

### Task 1: 写 RTL 失败用例确认窄宽度下溢出

**Files:**
- Test: `src/__tests__/copy-config-fit.test.tsx` (create)

- [x] **Step 1: 写失败测试**

```tsx
// src/__tests__/copy-config-fit.test.tsx
import { render, screen } from '@testing-library/react';
import Settings from '@/components/shared/Settings';
import { DEFAULT_SETTINGS } from '@/types';
import { describe, it, expect, vi } from 'vitest';

describe('Settings — Copy Config 模块小标题', () => {
  it('每个 module button 的根元素带有 fluid 字号 class（非 text-sm 死值）', () => {
    render(<Settings settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);

    const env = screen.getByRole('button', { name: /ENVIRONMENT/i });
    expect(env.className).not.toMatch(/\btext-sm\b/);
    expect(env.className).toMatch(/text-\[11px\]/);
    expect(env.className).toMatch(/\bsm:text-xs\b/);
  });

  it('Copy Config grid 在中等宽度先使用 3 列，宽屏再使用 6 列', () => {
    render(<Settings settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);
    const env = screen.getByRole('button', { name: /ENVIRONMENT/i });
    const grid = env.parentElement!;
    expect(grid.className).toMatch(/\bgrid-cols-2\b/);
    expect(grid.className).toMatch(/\bsm:grid-cols-3\b/);
    expect(grid.className).toMatch(/\blg:grid-cols-6\b/);
  });
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `pnpm vitest run src/__tests__/copy-config-fit.test.tsx`
Expected: FAIL — 当前按钮含 `text-sm`，且父容器直接在 `md` 宽度硬切 6 列。

- [x] **Step 3: 改 Settings.tsx 让测试通过**

打开 [src/components/shared/Settings.tsx](../../../../src/components/shared/Settings.tsx)，找到 "2. Copy Config" 区块（约 178–198 行）。

把：

```tsx
<div className="grid grid-cols-2 md:grid-cols-6 gap-3">
    {STORED_MODULE_KEYS.map(modKey => {
        const isActive = (settings.copyIncludedModules || STORED_MODULE_KEYS).includes(modKey);
        return (
            <button
                key={modKey}
                onClick={() => toggleModule(modKey)}
                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${isActive ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 border-stone-800 dark:border-stone-200' : 'bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700'}`}
            >
                {MODULE_LABEL_MAP[modKey] || modKey}
            </button>
        );
    })}
</div>
```

替换为：

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
    {STORED_MODULE_KEYS.map(modKey => {
        const isActive = (settings.copyIncludedModules || STORED_MODULE_KEYS).includes(modKey);
        return (
            <button
                key={modKey}
                onClick={() => toggleModule(modKey)}
                className={`flex min-h-12 min-w-0 items-center justify-center px-2 py-2 rounded-lg text-[11px] sm:text-xs leading-tight font-bold border transition-all whitespace-normal [overflow-wrap:anywhere] text-center ${isActive ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 border-stone-800 dark:border-stone-200' : 'bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700'}`}
            >
                {MODULE_LABEL_MAP[modKey] || modKey}
            </button>
        );
    })}
</div>
```

要点：
- `text-[11px] sm:text-xs` 不依赖 WebView 对 `cqi` 的支持，避免字号规则失效后继承大字号。
- `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` 避免中等宽度硬挤 6 列。
- `whitespace-normal [overflow-wrap:anywhere]` 允许长英文（如 `ENVIRONNEMENT`、`ÉCLAIRAGE/COULEUR`）在仍溢出时换行。
- `min-h-12` 给两行标题保留稳定高度。

- [x] **Step 4: 不引入额外 Tailwind 插件**

最终方案不依赖 `@tailwindcss/container-queries`，保持 [tailwind.config.js](../../../../tailwind.config.js) 的 `plugins: []`。

- [x] **Step 5: 跑测试确认通过 + tsc**

```bash
pnpm vitest run src/__tests__/copy-config-fit.test.tsx
pnpm tsc --noEmit
```

Expected: PASS, 无类型错误。

- [ ] **Step 6: 手动验证**

```bash
pnpm tauri:dev
```

进入设置页：
1. 默认窗口宽度下，6 个模块按钮在一行内不裁切。
2. 把窗口拖到极窄（约 480px）—— 按钮变成 2 列，标题字号缩小，最长法语 `ÉCLAIRAGE/COULEUR` 完整可读，可换行但不溢出。
3. 切换语言到 French/Chinese，两种界面字号都能自适应。
4. 检查同页其他模块（API Configuration、Language Settings、Style Preferences）的标题字号未受影响。

- [ ] **Step 7: 提交**

```bash
git add src/components/shared/Settings.tsx tailwind.config.js package.json pnpm-lock.yaml src/__tests__/copy-config-fit.test.tsx
git commit -m "fix: copy config headings adapt to container width (#25)"
```
