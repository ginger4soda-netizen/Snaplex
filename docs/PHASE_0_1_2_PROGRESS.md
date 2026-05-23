# Phase 0+1+2 Implementation Progress Tracker

> **Purpose**: This file tracks the exact state of every feature in Phase 0-2.
> Any new session should read this file to understand what's done and what's pending.
> Update this file after completing each item.
> **Last updated**: 2026-04-28 (feat/virtual-scroll branch)

## Status Legend
- `DONE` — Implemented, tested, verified working
- `PARTIAL` — Code exists but incomplete or has bugs
- `STUB` — Placeholder/mock, not real implementation
- `TODO` — Not started
- `BLOCKED` — Needs external dependency or user input
- `DEFERRED` — Intentionally postponed (documented reason)

---

## Phase 0: Tauri Infrastructure

### 0.1 Project Setup
| Item | Status | Notes |
|------|--------|-------|
| Tauri v2 + React + Vite scaffolding | DONE | |
| Cargo.toml dependencies | DONE | |
| tauri.conf.json config | DONE | Window 1280x800, min 960x600 |
| capabilities/default.json | DONE | core, log, dialog, path permissions |
| Asset protocol enabled | DONE | protocol-asset feature + scope ["**"] |

### 0.2 SQLite Database
| Item | Status | Notes |
|------|--------|-------|
| Database connection + WAL mode | DONE | db/mod.rs |
| Schema: folders table | DONE | |
| Schema: images table | DONE | |
| Schema: image_folders table | DONE | |
| Schema: analysis table | DONE | |
| Schema: search_index (FTS5) | DONE | |
| Schema: color_palettes table | DONE | |
| Schema: embeddings table | DONE | |
| Schema: visual_embeddings table | DONE | |
| Schema: dimension_history table | DONE | |
| Schema: chat_messages table | DONE | |

### 0.3 IPC Commands (§5)
| Command | Status | Notes |
|---------|--------|-------|
| create_library | DONE | Creates .snpx folder structure |
| open_library | DONE | |
| get_current_library | DONE | |
| get_folder_tree | DONE | |
| create_folder | DONE | |
| rename_folder | DONE | |
| delete_folder | DONE | |
| move_folder | DONE | |
| get_images | DONE | Includes file_path for thumb fallback |
| import_images | DONE | UUID prefix, reads image dimensions via `image` crate |
| delete_images | DONE | |
| move_images | DONE | |
| link_image_to_folder | DONE | |
| get_image_detail | DONE | Now loads analysis from DB |
| update_image_memo | DONE | |
| toggle_favorite | DONE | |
| open_image_in_finder | DONE | macOS/Windows/Linux |
| export_images | DONE | Copies files to timestamped export dir in Downloads |
| get_analysis | DONE | |
| save_analysis | DONE | Also populates FTS5 search index |
| get_dimension_history | DONE | |
| save_dimension_version | DONE | |
| search_images (FTS5) | DONE | |
| save_text_embedding | STUB | No real implementation |
| visual_search | STUB | Returns empty array |
| extract_color_palette | DONE | Backend stub, frontend does real Canvas extraction |
| get_color_palette | DONE | Reads from color_palettes table |
| save_color_palette | DONE | Persists extracted colors as JSON |
| check_for_update | STUB | Returns null |
| install_update | STUB | No-op |

### 0.4 File System
| Item | Status | Notes |
|------|--------|-------|
| .snpx library creation (dirs + metadata.json + db) | DONE | |
| Image file copy on import | DONE | |
| Thumbnail generation (256px WebP) | DEFERRED | Uses original file as fallback, works fine |
| File system watcher (notify crate) | DEFERRED | User agreed to defer |

### 0.5 CLIP Integration
| Item | Status | Notes |
|------|--------|-------|
| ONNX Runtime (ort crate) integration | DEFERRED | User agreed to defer |
| CLIP visual embedding on import | DEFERRED | |
| CLIP text encoding for visual search | DEFERRED | |

### 0.6 Auto-Update
| Item | Status | Notes |
|------|--------|-------|
| tauri-plugin-updater setup | DEFERRED | No GitHub Releases configured yet |
| CI/CD pipeline | DEFERRED | No .github/workflows yet |

