# Virtual Scroll & Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the implicit 50-item grid limit with backend pagination + frontend virtual scrolling so any folder size is browsable with constant DOM/memory cost.

**Architecture:** Two-layer stack — backend pages of 500 fed via existing `get_images(folderId, offset, limit)` IPC; frontend `@tanstack/react-virtual` renders only viewport rows + 3 overscan. Rect-select switches from DOM querying to mathematical hit testing so it works across the entire logical grid (including unrendered cards). Layout constants (`GRID_GAP=24`, `GRID_PADDING=24`) are centralized.

**Tech Stack:** React 19, TypeScript, `@tanstack/react-virtual` (new), Tauri v2, Rust + rusqlite, Vitest (jsdom), TailwindCSS.

**Pre-task hygiene:** Working tree currently has uncommitted deletions from the prior refactor on `dev/phase-0-1-2`. Before starting Task 0, decide with user:
- (a) commit those deletions on `dev/phase-0-1-2` first (`git add -A && git commit -m "chore: remove obsolete web-only files after refactor"`), then branch off cleanly, OR
- (b) stash them and pop after this feature, OR
- (c) branch off including them.
Plan assumes (a) — clean starting point on a new branch.

**Source spec:** [`docs/superpowers/specs/2026-04-28-virtual-scroll-pagination-design.md`](../specs/2026-04-28-virtual-scroll-pagination-design.md)

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `src/utils/gridGeometry.ts` | Create | Pure layout math: constants `GRID_GAP`, `GRID_PADDING`; `cardRectAtIndex()`; `rectsIntersect()` |
| `src/utils/gridGeometry.test.ts` | Create | Vitest unit tests for the math |
| `src/hooks/useGridDimensions.ts` | Create | ResizeObserver-driven `{columnCount, rowHeight}` hook with same-value short-circuit |
| `src/hooks/useGridDimensions.test.ts` | Create | Vitest tests with mocked ResizeObserver + jsdom |
| `src/__tests__/setup.ts` | Modify | Add ResizeObserver mock |
| `src-tauri/src/db/images.rs` | Modify | Add `count_images()` |
| `src-tauri/src/commands/image_commands.rs` | Modify | Add `#[tauri::command] count_images` |
| `src-tauri/src/lib.rs` | Modify | Register `count_images` in `invoke_handler!` |
| `src/services/tauriBridge.ts` | Modify | Raise `getImages` default `limit` 50→500; add `countImages()` |
| `src/hooks/useTauriIPC.ts` | Modify | Raise `getImages` default to 500; add `countImages` direct invoke (this hook does not delegate to tauriBridge) |
| `src/components/layout/ImageGrid.tsx` | Modify (major) | Replace render block with `useVirtualizer`; switch rect-select to math; add page-fetching lifecycle |
| `package.json` | Modify | Add `@tanstack/react-virtual` |

---

## Task 0: Branch & Dependency Setup

**Files:**
- Modify: `package.json`

- [ ] **Step 0.1: Confirm clean working tree, create branch**

```bash
cd /Users/ccginger/Downloads/Antigravity/Snaplex-1231/snaplex
git status                    # should be clean per pre-task hygiene
git checkout -b feat/virtual-scroll
```

- [ ] **Step 0.2: Install `@tanstack/react-virtual`**

```bash
pnpm add @tanstack/react-virtual
```

Expected: `package.json` and `pnpm-lock.yaml` updated. Verify with `pnpm why @tanstack/react-virtual` — should show v3.x and gzipped size < 10KB.

- [ ] **Step 0.3: Verify install didn't break the build**

```bash
pnpm test           # 26 existing tests should still pass
pnpm build          # vite build should succeed
```

- [ ] **Step 0.4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @tanstack/react-virtual dependency"
```

---

## Task 1: Grid Geometry Utility (TDD)

**Files:**
- Create: `src/utils/gridGeometry.ts`
- Create: `src/utils/gridGeometry.test.ts`

- [ ] **Step 1.1: Write failing tests**

Create `src/utils/gridGeometry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardRectAtIndex, rectsIntersect, GRID_GAP, GRID_PADDING } from './gridGeometry';

