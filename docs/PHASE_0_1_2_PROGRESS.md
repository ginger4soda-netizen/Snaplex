# Phase 0+1+2 Implementation Progress Tracker

> **Purpose**: This file tracks the exact state of every feature in Phase 0-2.
> Any new session should read this file to understand what's done and what's pending.
> Update this file after completing each item.

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
| get_images | DONE | Fixed: now includes file_path for thumb fallback |
| import_images | DONE | Fixed: UUID prefix for filename collision |
| delete_images | DONE | |
| move_images | DONE | |
| link_image_to_folder | DONE | |
| get_image_detail | DONE | Fixed: file:// prefix on thumb_url |
| update_image_memo | DONE | |
| toggle_favorite | DONE | |
| open_image_in_finder | DONE | macOS/Windows/Linux |
| export_images | STUB | Returns mock path |
| get_analysis | DONE | |
| save_analysis | DONE | |
| get_dimension_history | DONE | |
| save_dimension_version | DONE | |
| search_images (FTS5) | DONE | |
| save_text_embedding | STUB | No real implementation |
| visual_search | STUB | Returns empty array |
| extract_color_palette | STUB | Returns mock colors |
| get_color_palette | STUB | Returns null |
| check_for_update | STUB | Returns null |
| install_update | STUB | No-op |

### 0.4 File System
| Item | Status | Notes |
|------|--------|-------|
| .snpx library creation (dirs + metadata.json + db) | DONE | |
| Image file copy on import | DONE | |
| Thumbnail generation (256px WebP) | TODO | Currently uses original file as fallback |
| File system watcher (notify crate) | TODO | fs-change events not implemented |

### 0.5 CLIP Integration
| Item | Status | Notes |
|------|--------|-------|
| ONNX Runtime (ort crate) integration | DEFERRED | 153MB model, complex Rust work. Phase 2 search works via FTS5 without CLIP |
| CLIP visual embedding on import | DEFERRED | Same as above |
| CLIP text encoding for visual search | DEFERRED | Same as above |

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
| Sidebar (left column) | DONE | Navigation buttons work |
| ImageGrid (center column) | DONE | Search + grid + import |
| DetailPanel (right column) | DONE | Tabs: Info + Chat |
| Column resize drag handles | DONE | Min/max constraints |

### 1.2 Folder Tree
| Item | Status | Notes |
|------|--------|-------|
| FolderTree display (read-only) | DONE | Loads from getFolderTree() IPC |
| "New Folder" button + input | TODO | Backend exists, UI missing |
| Folder right-click menu (rename/delete) | TODO | Backend exists, UI missing |
| Folder drag-to-reorder | TODO | Backend move_folder exists, UI missing |
| Nested folder expand/collapse | DONE | |
| Image count per folder | DONE | |
| "All Images" special entry | DONE | |
| "Favorites" special entry | DONE | |

### 1.3 Image Grid
| Item | Status | Notes |
|------|--------|-------|
| Grid display with thumbnails | PARTIAL | Fixed asset protocol, need to verify |
| Grid size slider | DONE | |
| Click-to-upload (file dialog) | DONE | Tauri native dialog |
| Drag-and-drop import | DONE | Tauri native drag-drop events |
| Image selection → detail panel | DONE | |
| Right-click context menu | TODO | Not implemented at all |
| Multi-select mode | TODO | Not implemented |
| Batch action menu | TODO | Not implemented |
| Virtual scroll | TODO | Currently renders all images |

### 1.4 Detail Panel
| Item | Status | Notes |
|------|--------|-------|
| Image preview | DONE | |
| Image fullscreen on click | TODO | Need to verify/implement |
| Color palette display | DONE | UI works, but uses mock data |
| Color copy (HEX/RGB/HSL) | DONE | |
| Source link display | DONE | Shows source_url if available |
| 6 Dimension cards (collapsible) | DONE | UI renders correctly |
| "Analyze Now" button → AI call | TODO | Button exists, no onClick handler |
| Per-dimension refresh button | TODO | Button exists, not wired |
| Copy prompt button | TODO | Button exists, not wired |
| Google Translate on card back | TODO | Service exists, not wired to cards |
| Memo card | DONE | Saves to DB via IPC |
| Chat panel | PARTIAL | Uses IndexedDB, not Tauri backend |

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
| System language auto-detect | TODO | App doesn't detect OS language |
| Pass language to all components | TODO | Components not receiving systemLanguage |

### 1.7 Settings
| Item | Status | Notes |
|------|--------|-------|
| Provider selection (4 providers) | DONE | |
| Model selection per provider | DONE | |
| API key input + validation | DONE | |
| Language preferences | DONE | |
| Settings persistence | PARTIAL | Uses IndexedDB, works but not ideal |

### 1.8 Web App Independence
| Item | Status | Notes |
|------|--------|-------|
| Desktop app runs independently | DONE | Separate DesktopMode type |
| Web app runs independently | TODO | Web entry broken by desktop refactoring |
| No cross-contamination | TODO | Shared App.tsx causes issues |

---

## Phase 2: Search + Color + Translation

### 2.1 Search
| Item | Status | Notes |
|------|--------|-------|
| SearchBar UI with debounce | DONE | 300ms debounce, clear button |
| FTS5 backend query | DONE | search.rs implemented |
| FTS5 index population on analysis | TODO | Need to write to search_index after save_analysis |
| Text embedding generation | DEFERRED | Requires API call infrastructure |
| Text embedding search | DEFERRED | No embeddings stored |
| CLIP visual search | DEFERRED | CLIP not integrated |
| Fusion sorting algorithm | DONE | Frontend code exists |
| Search results display | DONE | |

### 2.2 Color Palette
| Item | Status | Notes |
|------|--------|-------|
| Color palette UI | DONE | Bars, grid view, format toggle |
| K-means extraction (Rust) | TODO | Currently returns mock data |
| Auto-extract on import | TODO | |
| Store in color_palettes table | TODO | |
| Color copy to clipboard | DONE | |

### 2.3 Translation
| Item | Status | Notes |
|------|--------|-------|
| Google Translate service | DONE | LRU cache, batch support |
| Dimension card translation | TODO | Service exists, not wired to UI |

### 2.4 Data Import
| Item | Status | Notes |
|------|--------|-------|
| XLS legacy import | DONE | importLegacy.ts implemented |

---

## Current Blockers for User Testing

1. Images may not display (asset protocol fix needs verification)
2. Cannot create folders (no UI)
3. Cannot analyze images (button not connected to AI)
4. No right-click menu
5. App doesn't follow system language
6. Color palette shows mock data
7. Web app broken

## SiliconFlow API Config
- User has configured SiliconFlow API key in Settings
- Available models: Qwen3-VL, GLM-4.6V, Qwen2.5-VL
- Need to verify: API call works from DimensionCards → SiliconFlow provider

## Resumability Instructions
If this session hits a usage limit:
1. Read this file to understand current progress
2. Check git log for recent commits
3. Run `pnpm test` to see which tests pass
4. Continue from the first TODO item in priority order

Priority order for remaining work:
1. Image display verification (asset protocol)
2. AI analysis button wiring (SiliconFlow)
3. Folder CRUD UI
4. Right-click context menu
5. System language detection
6. Color extraction (real, not mock)
7. Google Translate wiring to dimension cards
8. Chat panel migration to Tauri backend
9. Web app independence
10. Virtual scroll
11. Multi-select + batch operations
