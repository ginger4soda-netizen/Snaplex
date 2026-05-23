# Issue #26 — 图片来源列表去重 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 详情页同一图片的来源列表里，相同 (capture_type, page_url 或等价 source_url, captured_at) 的重复来源记录只渲染一次。区分不同捕获上下文（不同 page_url 或不同时间）正常显示；legacy XLS import 写入的重复来源也能被覆盖。

**Architecture:** 去重在两层都加，互为兜底——
1. **DB 层**：`image_sources` 表已有 `INSERT OR IGNORE` 但唯一索引覆盖不全。先确认现有 unique index，必要时加迁移让相同 `(image_id, capture_type, normalized_page_or_source_url, captured_at)` 不产生新行。
2. **前端层**：[src/components/detail/DetailPanel.tsx](../../../../src/components/detail/DetailPanel.tsx) 渲染前对 `imageSources` 数组按 dedup key 去重，针对历史已重复入库的数据立即生效。

DB 迁移要审慎——如果当前表结构难以加 unique 索引，就只走前端去重并在测试里写明。

**Tech Stack:** Rust (rusqlite), React 19, Vitest。

---

### Task 1: 摸清现状（read-only，不改任何东西）

- [x] **Step 1: 查看 image_sources 表 schema 与已有 unique 约束**

读 [src-tauri/app/src/db/mod.rs](../../../../src-tauri/app/src/db/mod.rs) 中 image_sources 表创建 SQL，确认是否已有 unique index、覆盖哪些列。

读 [src-tauri/app/src/db/image_sources.rs](../../../../src-tauri/app/src/db/image_sources.rs) `append_source`：当前用 `INSERT OR IGNORE` + 退回到 `SELECT WHERE page_url = ? AND captured_at = ?`。这意味着：相同 `(image_id, page_url, captured_at)` 会被认为是重复。但**当 page_url 为空、source_url 不同**时，仍然会被插入；legacy import 路径调用 `append_source` 用的 captured_at 可能是 import 时刻而不是原始捕获时刻——会让"完全相同来源"被多次写入。

记录你看到的 schema 与 unique index 列表，写在 Task 2 描述里指导决策。

**执行记录（2026-05-07）：**
- `image_sources` 由 migration v1 创建，schema 含 `UNIQUE(image_id, page_url, captured_at)`。
- 已有普通索引：`idx_image_sources_image_id`、`idx_image_sources_source_domain`。
- `append_source` 使用 `INSERT OR IGNORE`，冲突后按 `image_id + page_url + captured_at` 查询既有行。
- 因已有唯一约束覆盖正常浏览器扩展路径，DB 层走 B 分支；legacy `page_url = NULL` 的重复由前端去重兜底。

---

### Task 2: 前端去重（先做，因为对历史数据立即生效）

**Files:**
- Create: `src/utils/dedupSources.ts`
- Test: `src/utils/dedupSources.test.ts`
- Modify: `src/components/detail/DetailPanel.tsx`

- [x] **Step 1: 写失败测试**