---

## Phase 1: Three-Column UI

### 1.1 Layout
| Item | Status | Notes |
|------|--------|-------|
| ThreeColumnLayout component | DONE | Resizable columns with localStorage persistence |
| Sidebar (left column) | DONE | Navigation + folder CRUD |
| ImageGrid (center column) | DONE | Search + grid + import + multi-select |
| DetailPanel (right column) | DONE | Tabs: Info + Chat |
| Column resize drag handles | DONE | Min/max constraints |

### 1.2 Folder Tree
| Item | Status | Notes |
|------|--------|-------|
| FolderTree display (read-only) | DONE | |
| "New Folder" button + input | DONE | "+" button in sidebar header |
| Folder right-click menu (rename/delete) | DONE | ContextMenu component |
| Drag image to folder (move/link) | DONE | HTML5 drag with alt=link, grid auto-refreshes |
| Move to folder (context menu) | DONE | Right-click → Move to Folder picker modal |
| Folder drag-to-reorder | TODO | Backend move_folder exists, UI not priority |
| Nested folder expand/collapse | DONE | |
| Image count per folder | DONE | |
| "All Images" special entry | DONE | |
| "Favorites" special entry | DONE | |

### 1.3 Image Grid
| Item | Status | Notes |
|------|--------|-------|
| Grid display with thumbnails | DONE | asset:// protocol + convertFileSrc |
| Grid size slider | DONE | |
| Click-to-upload (file dialog) | DONE | Tauri native dialog |
| Drag-and-drop import | DONE | Tauri native drag-drop events |
| Image selection → detail panel | DONE | |
| Right-click context menu | DONE | Favorite, Open in Finder, Move to Folder, Delete |
| Multi-select mode | DONE | Cmd+click, Shift+click |
| Batch action menu | DONE | Select all, Clear, Delete selected |
| Virtual scroll | DONE | @tanstack/react-virtual + 500-page pagination + countImages IPC; constant DOM cost regardless of library size |

### 1.4 Detail Panel
| Item | Status | Notes |
|------|--------|-------|
| Image preview | DONE | |
| Image fullscreen on click | DONE | Overlay with Escape to close |
| Color palette display | DONE | Real k-means extraction via Canvas |
| Color copy (HEX/RGB/HSL) | DONE | |
| Source link display | DONE | Shows source_url if available |
| 6 Dimension cards (collapsible) | DONE | |
| "Analyze Now" button → AI call | DONE | Calls analyzeImage → saveAnalysis IPC |
| Per-dimension refresh button | DONE | regenerateDimension → saveDimensionVersion |
| Copy prompt button | DONE | Copies original + translated to clipboard |
| Google Translate on card back | DONE | Auto-translates via Google Translate API |
| Memo card | DONE | Saves to DB via IPC |
| Chat panel | DONE | Migrated to Tauri DB (chat_messages table), IndexedDB fallback |

### 1.5 Theme
| Item | Status | Notes |
|------|--------|-------|
| Light mode | DONE | |
| Dark mode | DONE | |
| Theme toggle in settings | DONE | |
| System preference detection | DONE | prefers-color-scheme |

### 1.6 Internationalization
| Item | Status | Notes |
|------|--------|-------|
| 7 languages defined | DONE | EN/CN/ES/JA/FR/DE/KO |
| Language selection in settings | DONE | |
| System language auto-detect | DONE | navigator.language on first launch |
| Pass language to all components | DONE | Settings propagated via idb-keyval |

### 1.7 Settings
| Item | Status | Notes |
|------|--------|-------|
| Provider selection (4 providers) | DONE | |
| Model selection per provider | DONE | |
| API key input + validation | DONE | |
| Language preferences | DONE | |
| Settings persistence | DONE | Uses IndexedDB via idb-keyval |

### 1.8 Web App Independence
| Item | Status | Notes |
|------|--------|-------|
| Desktop app runs independently | DONE | App.tsx with Tauri IPC |
| Web app runs independently | DONE | AppWeb.tsx with useAppState |
| No cross-contamination | DONE | __TAURI_INTERNALS__ detection in index.tsx |

