# Virtual Scroll & Pagination — Design Spec

> **Date**: 2026-04-28
> **Branch**: branch off `dev/phase-0-1-2` as `feat/virtual-scroll`
> **Scope**: P0 — image grid visibility & scalability fix
> **Out of scope**: UI bugs in `# feedback_v2.ini`, real WebP thumbnails, browser plugin, Eagle import

---

## Problem

User-visible symptom: 图片网格永远只显示最近 50 张，旧条目"消失"。

Root cause:
- [`tauriBridge.ts:77`](../../../src/services/tauriBridge.ts#L77) `getImages` 默认 `limit: 50`
- [`ImageGrid.tsx:52`](../../../src/components/layout/ImageGrid.tsx#L52) 调用 `getImages(folderId)` 不传 limit
- 后端 [`db/images.rs:83-105`](../../../src-tauri/src/db/images.rs#L83-L105) 已有完整 offset/limit 分页能力，但前端从未消费第 51 条之后

数据并未丢失，只是 UI 没拉。

## Goals

1. 任何文件夹下的全部图片都可见，无论数量
2. DOM 和内存占用与库大小**解耦**（恒定上限）
3. 保留全部既有交互：多选、Cmd+click、Shift+click、矩形框选、拖拽导入、拖到文件夹、右键菜单、搜索、gridSize 滑块、选中高亮、点击进入详情
4. 一次到位 —— 为 Phase 3（浏览器插件、Eagle 库导入，预期单库 1k–50k 张图）打底，不留二次重构债

## Non-goals

- 256px WebP 缩略图生成（Phase 0.4 DEFERRED，本次不做，`<img>` 继续指向原图）
- 滚动位置跨文件夹持久化
- 按时间分组的分段虚拟化
- 任何 [`# feedback_v2.ini`](../../../../%23%20feedback_v2.ini) 中的 UI Bug

## Architecture decision

**双层堆叠：后端分页 + 前端 windowing**。

```
┌───────────────────────────────────────────────────────┐
│ ImageGrid (frontend)                                  │
│                                                       │
│   ┌─────────────────────────────────────────┐         │
│   │ @tanstack/react-virtual                 │         │
│   │ - only DOM for visible rows + 3 overscan│         │
│   │ - constant DOM cost                     │         │
│   └─────────────────────────────────────────┘         │
│             │                                         │
│             │ end-row near tail?                      │
│             ▼                                         │
│   ┌─────────────────────────────────────────┐         │
│   │ loadMore(): append next page            │         │
│   └─────────────────────────────────────────┘         │
└───────────│───────────────────────────────────────────┘
            │ IPC: get_images(folderId, offset, limit=500)
            ▼
┌───────────────────────────────────────────────────────┐
│ Rust backend (already implemented, no change needed)  │
└───────────────────────────────────────────────────────┘
```

**Why both layers**：单做 windowing 不够 —— 仍需先把全部元数据塞进内存（5 万张 × 200 字节 ≈ 10MB JSON，可接受但浪费首屏延迟）；单做分页不够 —— DOM 节点会随滚动累积，10k 张依然卡。叠加后两边都是常数级开销。

**Page size = 500** 的取舍：太小（如 50）滚动体验有 jitter；太大（如 5000）首屏 IPC 等待时间长。500 张元数据约 100KB，IPC < 50ms，覆盖大约 5–8 屏的滚动距离，预读时机舒服。

## Data flow

### State shape (in `ImageGrid.tsx`)

```ts
const [images, setImages] = useState<ImageItem[]>([]);     // accumulating
const [totalCount, setTotalCount] = useState<number>(0);   // for hasMore check
const [isLoadingPage, setIsLoadingPage] = useState(false);
// loadedCount = images.length
// hasMore = images.length < totalCount
```

`searchResultIds !== null` 时，分页逻辑短路（搜索结果天然有 200 上限，由 `getImagesByIds` 一次性返回）。

### Lifecycle

| 事件 | 行为 |
|---|---|
| 文件夹切换 / 首次挂载 | `images = []`, fetch page 1 (offset=0, limit=500), `countImages` 拿 totalCount |
| 滚动到接近 tail（virtualizer.range.endIndex ≥ lastLoadedRow - 2） | fetch next page，append |
| 删除 | `setImages(prev => prev.filter(...))`，totalCount-- |
| 导入 | reload first page（新图按 created_at DESC 在最前） |
| 搜索结果 | `images = await getImagesByIds(ids.slice(0,200))`，分页机制不参与 |
| 搜索清除 | 回到文件夹首页 |

## Component-level changes

### 1. `src/services/tauriBridge.ts`

```ts
// raise default to 500 (sane fallback for callers that don't paginate)
export async function getImages(folderId?: string, offset = 0, limit = 500): Promise<ImageItem[]>

// new
export async function countImages(folderId?: string): Promise<number>
```

### 2. `src-tauri/src/commands/image_commands.rs` + `src-tauri/src/db/images.rs`

新增 `count_images(folder_id: Option<String>) -> i64`：

```sql
-- 有 folder_id
SELECT COUNT(*) FROM images i
JOIN image_folders f ON f.image_id = i.id
WHERE f.folder_id = ?

-- 无 folder_id
SELECT COUNT(*) FROM images
```

注册到 `lib.rs` 的 invoke handler。

### 3. New hook `src/hooks/useGridDimensions.ts`

**布局常量（在 `src/utils/gridGeometry.ts` 里集中定义，全文件共享）**：

```ts
export const GRID_GAP = 24;       // matches Tailwind gap-6
export const GRID_PADDING = 24;   // matches Tailwind p-6 on scroll container
```

Hook 接口：

- 输入：`containerRef`、`cellSize`（即 `gridSize` state，正方形 cell —— 依赖于 `ImageCard` 内 `aspect-square` 的既有约束）
- 输出：`{ columnCount, rowHeight }`
- 内部用 `ResizeObserver` 监听容器宽度变化
- `columnCount = Math.max(1, Math.floor((containerWidth - 2*GRID_PADDING + GRID_GAP) / (cellSize + GRID_GAP)))`
  - 推导：N 列内容宽度 = `N*cellSize + (N-1)*gap`，要求 ≤ `containerWidth - 2*padding`
- `rowHeight = cellSize + GRID_GAP`
- **抖动处理**：仅当新计算的 `columnCount`/`rowHeight` 与上次不同才 `setState`（短路相同值），不引入 setTimeout

### 4. `src/components/layout/ImageGrid.tsx` — 核心改造

引入 `@tanstack/react-virtual`：

```tsx
const { columnCount, rowHeight } = useGridDimensions(scrollContainerRef, gridSize, 24);
const rowCount = Math.ceil(images.length / columnCount);

const rowVirtualizer = useVirtualizer({
  count: rowCount,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => rowHeight,
  overscan: 3,
});

// load more when nearing the end
useEffect(() => {
  const range = rowVirtualizer.range;
  if (!range || isLoadingPage || images.length >= totalCount) return;
  const lastLoadedRow = Math.floor(images.length / columnCount);
  if (range.endIndex >= lastLoadedRow - 2) loadMore();
}, [rowVirtualizer.range, images.length, totalCount, columnCount]);
```

渲染：

```tsx
<div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
  {rowVirtualizer.getVirtualItems().map(virtualRow => (
    <div
      key={virtualRow.key}
      style={{
        position: 'absolute',
        top: virtualRow.start,
        left: 0, right: 0,
        height: virtualRow.size,
        display: 'grid',
        gridTemplateColumns: `repeat(${columnCount}, ${gridSize}px)`,
        gap: '24px',
        justifyContent: 'start',
      }}
    >
      {Array.from({ length: columnCount }).map((_, col) => {
        const idx = virtualRow.index * columnCount + col;
        const image = images[idx];
        if (!image) return null;
        return <ImageCard key={image.id} image={image} ... />;
      })}
    </div>
  ))}
</div>
```

要保留的现有行为（不变）：

- `data-image-card` / `data-image-id` 属性（拖拽 + 选中识别）
- 右键菜单触发逻辑
- `handleDragStart` 写入 `application/snaplex-images` payload
- 多选 Set 状态 `multiSelected`
- 搜索结果路径：`searchResultIds !== null` 时短路分页

### 5. Rectangle selection 重设计（**关键改动**）

当前实现 [`ImageGrid.tsx:280-298`](../../../src/components/layout/ImageGrid.tsx#L280) 用 `container.querySelectorAll('[data-image-card]')` 遍历 DOM。windowing 后 DOM 里只有视口附近 30–60 张，**滑过滚动条之外的卡片选不中**。

修复：用数学位置而非 DOM 查询。给每个 `images[i]` 计算逻辑位置：

```ts
function cardRectAtIndex(i: number, columnCount: number, cellSize: number, gap: number, paddingX: number, paddingY: number) {
  const row = Math.floor(i / columnCount);
  const col = i % columnCount;
  return {
    left:   paddingX + col * (cellSize + gap),
    top:    paddingY + row * (cellSize + gap),
    right:  paddingX + col * (cellSize + gap) + cellSize,
    bottom: paddingY + row * (cellSize + gap) + cellSize,
  };
}

// In handleGridMouseMove:
const selected = new Set<string>();
for (let i = 0; i < images.length; i++) {
  const r = cardRectAtIndex(i, columnCount, gridSize, GRID_GAP, GRID_PADDING, GRID_PADDING);
  if (selRect.left < r.right && selRect.right > r.left &&
      selRect.top < r.bottom && selRect.bottom > r.top) {
    selected.add(images[i].id);
  }
}
```

副产品：rect-select 现在能选中**还未渲染**的卡片，比当前实现更正确（当前 N=50 时不会暴露这个 bug，N=5000 时会）。

把 `cardRectAtIndex` 抽出到 `src/utils/gridGeometry.ts` 配单元测试。

### 6. Drop overlay & padding

`p-6` (24px) 是滚动容器的 padding，`gap-6` (24px) 是格子间距。windowing 容器（`getTotalSize` 那个 div）需要在外层套一个 padding 层，或把 padding 算进 paddingX/paddingY 传给虚拟化数学。**选后者** —— 内层 absolute 定位 + paddingX/paddingY 偏移，避免 padding 干扰滚动高度计算。

## Edge cases

| 情况 | 处理 |
|---|---|
| 空文件夹 | totalCount=0，渲染既有"No images"占位 |
| 第一页正在加载 | 既有 `loading && images.length === 0` 占位继续生效 |
| 最后一页不足 500 | hasMore = false，停止 loadMore 触发 |
| 滚动飞速到底 | 未加载的 row 渲染**淡灰色占位 div**（高度=cellSize、`bg-stone-100/40 dark:bg-stone-800/40`），保持滚动条总高稳定，loadMore 触发后这些 cell 直接变成 ImageCard。不放 spinner（IPC < 50ms 就回来了，spinner 反而抖） |
| 文件夹切换中途加载 | 通过 useEffect cleanup + 一个 mounted ref 丢弃过期 fetch 结果，folderId mismatch 时直接 return |
| ResizeObserver 抖动 | useGridDimensions 在新值与旧值相同时短路 setState（见上文） |
| Search → clear → folder | search 路径不增长 totalCount，clear 后回退到文件夹首页 |
| 删除当前选中且未渲染的图 | totalCount-- 后 virtualizer 自动收缩 |

## Testing strategy

### 自动化

- `src/utils/gridGeometry.test.ts`：`cardRectAtIndex` 表驱动测试（边界、单列、刚好填满最后一行）
- `src/utils/gridGeometry.test.ts`：rect-select 相交检测的小测试
- `src/hooks/useGridDimensions.test.ts`：mock ResizeObserver 验证 columnCount 计算
- `cargo test` — 新加 `count_images` 的 db 层测试

### 手工（`pnpm tauri dev`）

- 库 > 100 张：滚动到底，逐张可见
- 大量并行导入：100 张拖入，立即出现在顶部
- 拖动滚动条到中段 → 矩形框选 → 跨视口拖动 → 滚回 → 已选中卡片仍标记
- 调整 gridSize 滑块 → 列数 reflow，滚动位置不抖
- 多选 Cmd+click 两个相距 1000+ 的卡片 → 批量删除生效
- 搜索 → 结果出现（不触发分页机制）→ 清除 → 回到完整列表
- 文件夹切换 → 滚动条重置到顶
- 删除某张 → totalCount 减一，下方卡片上移补位

### 性能 sanity check

`pnpm tauri dev` 中 import 1000 张测试图（脚本生成纯色 PNG），观察：
- 启动到列表可滚 < 1 秒
- 滚动 60fps 不掉
- 内存 < 500 MB（无真缩略图，纯靠原图懒加载）

## Risk & rollback

| 风险 | 缓解 |
|---|---|
| react-virtual + grid 布局有列数计算 bug | 列数计算独立 hook + 单元测试，gap/padding 用常量传递 |
| Rect-select 数学错误 | 几何函数抽出独立 util + 表驱动测试 |
| 滚动期 fetch race | 用 mounted ref + folderId 一致性检查丢弃过期结果 |
| 依赖 tanstack/react-virtual 引入大体积 | 实测 ~5KB gzipped；package.json 加之前 `pnpm why @tanstack/react-virtual` 复核 |

回滚成本：改动集中在 `ImageGrid.tsx` + 1 个 hook + 1 个 util + `tauriBridge.ts` 3 行 + 后端 1 个新 command。Revert 单一 commit 即可。

## Files touched

```
M  src/components/layout/ImageGrid.tsx       (~200 lines net change)
M  src/services/tauriBridge.ts               (~10 lines)
M  src-tauri/src/commands/image_commands.rs  (~15 lines)
M  src-tauri/src/db/images.rs                (~15 lines)
M  src-tauri/src/lib.rs                      (1 line — register command)
M  package.json                              (+1 dep)
A  src/hooks/useGridDimensions.ts            (~50 lines)
A  src/utils/gridGeometry.ts                 (~30 lines)
A  src/utils/gridGeometry.test.ts            (~80 lines)
A  src/hooks/useGridDimensions.test.ts       (~50 lines)
```

## Verification gates before merge

- [ ] `cargo check` clean
- [ ] `cargo test` clean
- [ ] `pnpm test` clean (existing 26 tests + new ones)
- [ ] `pnpm tauri dev` 中所有手工测试项通过
- [ ] 1000 图性能 sanity 通过