```ts
// src/utils/dedupSources.test.ts
import { describe, it, expect } from 'vitest';
import { dedupSources } from './dedupSources';
import type { ImageSource } from '@/types';

const base: Omit<ImageSource, 'id'> = {
  imageId: 'img-1',
  captureType: 'image',
  sourceUrl: 'https://cdn.example.com/photo.jpg',
  pageUrl: 'https://example.com/article',
  pageTitle: 'Article',
  sourceDomain: 'example.com',
  capturedAt: '2026-05-07T10:00:00.000Z',
  clientId: 'browser-extension',
  metadataJson: null,
};

const make = (id: number, overrides: Partial<ImageSource> = {}): ImageSource => ({ id, ...base, ...overrides });

describe('dedupSources', () => {
  it('drops fully identical duplicates (same type/page_url/source_url/capturedAt)', () => {
    const list = [make(1), make(2), make(3)];
    expect(dedupSources(list)).toHaveLength(1);
    expect(dedupSources(list)[0].id).toBe(1);
  });

  it('keeps different page_url even if other fields match', () => {
    const list = [make(1), make(2, { pageUrl: 'https://example.com/article-2' })];
    expect(dedupSources(list)).toHaveLength(2);
  });

  it('keeps different source_url when page_url is missing', () => {
    const list = [
      make(1, { pageUrl: null, sourceUrl: 'https://a.example/a.jpg' }),
      make(2, { pageUrl: null, sourceUrl: 'https://a.example/b.jpg' }),
    ];
    expect(dedupSources(list)).toHaveLength(2);
  });

  it('keeps different captureType', () => {
    const list = [make(1), make(2, { captureType: 'screenshot_visible' })];
    expect(dedupSources(list)).toHaveLength(2);
  });

  it('treats trailing slash and case differences as same url', () => {
    const list = [
      make(1, { pageUrl: 'https://Example.com/Article/' }),
      make(2, { pageUrl: 'https://example.com/Article' }),
    ];
    expect(dedupSources(list)).toHaveLength(1);
  });

  it('keeps different capturedAt as separate captures', () => {
    const list = [make(1), make(2, { capturedAt: '2026-05-07T11:00:00.000Z' })];
    expect(dedupSources(list)).toHaveLength(2);
  });

  it('preserves order — first occurrence wins', () => {
    const list = [make(2), make(1)];
    const out = dedupSources(list);
    expect(out[0].id).toBe(2);
  });

  it('handles legacy import duplicates with same captured_at and same source_url', () => {
    const legacy = make(10, { clientId: 'desktop-import', captureType: 'image', pageUrl: null, sourceUrl: 'file:///legacy/x.jpg' });
    const list = [legacy, { ...legacy, id: 11 }, { ...legacy, id: 12 }];
    expect(dedupSources(list)).toHaveLength(1);
  });
});
```

- [x] **Step 2: 跑测试，确认失败**

Run: `pnpm vitest run src/utils/dedupSources.test.ts`
Expected: FAIL — `dedupSources` 未定义。

- [x] **Step 3: 实现 dedupSources**

Create [src/utils/dedupSources.ts](../../../../src/utils/dedupSources.ts):

```ts
import type { ImageSource } from '@/types';

const normalizeUrl = (raw: string | null | undefined): string => {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    // Lowercase host; preserve case-sensitive path/query for safety.
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}${url.hash}`;
  } catch {
    return raw.trim();
  }
};

const dedupKey = (s: ImageSource): string => {
  const page = normalizeUrl(s.pageUrl);
  const src = normalizeUrl(s.sourceUrl);
  const urlKey = page || src;
  return [s.captureType, urlKey, s.capturedAt].join('|');
};