---

## Phase 2: Search + Color + Translation

### 2.1 Search
| Item | Status | Notes |
|------|--------|-------|
| SearchBar UI with debounce | DONE | 300ms debounce, clear button |
| FTS5 backend query | DONE | search.rs — sanitized queries, folder_id filtering |
| FTS5 index population on analysis | DONE | save_analysis now calls update_search_index |
| Text embedding generation | DEFERRED | Requires API call infrastructure |
| Text embedding search | DEFERRED | No embeddings stored |
| CLIP visual search | DEFERRED | CLIP not integrated |
| Fusion sorting algorithm | DONE | Frontend code exists |
| Search results display | DONE | Batch fetch via get_images_by_ids |

### 2.2 Color Palette
| Item | Status | Notes |
|------|--------|-------|
| Color palette UI | DONE | Bars, grid view, format toggle |
| K-means extraction | DONE | Canvas-based (src/utils/colorExtract.ts) |
| Auto-extract on image select | DONE | Triggered in DetailPanel |
| Store in color_palettes table | DONE | Persisted via save_color_palette IPC, loaded on revisit |
| Color copy to clipboard | DONE | |

### 2.3 Translation
| Item | Status | Notes |
|------|--------|-------|
| Google Translate service | DONE | LRU cache, batch support |
| Dimension card translation | DONE | Auto-translates to cardBackLanguage |

### 2.4 Data Import
| Item | Status | Notes |
|------|--------|-------|
| XLS legacy import | DONE | importLegacy.ts implemented |

---

## Verification Summary (2026-03-26)

- `cargo check`: PASS (1 warning, 0 errors)
- `pnpm test`: PASS (26/26 tests)
- TypeScript: 8 pre-existing errors in test mocks (not in feature code)

## Changes in 2026-03-26 session (round 1)
1. **export_images**: Real implementation — copies files to `~/Downloads/snaplex-export-{timestamp}/`
2. **Image dimensions**: Now extracted on import using `image` crate (was 0x0)
3. **Chat persistence**: Migrated from IndexedDB to Tauri SQLite `chat_messages` table (with IndexedDB fallback)
4. **Color palette persistence**: Extracted colors now saved to `color_palettes` table, loaded from DB on revisit
5. **New IPC commands**: `get_chat_messages`, `save_chat_message`, `delete_chat_messages`, `save_color_palette`

## Changes in 2026-03-26 session (round 2)
1. **Drag-to-folder**: Images now refresh in grid after drag-drop move/link via `onImagesChanged` callback chain (Sidebar → ThreeColumnLayout → ImageGrid)
2. **Move to folder context menu**: Right-click image → "Move to Folder..." opens folder picker modal
3. **FTS5 search fix**: Query sanitization (quotes each word, strips special chars) + folder_id filtering via JOIN with image_folders
4. **Search batch fetch**: New `get_images_by_ids` IPC command replaces per-image detail fetch for search results
5. **New IPC command**: `get_images_by_ids` — batch fetch ImageItem[] by ID list

## Changes in 2026-04-28 session (P0 — virtual scroll)
1. **Virtual scroll**: `@tanstack/react-virtual` integrated; constant DOM cost regardless of library size
2. **Pagination**: backend `count_images` IPC + frontend 500-per-page incremental loading with race-guarded `loadMore`
3. **Rect-select redesign**: switched from DOM `querySelectorAll('[data-image-card]')` to mathematical hit-testing via `cardRectAtIndex` so cross-viewport rectangle selection works
4. **New layout utilities**: `src/utils/gridGeometry.ts` (constants `GRID_GAP`/`GRID_PADDING` + `cardRectAtIndex` + `rectsIntersect`); `src/hooks/useGridDimensions.ts` (ResizeObserver-driven column count)
5. **Test infrastructure**: ResizeObserver mock now emits `borderBoxSize`/`contentBoxSize` and auto-fires on `observe()` so virtualizer renders in jsdom; `count_images` mock added to `tauri.ts` mock state

## Remaining Items (low priority, can be deferred)
1. Folder drag-to-reorder (move_folder backend exists)
2. Thumbnail generation (WebP, uses original as fallback)