describe('gridGeometry', () => {
  it('exports layout constants matching Tailwind p-6/gap-6', () => {
    expect(GRID_GAP).toBe(24);
    expect(GRID_PADDING).toBe(24);
  });

  describe('cardRectAtIndex', () => {
    it('places index 0 at top-left padding', () => {
      const r = cardRectAtIndex(0, 4, 200, GRID_GAP, GRID_PADDING, GRID_PADDING);
      expect(r).toEqual({ left: 24, top: 24, right: 224, bottom: 224 });
    });

    it('places index 1 to the right of index 0 with gap', () => {
      const r = cardRectAtIndex(1, 4, 200, GRID_GAP, GRID_PADDING, GRID_PADDING);
      expect(r.left).toBe(24 + 200 + 24); // padding + cellSize + gap
      expect(r.top).toBe(24);
    });

    it('wraps to next row when index reaches columnCount', () => {
      const r = cardRectAtIndex(4, 4, 200, GRID_GAP, GRID_PADDING, GRID_PADDING);
      expect(r.left).toBe(24);
      expect(r.top).toBe(24 + 200 + 24);
    });

    it('handles 1-column layout', () => {
      const r0 = cardRectAtIndex(0, 1, 300, GRID_GAP, GRID_PADDING, GRID_PADDING);
      const r1 = cardRectAtIndex(1, 1, 300, GRID_GAP, GRID_PADDING, GRID_PADDING);
      expect(r0.left).toBe(24);
      expect(r1.left).toBe(24);
      expect(r1.top).toBe(24 + 300 + 24);
    });

    it('handles index past first row in 3-column layout', () => {
      const r = cardRectAtIndex(7, 3, 100, GRID_GAP, GRID_PADDING, GRID_PADDING);
      // row=2, col=1
      expect(r.left).toBe(24 + 100 + 24);
      expect(r.top).toBe(24 + 2 * (100 + 24));
    });
  });

  describe('rectsIntersect', () => {
    const A = { left: 0, top: 0, right: 100, bottom: 100 };

    it('returns true for fully overlapping rects', () => {
      expect(rectsIntersect(A, { left: 10, top: 10, right: 50, bottom: 50 })).toBe(true);
    });

    it('returns true for partially overlapping rects', () => {
      expect(rectsIntersect(A, { left: 50, top: 50, right: 150, bottom: 150 })).toBe(true);
    });

    it('returns false for disjoint rects (right of A)', () => {
      expect(rectsIntersect(A, { left: 200, top: 0, right: 300, bottom: 100 })).toBe(false);
    });

    it('returns false for disjoint rects (below A)', () => {
      expect(rectsIntersect(A, { left: 0, top: 200, right: 100, bottom: 300 })).toBe(false);
    });

    it('returns false for edge-touching rects (open intervals)', () => {
      expect(rectsIntersect(A, { left: 100, top: 0, right: 200, bottom: 100 })).toBe(false);
    });
  });
});
```

- [ ] **Step 1.2: Run tests — verify they fail with module-not-found**

```bash
pnpm test src/utils/gridGeometry.test.ts
```

Expected: `Cannot find module './gridGeometry'` — that's the failure we want.

- [ ] **Step 1.3: Implement minimal `gridGeometry.ts`**

Create `src/utils/gridGeometry.ts`:

```ts
export const GRID_GAP = 24;       // matches Tailwind gap-6
export const GRID_PADDING = 24;   // matches Tailwind p-6 on scroll container

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function cardRectAtIndex(
  index: number,
  columnCount: number,
  cellSize: number,
  gap: number,
  paddingX: number,
  paddingY: number
): Rect {
  const row = Math.floor(index / columnCount);
  const col = index % columnCount;
  const left = paddingX + col * (cellSize + gap);
  const top = paddingY + row * (cellSize + gap);
  return {
    left,
    top,
    right: left + cellSize,
    bottom: top + cellSize,
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
```

- [ ] **Step 1.4: Run tests — verify they pass**

```bash
pnpm test src/utils/gridGeometry.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 1.5: Run full test suite — ensure no regression**

```bash
pnpm test
```

Expected: 26 + 9 = 35 tests PASS.

- [ ] **Step 1.6: Commit**

```bash
git add src/utils/gridGeometry.ts src/utils/gridGeometry.test.ts
git commit -m "feat: add grid geometry utility for virtualized layout math"
```

---

## Task 2: useGridDimensions Hook (TDD)

**Files:**
- Modify: `src/__tests__/setup.ts`
- Create: `src/hooks/useGridDimensions.ts`
- Create: `src/hooks/useGridDimensions.test.ts`

- [ ] **Step 2.1: Add ResizeObserver mock to test setup**

Edit `src/__tests__/setup.ts` — append after the matchMedia mock (before `setupTauriMocks()`):

```ts
// Mock ResizeObserver (not available in jsdom)
class ResizeObserverMock {
  callback: ResizeObserverCallback;
  static instances: ResizeObserverMock[] = [];
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    ResizeObserverMock.instances.push(this);
  }
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  // helper for tests to drive resize events
  _trigger(width: number, height: number) {
    const entry = {
      contentRect: { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) },
      target: {} as Element,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
}
(globalThis as any).ResizeObserver = ResizeObserverMock;
(globalThis as any).__ResizeObserverMock = ResizeObserverMock;
```

- [ ] **Step 2.2: Verify existing tests still pass with new mock**

```bash
pnpm test
```

Expected: all 35 tests still PASS.

- [ ] **Step 2.3: Write failing hook tests**

Create `src/hooks/useGridDimensions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useGridDimensions } from './useGridDimensions';

declare const __ResizeObserverMock: {
  instances: Array<{ _trigger: (w: number, h: number) => void }>;
};

beforeEach(() => {
  __ResizeObserverMock.instances.length = 0;
});

function setup(cellSize: number, initialWidth = 0) {
  const { result } = renderHook(() => {
    const ref = useRef<HTMLDivElement>({ clientWidth: initialWidth } as HTMLDivElement);
    const dims = useGridDimensions(ref, cellSize);
    return { ref, dims };
  });
  return result;
}

describe('useGridDimensions', () => {
  it('returns sensible defaults before any resize fires', () => {
    const r = setup(200);
    expect(r.current.dims.columnCount).toBeGreaterThanOrEqual(1);
    expect(r.current.dims.rowHeight).toBe(200 + 24); // cellSize + GRID_GAP
  });

  it('computes columnCount from container width', () => {
    const r = setup(200);
    act(() => {
      __ResizeObserverMock.instances[0]._trigger(1024, 800);
    });
    // (1024 - 2*24 + 24) / (200 + 24) = 1000/224 = 4.46 → floor = 4
    expect(r.current.dims.columnCount).toBe(4);
    expect(r.current.dims.rowHeight).toBe(224);
  });

  it('computes 1 column when container too narrow', () => {
    const r = setup(300);
    act(() => {
      __ResizeObserverMock.instances[0]._trigger(200, 800);
    });
    // (200 - 48 + 24) / (300 + 24) = 176/324 = 0.54 → floor → max(1) = 1
    expect(r.current.dims.columnCount).toBe(1);
  });

  it('updates rowHeight when cellSize changes', () => {
    let cellSize = 200;
    const { result, rerender } = renderHook(() => {
      const ref = useRef<HTMLDivElement>({ clientWidth: 1000 } as HTMLDivElement);
      return useGridDimensions(ref, cellSize);
    });
    act(() => {
      __ResizeObserverMock.instances[0]._trigger(1000, 800);
    });
    expect(result.current.rowHeight).toBe(224);
    cellSize = 300;
    rerender();
    expect(result.current.rowHeight).toBe(324);
  });
});
```

- [ ] **Step 2.4: Run tests — verify they fail with module-not-found**

```bash
pnpm test src/hooks/useGridDimensions.test.ts
```

Expected: import error.

- [ ] **Step 2.5: Implement `useGridDimensions.ts`**

Create `src/hooks/useGridDimensions.ts`:

```ts
import { RefObject, useEffect, useState } from 'react';
import { GRID_GAP, GRID_PADDING } from '@/utils/gridGeometry';

export interface GridDimensions {
  columnCount: number;
  rowHeight: number;
}

function computeColumnCount(containerWidth: number, cellSize: number): number {
  if (containerWidth <= 0) return 1;
  return Math.max(
    1,
    Math.floor((containerWidth - 2 * GRID_PADDING + GRID_GAP) / (cellSize + GRID_GAP))
  );
}

export function useGridDimensions(
  containerRef: RefObject<HTMLElement | null>,
  cellSize: number
): GridDimensions {
  const [dims, setDims] = useState<GridDimensions>(() => ({
    columnCount: 1,
    rowHeight: cellSize + GRID_GAP,
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = (width: number) => {
      const columnCount = computeColumnCount(width, cellSize);
      const rowHeight = cellSize + GRID_GAP;
      setDims(prev => {
        if (prev.columnCount === columnCount && prev.rowHeight === rowHeight) {
          return prev; // short-circuit identical values
        }
        return { columnCount, rowHeight };
      });
    };

    update(el.clientWidth);

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, cellSize]);

  return dims;
}
```

- [ ] **Step 2.6: Run tests — verify they pass**

```bash
pnpm test src/hooks/useGridDimensions.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 2.7: Run full suite**

```bash
pnpm test
```

Expected: 35 + 4 = 39 tests PASS.

- [ ] **Step 2.8: Commit**

```bash
git add src/__tests__/setup.ts src/hooks/useGridDimensions.ts src/hooks/useGridDimensions.test.ts
git commit -m "feat: add useGridDimensions hook with ResizeObserver-driven column count"
```

---

## Task 3: Backend `count_images` IPC

**Files:**
- Modify: `src-tauri/src/db/images.rs`
- Modify: `src-tauri/src/commands/image_commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Note:** No existing rust test infrastructure; risk is low (5-line SQL count). Verify via `cargo check` + manual smoke test in Task 6.

- [ ] **Step 3.1: Add `count_images` to `db/images.rs`**

In `src-tauri/src/db/images.rs`, add this function below `get_images` (around line 110):

```rust
pub fn count_images(
    conn: &Connection,
    folder_id: Option<&str>,
) -> Result<i64, rusqlite::Error> {
    if let Some(fid) = folder_id {
        conn.query_row(
            "SELECT COUNT(*) FROM images i
             JOIN image_folders if2 ON i.id = if2.image_id
             WHERE if2.folder_id = ?1",
            rusqlite::params![fid],
            |row| row.get(0),
        )
    } else {
        conn.query_row(
            "SELECT COUNT(*) FROM images",
            [],
            |row| row.get(0),
        )
    }
}
```

- [ ] **Step 3.2: Add `count_images` command to `commands/image_commands.rs`**

In `src-tauri/src/commands/image_commands.rs`, add below `get_images_by_ids` (around line 38):

```rust
/// §5.3 — count_images (for pagination total)
#[tauri::command]
pub fn count_images(
    folder_id: Option<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<i64, String> {
    with_db(&db_state, |conn| {
        images::count_images(conn, folder_id.as_deref())
    })
}
```

- [ ] **Step 3.3: Register command in `lib.rs`**

In `src-tauri/src/lib.rs`, find the `tauri::generate_handler![` block. After the line `commands::image_commands::get_images_by_ids,` add:

```rust
            commands::image_commands::count_images,
```

- [ ] **Step 3.4: Verify it compiles**

```bash
cd src-tauri && cargo check && cd ..
```

Expected: `cargo check` succeeds with no new warnings.

- [ ] **Step 3.5: Commit**

```bash
git add src-tauri/src/db/images.rs src-tauri/src/commands/image_commands.rs src-tauri/src/lib.rs
git commit -m "feat(backend): add count_images IPC for pagination total"
```

---

## Task 4: Bridges — `countImages` + raise `getImages` default

**Files:**
- Modify: `src/services/tauriBridge.ts`
- Modify: `src/hooks/useTauriIPC.ts`

**Important:** `useTauriIPC.ts` is **independent** of `tauriBridge.ts` — it calls `invoke` directly from `@tauri-apps/api/core` and has its own `getImages` with a `limit: number = 50` default at line 26. Both files must be updated.

- [ ] **Step 4.1: Update `tauriBridge.ts`**

In `src/services/tauriBridge.ts`, replace lines 77–81:

```ts
export async function getImages(folderId?: string, offset: number = 0, limit: number = 50): Promise<ImageItem[]> {
  const invoke = await getInvoke();
  if (!invoke) return [];
  return invoke('get_images', { folderId, offset, limit }) as Promise<ImageItem[]>;
}
```

with:

```ts
export async function getImages(folderId?: string, offset: number = 0, limit: number = 500): Promise<ImageItem[]> {
  const invoke = await getInvoke();
  if (!invoke) return [];
  return invoke('get_images', { folderId, offset, limit }) as Promise<ImageItem[]>;
}

export async function countImages(folderId?: string): Promise<number> {
  const invoke = await getInvoke();
  if (!invoke) return 0;
  return invoke('count_images', { folderId }) as Promise<number>;
}
```

- [ ] **Step 4.2: Update `useTauriIPC.ts`**

In `src/hooks/useTauriIPC.ts`, replace line 26-27:

```ts
  getImages: (folderId?: string, offset: number = 0, limit: number = 50) =>
    invoke<ImageItem[]>('get_images', { folderId, offset, limit }),
```

with:

```ts
  getImages: (folderId?: string, offset: number = 0, limit: number = 500) =>
    invoke<ImageItem[]>('get_images', { folderId, offset, limit }),
  countImages: (folderId?: string) =>
    invoke<number>('count_images', { folderId }),
```

- [ ] **Step 4.3: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: vite build succeeds. (Use `pnpm build` instead of a separate tsc step — vite runs tsc internally.)

- [ ] **Step 4.4: Run tests**

```bash
pnpm test
```

Expected: 39 tests still PASS (no behavior change yet — defaults raised but ImageGrid still calls without explicit limit, which now means 500).

- [ ] **Step 4.5: Commit**

```bash
git add src/services/tauriBridge.ts src/hooks/useTauriIPC.ts
git commit -m "feat: add countImages IPC, raise getImages default limit 50→500"
```

---

## Task 5: ImageGrid — Virtualizer Integration + Math Rect-Select

**Files:**
- Modify: `src/components/layout/ImageGrid.tsx`

This is the largest single change. It replaces the `<div className="grid ...">` block with a virtualized layout AND switches `handleGridMouseMove`'s rect-select to use `cardRectAtIndex` math.

**Why bundle these two changes:** if we virtualize first, rect-select silently degrades (only selects visible cards) until we fix it. Bundling avoids an intermediate broken state.

This task does NOT yet add pagination/`countImages`/`loadMore` — that lands in Task 6. After Task 5 the grid still loads only the first 500 images, but renders them virtually and selects them correctly via math.

- [ ] **Step 5.1: Add imports at top of `ImageGrid.tsx`**

After the existing imports (around line 11), add:

```ts
import { useVirtualizer } from '@tanstack/react-virtual';
import { useGridDimensions } from '@/hooks/useGridDimensions';
import { cardRectAtIndex, rectsIntersect, GRID_GAP, GRID_PADDING } from '@/utils/gridGeometry';
```

- [ ] **Step 5.2: Wire up virtualizer inside the component body**

After the existing state declarations (after `const importingRef = useRef(false);` at ~line 43), add:

```ts
const { columnCount, rowHeight } = useGridDimensions(scrollContainerRef, gridSize);
const rowCount = Math.ceil(images.length / Math.max(1, columnCount));

const rowVirtualizer = useVirtualizer({
  count: rowCount,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => rowHeight,
  overscan: 3,
});
```

- [ ] **Step 5.3: Replace rect-select math in `handleGridMouseMove`**

Locate `handleGridMouseMove` (around line 265) and replace the body's selection-detection portion. Before:

```ts
const container = e.currentTarget as HTMLElement;
const cards = container.querySelectorAll('[data-image-card]');
const selected = new Set<string>();
cards.forEach(card => {
  const cardRect = card.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const cardRelative = { /* ... */ };
  if (selRect.left < cardRelative.right && selRect.right > cardRelative.left &&
      selRect.top < cardRelative.bottom && selRect.bottom > cardRelative.top) {
    const id = card.getAttribute('data-image-id');
    if (id) selected.add(id);
  }
});
setMultiSelected(selected);
```

After (replace from `const container = ...` through `setMultiSelected(selected);`):

```ts
const selected = new Set<string>();
for (let i = 0; i < images.length; i++) {
  const r = cardRectAtIndex(i, Math.max(1, columnCount), gridSize, GRID_GAP, GRID_PADDING, GRID_PADDING);
  if (rectsIntersect(selRect, r)) {
    selected.add(images[i].id);
  }
}
setMultiSelected(selected);
```

Update the dependency array of `handleGridMouseMove`'s `useCallback` to include the new dependencies:

```ts
}, [rectSelect, images, columnCount, gridSize]);
```

- [ ] **Step 5.4: Replace the grid render block**

Locate the existing render (around line 533–554):

```tsx
) : (
  <div 
    className="grid gap-6 auto-rows-max"
    style={{ 
      gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))` 
    }}
  >
    {images.map(image => (
      <ImageCard
        key={image.id}
        image={image}
        isSelected={selectedImageId === image.id || multiSelected.has(image.id)}
        onClick={(e) => handleImageClick(image.id, e)}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeleteImage}
        onOpenInFinder={handleOpenInFinder}
        onMoveToFolder={handleMoveToFolder}
        onDragStart={(e) => handleDragStart(image.id, e)}
      />
    ))}
  </div>
)}
```

Replace with:

```tsx
) : (
  <div
    style={{
      height: rowVirtualizer.getTotalSize() + 2 * GRID_PADDING,
      position: 'relative',
      width: '100%',
    }}
  >
    {rowVirtualizer.getVirtualItems().map(virtualRow => (
      <div
        key={virtualRow.key}
        style={{
          position: 'absolute',
          top: virtualRow.start + GRID_PADDING,
          left: GRID_PADDING,
          right: GRID_PADDING,
          height: gridSize,
          display: 'grid',
          gridTemplateColumns: `repeat(${columnCount}, ${gridSize}px)`,
          gap: `${GRID_GAP}px`,
          justifyContent: 'start',
        }}
      >
        {Array.from({ length: columnCount }).map((_, col) => {
          const idx = virtualRow.index * columnCount + col;
          const image = images[idx];
          if (!image) {
            // Unloaded slot (will fill once Task 6 pagination arrives) — keep layout stable
            return (
              <div
                key={`placeholder-${virtualRow.index}-${col}`}
                className="rounded-xl bg-stone-100/40 dark:bg-stone-800/40"
                style={{ width: gridSize, height: gridSize }}
              />
            );
          }
          return (
            <ImageCard
              key={image.id}
              image={image}
              isSelected={selectedImageId === image.id || multiSelected.has(image.id)}
              onClick={(e) => handleImageClick(image.id, e)}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDeleteImage}
              onOpenInFinder={handleOpenInFinder}
              onMoveToFolder={handleMoveToFolder}
              onDragStart={(e) => handleDragStart(image.id, e)}
            />
          );
        })}
      </div>
    ))}
  </div>
)}
```

Note: the outer scroll container (`<div ref={scrollContainerRef} ...>` at line 498) keeps `p-6` for empty/loading states; **remove `p-6` from its className** since the virtualized inner container now manages padding via `GRID_PADDING` math. The empty/loading states need their own padding wrapper. Replace:

```tsx
className={`flex-1 overflow-y-auto p-6 scroll-smooth relative select-none ${isDragOver ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
```

with:

```tsx
className={`flex-1 overflow-y-auto scroll-smooth relative select-none ${isDragOver ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
```

And wrap the empty/loading branches in `<div className="p-6 h-full">...</div>`. For the loading branch:

```tsx
{loading && images.length === 0 ? (
  <div className="p-6 h-full">
    <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-3">
      {/* spinner unchanged */}
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-medium">Loading...</p>
    </div>
  </div>
) : images.length === 0 ? (
  <div className="p-6 h-full">
    <div onClick={handleClickUpload} className="flex flex-col items-center justify-center h-full text-stone-400 gap-4 opacity-60 hover:opacity-80 cursor-pointer transition-opacity">
      {/* upload prompt unchanged */}
      ...
    </div>
  </div>
) : (
  /* virtualized block from above */
)}
```

- [ ] **Step 5.5: Run tests — geometry tests should still pass**

```bash
pnpm test
```

Expected: 39 tests PASS.

- [ ] **Step 5.6: Build to catch type errors**

```bash
pnpm build
```

Expected: success.

- [ ] **Step 5.7: Manual smoke test (`pnpm tauri dev`)**

Run `pnpm tauri dev` and verify:

1. Existing library opens, images render in the grid as before
2. Scrolling is smooth, no DOM bloat (open Chrome DevTools elements panel — only ~1-2 rows × columnCount cards in DOM at any time)
3. Click selects an image → detail panel updates
4. Cmd+click adds to multi-select
5. Right-click on a card → context menu appears
6. Drag a card to a sidebar folder → image moves
7. Drag a rectangle across multiple cards → all covered cards highlight (including ones at the bottom of the visible region)
8. Adjust gridSize slider → cell size + column count update without scroll jump
9. Resize the window → column count recomputes
10. Switch folders → grid reloads from the top
11. Search → results show (still using `searchResultIds` path, no virtualizer changes needed for it since results cap at 200)
12. Drag image files into the window → import works, new images appear at top

If any item fails, debug and re-run. Don't proceed to commit until all 12 pass.

- [ ] **Step 5.8: Commit**

```bash
git add src/components/layout/ImageGrid.tsx
git commit -m "refactor(ImageGrid): virtualize grid + math-based rect-select"
```

---

## Task 6: ImageGrid — Pagination Lifecycle

**Files:**
- Modify: `src/components/layout/ImageGrid.tsx`

Adds incremental page fetching tied to virtualizer scroll position, plus correct counts for delete/import lifecycle events.

- [ ] **Step 6.1: Destructure `countImages` from `useTauriIPC`**

Update line 31 of `ImageGrid.tsx`:

```ts
const { getImages, getImageDetail, getImagesByIds, countImages, importImages, deleteImages, toggleFavorite, openImageInFinder, moveImages, getFolderTree } = useTauriIPC();
```

- [ ] **Step 6.2: Add pagination state**

After existing state declarations (~line 41), add:

```ts
const [totalCount, setTotalCount] = useState(0);
const [isLoadingPage, setIsLoadingPage] = useState(false);
const PAGE_SIZE = 500;
const folderRequestRef = useRef<string | undefined>(undefined);
```

- [ ] **Step 6.3: Replace `loadImages` with paginated first-page fetcher**

Replace the existing `loadImages` (lines 49–59) with:

```ts
const loadImages = useCallback(async () => {
  setLoading(true);
  setIsLoadingPage(true);
  const requestFolder = folderId;
  folderRequestRef.current = requestFolder;
  try {
    const [firstPage, total] = await Promise.all([
      getImages(folderId, 0, PAGE_SIZE),
      countImages(folderId),
    ]);
    // Race guard: drop if folder changed during the await
    if (folderRequestRef.current !== requestFolder) return;
    setImages(firstPage);
    setTotalCount(total);
  } catch (err) {
    showToast(`Failed to load images: ${err}`, 'error');
  } finally {
    setLoading(false);
    setIsLoadingPage(false);
  }
}, [folderId, getImages, countImages]);
```

- [ ] **Step 6.4: Add `loadMore` for incremental pages**

After `loadImages`, add:

```ts
const loadMore = useCallback(async () => {
  if (isLoadingPage) return;
  if (images.length >= totalCount) return;
  if (searchResultIds !== null) return; // search path doesn't paginate

  setIsLoadingPage(true);
  const requestFolder = folderId;
  folderRequestRef.current = requestFolder;
  try {
    const nextPage = await getImages(folderId, images.length, PAGE_SIZE);
    if (folderRequestRef.current !== requestFolder) return;
    setImages(prev => [...prev, ...nextPage]);
  } catch (err) {
    showToast(`Failed to load more images: ${err}`, 'error');
  } finally {
    setIsLoadingPage(false);
  }
}, [folderId, images.length, totalCount, isLoadingPage, searchResultIds, getImages]);
```

- [ ] **Step 6.5: Trigger `loadMore` near tail**

After the `rowVirtualizer` declaration (added in Task 5), capture the virtual items and add the effect. This follows the canonical pattern from `@tanstack/react-virtual`'s infinite-scroll example — `getVirtualItems()` is internally memoized so its array reference is stable across renders where the visible range hasn't changed:

```ts
const virtualItems = rowVirtualizer.getVirtualItems();

useEffect(() => {
  if (searchResultIds !== null) return;
  if (images.length >= totalCount) return;
  if (virtualItems.length === 0) return;

  const lastVisibleRow = virtualItems[virtualItems.length - 1].index;
  const lastLoadedRow = Math.floor(images.length / Math.max(1, columnCount));
  // trigger 2 rows before reaching the last loaded row
  if (lastVisibleRow >= lastLoadedRow - 2) {
    loadMore();
  }
}, [virtualItems, images.length, totalCount, columnCount, searchResultIds, loadMore]);
```

Update the render block (from Task 5.4) to use the captured `virtualItems` variable instead of calling `rowVirtualizer.getVirtualItems()` inline:

```tsx
{virtualItems.map(virtualRow => (
  /* ... existing row body ... */
))}
```

- [ ] **Step 6.6: Update `rowCount` to reflect totalCount**

Replace the `rowCount` calculation from Task 5 with one based on totalCount (so virtualizer reserves space for unloaded rows):

```ts
const effectiveCount = searchResultIds !== null ? images.length : Math.max(images.length, totalCount);
const rowCount = Math.ceil(effectiveCount / Math.max(1, columnCount));
```

This ensures the scroll bar reflects all 5000 images even when only 500 are loaded.

- [ ] **Step 6.7: Update delete handler to decrement `totalCount`**

In `handleDeleteImage` (~line 207) and `handleBatchDelete` (find via grep), after the `setImages(prev => prev.filter(...))` line, add:

```ts
setTotalCount(prev => Math.max(0, prev - 1));
```

For batch delete, decrement by the count of deleted ids:

```ts
setTotalCount(prev => Math.max(0, prev - deletedIds.length));
```

- [ ] **Step 6.8: Update import handler to refresh count**

After successful imports (search for `importImages` calls within `ImageGrid.tsx`), call `loadImages()` to refresh both list and count. Most paths already do this. Verify by tracing each import path:

- File dialog import (~line 369): already calls `loadImages()` ✓
- Drag-drop import (~line 130 region): already calls `loadImages()` ✓
- XLS import (~line 328): already calls `loadImages()` ✓

No changes needed if all three already call `loadImages()`.

- [ ] **Step 6.9: Update placeholder rendering to know about loading**

In Task 5's render block, the placeholder div renders for any `image === undefined`. This is correct — when virtualizer scrolls into unloaded rows, those slots show as faint gray squares, then `loadMore` fetches and they fill in. No extra loading indicator needed (per design choice A).

- [ ] **Step 6.10: Build**

```bash
pnpm build
```

Expected: success.

- [ ] **Step 6.11: Manual smoke test — pagination scenarios**

Run `pnpm tauri dev` and verify:

1. **Library < 500 images**: behaves identically to Task 5 — single load, no pagination triggered
2. **Library > 500 images** (import a batch of 600+ test images if needed):
   - Initial view: first 500 cards
   - Scroll bar reflects total count (e.g. 6000) — bar is short
   - Slowly scroll past row 95 (with 5 cols, that's image 475) → next page silently appears
   - Fast-jump scrollbar to mid-list → rows of gray placeholders → fill in within 50–200ms
   - Fast-jump to bottom → eventually loads to total
3. **Delete an image** → grid shifts up, totalCount decrements (verify by checking sidebar count or scrollbar shrink)
4. **Import 10 new images** → appear at top, totalCount increases
5. **Switch folder mid-load**: rapidly click folder A then folder B → only B's content shows, no A leak (race guard test)
6. **Search**: enter query → results show (capped 200), no pagination machinery interferes; clear search → returns to paginated folder view at top

If any test fails, debug and iterate.

- [ ] **Step 6.12: Performance sanity (1000+ images)**

Generate 1000 test images and import them. Easiest method:

```bash
# from the snaplex/ directory:
mkdir -p /tmp/snaplex-perftest
for i in $(seq 1 1000); do
  # Generate a unique 32x32 PNG with random color
  printf 'P3\n32 32\n255\n' > /tmp/snaplex-perftest/img-$i.ppm
  for _ in $(seq 1 1024); do
    printf '%d %d %d\n' $((RANDOM % 256)) $((RANDOM % 256)) $((RANDOM % 256))
  done >> /tmp/snaplex-perftest/img-$i.ppm
done
# Convert PPM to PNG via ImageMagick or skip if 'sips' available on macOS:
# (alternative: use existing screenshot collection if you have one)
```

Or simpler: drag 1000 images you already have on disk into the running app.

Verify:
- App stays responsive during import
- Once imported, scroll from top to bottom without jank (60fps target — open DevTools Performance tab to confirm)
- Memory stays under 1GB (Activity Monitor, look for `snaplex` process)
- Switching folders is instant

- [ ] **Step 6.13: Commit**

```bash
git add src/components/layout/ImageGrid.tsx
git commit -m "feat(ImageGrid): paginated loading with countImages + race-guarded loadMore"
```

---

## Task 7: Final Verification & Documentation Touch-up

**Files:**
- Modify: `docs/PHASE_0_1_2_PROGRESS.md`

- [ ] **Step 7.1: Run full test suite**

```bash
pnpm test
```

Expected: 39 tests PASS (no regressions).

- [ ] **Step 7.2: Run cargo check**

```bash
cd src-tauri && cargo check && cd ..
```

Expected: clean.

- [ ] **Step 7.3: Run TypeScript build**

```bash
pnpm build
```

Expected: clean.

- [ ] **Step 7.4: Update progress tracker**

Open `docs/PHASE_0_1_2_PROGRESS.md`. Find the line:

```
| Virtual scroll | TODO | Currently renders all images |
```

Replace with:

```
| Virtual scroll | DONE | @tanstack/react-virtual + 500-page pagination + countImages IPC; constant DOM cost |
```

Also bump the "Last updated" date at the top to `2026-04-28`.

- [ ] **Step 7.5: Final manual checklist (`pnpm tauri dev`)**

Run through every item from spec §Testing strategy → 手工 section. Mark each pass/fail. **All must pass before final commit.**

- Library > 100 张：滚动到底，逐张可见
- 大量并行导入：100 张拖入，立即出现在顶部
- 拖动滚动条到中段 → 矩形框选 → 跨视口拖动 → 滚回 → 已选中卡片仍标记
- 调整 gridSize 滑块 → 列数 reflow，滚动位置不抖
- 多选 Cmd+click 两个相距 1000+ 的卡片 → 批量删除生效
- 搜索 → 结果出现（不触发分页机制）→ 清除 → 回到完整列表
- 文件夹切换 → 滚动条重置到顶
- 删除某张 → totalCount 减一，下方卡片上移补位

- [ ] **Step 7.6: Commit progress doc**

```bash
git add docs/PHASE_0_1_2_PROGRESS.md
git commit -m "docs: mark virtual scroll as DONE in phase progress tracker"
```

- [ ] **Step 7.7: Push branch**

```bash
git push -u origin feat/virtual-scroll
```

(If user has set up a private fork at this point, push to that remote instead.)

---

## Self-Review

Spec coverage check:

| Spec section | Covered by |
|---|---|
| Architecture: backend pagination + frontend windowing | Tasks 3, 4, 5, 6 |
| Page size = 500 | Task 4 default + Task 6 PAGE_SIZE |
| State shape (images/totalCount/isLoadingPage) | Task 6 |
| Lifecycle: folder switch | Task 6.3 race-guarded loadImages |
| Lifecycle: scroll near tail | Task 6.5 |
| Lifecycle: delete decrements count | Task 6.7 |
| Lifecycle: import refreshes | Task 6.8 (verified existing paths suffice) |
| Lifecycle: search short-circuits | Task 6.4, 6.5, 6.6 |
| Component: tauriBridge | Task 4 |
| Component: count_images backend | Task 3 |
| Component: useGridDimensions hook | Task 2 |
| Component: ImageGrid render rewrite | Task 5 |
| Rectangle selection redesign | Task 5.3 |
| Drop overlay & padding | Task 5.4 (padding moved into virtualizer math) |
| Edge: empty folder | Task 5.4 (existing branch wrapped in p-6) |
| Edge: ResizeObserver short-circuit | Task 2.5 implementation |
| Edge: race condition on folder switch | Task 6.3 folderRequestRef |
| Risk: react-virtual + grid bug | Mitigated by useGridDimensions tests + manual smoke |
| Risk: rect-select math errors | Mitigated by Task 1 unit tests |
| Verification gates | Tasks 7.1, 7.2, 7.3, 7.5 |

No uncovered spec sections.

Type consistency check:

- `cardRectAtIndex(i, columnCount, gridSize, GRID_GAP, GRID_PADDING, GRID_PADDING)` — same signature in spec §5, Task 1 implementation, and Task 5.3 caller ✓
- `useGridDimensions(ref, gridSize)` returns `{columnCount, rowHeight}` — consistent across Task 2 declaration and Task 5.2 call ✓
- `countImages(folderId?)` returns `Promise<number>` — consistent across Task 4 bridge and Task 6.3 caller ✓
- `count_images(folder_id: Option<String>) -> Result<i64, String>` consistent across Task 3.1 db function, 3.2 command ✓

Placeholder scan: no "TBD", "TODO", "implement xyz", "similar to". All steps include actual code or commands.

---

## Out of Scope (deferred, by spec)

- Real 256px WebP thumbnail generation
- Persisted scroll position across folder switches
- Date-grouped sectioned virtualization
- All UI bugs in `# feedback_v2.ini`
- CLIP visual search, text embeddings (Phase 2 deferred items)
- Browser plugin, Eagle import (Phase 3)