export const dedupSources = (sources: ImageSource[]): ImageSource[] => {
  const seen = new Set<string>();
  const out: ImageSource[] = [];
  for (const source of sources) {
    const key = dedupKey(source);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
};
```

- [x] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run src/utils/dedupSources.test.ts
```

Expected: PASS。

- [x] **Step 5: 接入 DetailPanel**

打开 [src/components/detail/DetailPanel.tsx](../../../../src/components/detail/DetailPanel.tsx)，在文件 import 段加：

```ts
import { dedupSources } from '@/utils/dedupSources';
```

找到 `setImageSources(sources);` 调用（约 78 行），改为：

```ts
if (!cancelled) setImageSources(dedupSources(sources));
```

- [x] **Step 6: 跑全量测试 + tsc**

```bash
pnpm vitest run
pnpm tsc --noEmit
```

Expected: PASS。

- [x] **Step 7: 提交**

```bash
git add src/utils/dedupSources.ts src/utils/dedupSources.test.ts src/components/detail/DetailPanel.tsx
git commit -m "fix: dedup image sources before rendering detail panel (#26)"
```

---

### Task 3: DB 层补强（防止未来重复入库）

**Files:**
- Modify: `src-tauri/app/src/db/image_sources.rs`
- Test: `src-tauri/app/src/db/image_sources.rs` (`#[cfg(test)]` block — add if not present)

> 这个 Task 在确认 Task 1 中现状后决定具体动作。常见两种情况：
>
> **A. image_sources 没有覆盖 (image_id, capture_type, page_url, captured_at) 的 unique index** —— 加迁移和 unique index。
>
> **B. 已有 unique index 但只覆盖 (image_id, page_url, captured_at)** —— 现状已经基本能挡住浏览器扩展正常路径。Task 3 简化为补 Rust 单元测试覆盖：相同 `(image_id, capture_type, page_url, captured_at)` 第二次 `append_source` 不会增加行数。
>
> **优先做 B 的测试覆盖**——加迁移有破坏风险，没有测试给出真实重复案例之前不要动 schema。

- [x] **Step 1: 读现 schema，决定 A/B 走哪条**

读 [src-tauri/app/src/db/mod.rs](../../../../src-tauri/app/src/db/mod.rs) 中创建 image_sources 表的 SQL 与 index。

如果**已有** `CREATE UNIQUE INDEX … ON image_sources (image_id, page_url, captured_at)` 之类——走 B。
否则——走 A。

- [x] **Step 2 (A 分支): 加 unique index 迁移**

跳过：当前 schema 已有 `UNIQUE(image_id, page_url, captured_at)`，按 B 分支执行。

只在没有 unique index 时执行。在 `mod.rs` 的迁移 / setup SQL 中追加（具体位置参照同文件中已有的 ALTER/CREATE INDEX 模式）：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS image_sources_dedup_idx
ON image_sources (
  image_id,
  capture_type,
  COALESCE(page_url, ''),
  COALESCE(source_url, ''),
  captured_at
);
```

注意：SQLite 不允许直接在 unique index 用 `COALESCE`，但允许在 partial index 表达式中用 column expressions（SQLite 3.9+ 支持表达式索引）。如果 SQLite 版本不支持，回退到 B 分支并放弃 DB 唯一约束，由前端 `dedupSources` 兜底。

- [x] **Step 3 (B 分支): 在 image_sources.rs 加 cfg(test) 测试**

现有测试已覆盖 `append_source_deduplicates_same_image_page_and_capture_time`，无需重复添加等价测试。

在 [src-tauri/app/src/db/image_sources.rs](../../../../src-tauri/app/src/db/image_sources.rs) 末尾追加：

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn fresh_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::run_migrations(&conn).expect("migrations");
        // 上面 run_migrations 名字以现仓为准——若不同请改 import path。
        conn
    }

    fn make_input(captured_at: &str, page_url: Option<&str>) -> ImageSourceInput {
        ImageSourceInput {
            capture_type: "image".into(),
            source_url: Some("https://cdn.example.com/x.jpg".into()),
            page_url: page_url.map(String::from),
            page_title: None,
            source_domain: Some("example.com".into()),
            captured_at: captured_at.into(),
            client_id: "browser-extension".into(),
            metadata_json: None,
        }
    }

    #[test]
    fn append_source_is_idempotent_for_same_page_url_and_captured_at() {
        let conn = fresh_conn();
        // pre-insert image row required by FK — adjust per actual schema
        crate::db::images::insert_image(
            &conn, "img-1", "x.jpg", "/tmp/x.jpg", None, 100, 100, 1234, "jpg", None, None,
        ).unwrap();

        let id1 = append_source(&conn, "img-1", make_input("2026-05-07T10:00:00Z", Some("https://example.com/a"))).unwrap();
        let id2 = append_source(&conn, "img-1", make_input("2026-05-07T10:00:00Z", Some("https://example.com/a"))).unwrap();
        assert_eq!(id1, id2, "same page_url + captured_at should map to same row");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM image_sources WHERE image_id = ?1", ["img-1"], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
```

> 如果 `crate::db::images::insert_image` 签名与上面不一致，按当前签名调整参数（这是测试的 setup，不影响产品代码）。

- [x] **Step 4: 跑 cargo test**

```bash
cd src-tauri/app && cargo test image_sources
```

Expected: PASS。如果失败原因是 schema 没挡住——回到 Step 2 (A 分支) 加 unique index 迁移，再重跑。

- [x] **Step 5: 提交**

```bash
git add src-tauri/app/src/db/
git commit -m "test: cover image_sources dedup at DB layer (#26)"
```

---

### Task 4: 端到端手动验证

- [ ] **Step 1: 跑 Tauri 应用，复现历史重复**

```bash
pnpm tauri:dev
```

打开一张已知有重复来源的图片详情页，确认列表只显示去重后的来源。

- [ ] **Step 2: 用浏览器扩展捕获同一张图两次**

加载 `extension/dist`（可能需要先 `cd extension && pnpm build`），右键同一张图 → "Save to Snaplex" 两次。打开详情页：来源列表只新增一条。

- [ ] **Step 3: legacy XLS import 路径**

如有 legacy XLS 测试数据，跑 import 流程，确认重复来源不再出现。
