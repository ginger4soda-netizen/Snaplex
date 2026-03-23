# Snaplex Desktop App Refactor — Design Spec

> **Date**: 2026-03-23
> **Branch**: dev/phase-0-1-2
> **Scope**: Bug fixes + frontend-backend feature wiring
> **Constraint**: No visual style/color/icon changes — business logic only (exception: F8 background/divider alignment)

---

## Context

Snaplex is a Tauri v2 + React desktop app for image prompt analysis. Phase 0-2 backend and basic UI are largely complete, but many frontend-backend connections are broken or missing, several bugs exist, and key interaction patterns are unimplemented.

This spec covers 3 bug fixes and 9 feature integrations needed to make the app functionally complete for Phase 0-2.

---

## Bug Fixes

### B1. Drag-Drop Import Creates Duplicates

**Problem**: Dragging one image into the grid produces two copies in the UI.

**Root Cause**: Tauri's `onDragDropEvent` fires the `drop` case multiple times for a single OS drop gesture. The current `importingRef.current` boolean guard resets too early or doesn't cover all event firings.

**Fix**:
- Debounce the drop handler (300ms window)
- Deduplicate file paths within a single drop batch using a `Set`
- Only call `import_images` once per debounce window with the deduplicated path list
- Keep `importingRef` guard as secondary protection

**Files**: `src/components/layout/ImageGrid.tsx` (lines 88-130)

---

### B2. AI Analysis "Load Failed"

**Problem**: Clicking "Analyze Now" shows "Load failed" error.

**Investigation Path**:
1. Check `imageUrlToBase64()` in `src/utils/imageToBase64.ts` — does `fetch(asset://...)` work in Tauri webview?
2. Check provider API call chain in `src/services/geminiService.ts`
3. Check settings loading (API key availability) from IndexedDB
4. Add error logging at each stage to pinpoint failure

**Fix**: Depends on investigation. Likely one of:
- `asset://` URL fetch failing → use Tauri's `readFile` IPC command instead
- API key not loaded → fix settings initialization timing
- Provider response parsing error → fix response handler

**Files**: `src/utils/imageToBase64.ts`, `src/services/geminiService.ts`, `src/components/detail/DimensionCards.tsx`

---

### B3. System Language Not Applied

**Problem**: Desktop app doesn't follow system language on launch.

**Root Cause**: `App.tsx` calls `detectSystemLanguage()` and writes to IndexedDB, but there may be a race condition where UI renders before settings are loaded.

**Fix**:
- Ensure `detectSystemLanguage()` runs and completes before first render
- On first launch: detect → write to IndexedDB → apply
- On subsequent launches: read saved language from IndexedDB → apply
- Verify the language mapping covers all `navigator.language` prefixes correctly

**Files**: `src/App.tsx` (lines 27-70, 167-184)

---

## Feature Integrations

### F1. Left Sidebar Collapse/Expand

**Current**: Sidebar is always visible at 180-400px width, not collapsible.

**Design**:
- Add a collapse toggle button (top of sidebar, next to "Snaplex" logo)
- **Expanded state**: Current design unchanged — LIBRARY, FOLDERS, TOOLS sections
- **Collapsed state**: 56px wide icon-only bar (VidBee style)
  - Top: Snaplex "S" logo icon
  - Icons for: All Images, Favorites
  - Divider
  - Folder icon (hover → popup with folder list)
  - Divider
  - Tool icons (Style Printer)
  - Spacer
  - Bottom fixed: Settings icon, About icon
- Layout restructure in expanded state:
  - LIBRARY section (All Images, Favorites)
  - FOLDERS section (with + button)
  - TOOLS section (Style Printer) — moved below folders
  - Bottom fixed: Settings, About — separated by top border
- Collapse state persisted to localStorage
- Folder hover popup: absolute-positioned panel showing folder tree, appears on mouseenter (or click), dismisses on mouseleave with small delay

**Files**: `src/components/layout/ThreeColumnLayout.tsx`, `src/components/layout/Sidebar.tsx` (new or refactored)

---

### F2. Settings/Tools Render in Middle Column

**Current**: Settings and StylePrinter replace the entire three-column layout (full screen takeover in App.tsx).

**Design**:
- Settings/StylePrinter/About render as content within the middle column
- Left sidebar remains visible and functional
- Right detail panel remains visible, showing the last selected image
- Middle column shows a back button + page title at top, then page content below
- App state tracks `centerView: 'grid' | 'settings' | 'stylePrinter' | 'about'`
- Clicking a sidebar entry sets `centerView`, clicking "back" returns to `'grid'`

**Files**: `src/App.tsx`, `src/components/layout/ThreeColumnLayout.tsx`, `src/components/layout/ImageGrid.tsx`

---

### F3. Middle Column Back/Forward Navigation

**Current**: No navigation history. Switching folders just replaces the grid content.

**Design**:
- Navigation history stack: `{ type: 'folder' | 'settings' | 'stylePrinter' | 'about', id?: string }[]`
  - `id: null` = "All Images" view
  - `id: '__favorites__'` = Favorites virtual folder
  - `id: '<uuid>'` = real folder from database
- `currentIndex` pointer into the stack
- Every folder switch or page navigation pushes to stack (truncating forward history if navigating from middle)
- ← → buttons in the middle column toolbar (left side, before search bar)
- Buttons disabled when at start/end of history
- Keyboard shortcuts: Cmd+[ / Cmd+] (macOS standard)
- Max history depth: 50 entries

**Files**: `src/App.tsx` (or new `useNavigationHistory` hook), `src/components/layout/ImageGrid.tsx`

---

### F4. Mouse Rectangle Selection

**Current**: Only Cmd+click (toggle) and Shift+click (range) for multi-select.

**Design**:
- Mousedown on grid background (not on an image) starts rectangle selection
- Mousemove draws a blue semi-transparent rectangle (`rgba(59,130,246,0.08)` fill, `#3b82f6` border)
- Images whose bounding boxes intersect the rectangle are selected
- Mouseup ends selection
- Holding Cmd/Ctrl during rectangle select adds to existing selection (doesn't replace)
- Without Cmd/Ctrl, rectangle select replaces current selection
- Co-exists with existing click-based selection

**Implementation**:
- Track `isDragging`, `dragStart`, `dragEnd` state
- Use `getBoundingClientRect()` on image cards to test intersection
- Render selection rectangle as absolute-positioned div over the grid
- Distinguish from image click: only start drag if mousedown target is grid background

**Files**: `src/components/layout/ImageGrid.tsx`

---

### F5. Drag Images to Sidebar Folders

**Current**: `move_images` and `link_image_to_folder` IPC commands exist in backend but have zero frontend callers.

**Design**:
- Image cards become draggable (`draggable="true"`)
- When dragging selected images, show drag preview with count badge
- Sidebar folder entries become drop zones (`onDragOver`, `onDrop`)
- Visual feedback: folder highlights on dragover
- **From a specific folder (default)**: Move — calls `move_images(imageIds, targetFolderId)`
- **From a specific folder + Option/Alt**: Link — calls `link_image_to_folder(imageId, folderId)` for each
- **From "All Images" or "Favorites"**: Always link regardless of modifier (images have no source folder to move from)
- After drop: refresh grid to reflect changes

**Files**: `src/components/layout/ImageGrid.tsx`, `src/components/images/ImageCard.tsx`, `src/components/layout/Sidebar.tsx`

---

### F6. Remove "COLOR PALETTE" Title

**Current**: `<h3>Color Palette</h3>` heading appears above color bars.

**Design**:
- Remove the `<h3>Color Palette</h3>` heading from `DetailPanel.tsx` (the heading is in DetailPanel, not inside ColorPalette component)
- ColorPalette component renders directly below the image preview with no section heading
- Keep all other color palette functionality (format toggle, copy, hover) unchanged

**Files**: `src/components/detail/DetailPanel.tsx` (line ~141)

---

### F7. Import/Export Functionality

**Current**: Import works via drag-drop and file dialog. Export is a backend stub. No UI for legacy XLS import.

**Design**:

**Import (Legacy XLS)**:
- Add import button/menu in the middle column toolbar (near the existing import area)
- Option: "Import from XLS" opens file dialog filtered to `.xls/.xlsx`
- Calls `importLegacy.ts` logic (note: `import_legacy_item` IPC command needs to be implemented in Rust backend — currently only frontend logic exists)
- Shows progress/result feedback

**Export (Analysis Data)**:
- When images are selected (batch mode), show "Export Analysis" button in batch action bar
- Opens save dialog for destination
- Save dialog with format filter: `.json` or `.csv`
- JSON format: `{ images: [{ filename, analysis: { subject, environment, ... }, colors, memo }] }`
- CSV format: one row per image, columns: filename, subject, environment, composition, lighting, mood, style, memo
- Export is metadata-only (no image files), handled in frontend via Tauri save dialog + file write

**Files**: `src/components/layout/ImageGrid.tsx`, `src/utils/importLegacy.ts`, new `src/utils/exportAnalysis.ts`

---

### F8. Background Color + Divider Line

**Current**: Desktop uses `bg-stone-50` / `dark:bg-stone-900`. Web uses `bg-cream`. Dividers exist between all columns but may not be visually consistent.

**Design**:
- Update ThreeColumnLayout background to match web app's cream tone
- Verify divider line between middle and right columns is visible and consistent with left-middle divider
- Both dividers: same style, same color

**Files**: `src/components/layout/ThreeColumnLayout.tsx`

---

### F9. About Page

**Current**: Does not exist.

**Design**:
- Simple page rendered in middle column (via F2 mechanism)
- Content: App name, version, brief description
- Links: GitHub, support/feedback
- Minimal — matches existing app style

**Files**: New `src/components/About.tsx`

---

## Architecture Notes

### State Management

The refactor introduces a central navigation state that manages:
```typescript
interface AppNavState {
  centerView: 'grid' | 'settings' | 'stylePrinter' | 'about'
  currentFolderId: string | null
  selectedImageId: string | null  // persists across centerView changes
  sidebarCollapsed: boolean
  navigationHistory: NavEntry[]
  historyIndex: number
}
```

This replaces the current `mode` state in App.tsx which tracks `'library' | 'settings' | 'printer'` (note: `'printer'` will be renamed to `'stylePrinter'` for clarity).

### Component Hierarchy Change

```
App.tsx
├── ThreeColumnLayout (always rendered)
│   ├── Sidebar (always visible, collapsible)
│   │   ├── Expanded: current design + Tools below Folders + bottom Settings/About
│   │   └── Collapsed: icon bar + folder hover popup
│   ├── CenterColumn (content switches based on centerView)
│   │   ├── NavigationBar (← → buttons + search/toolbar)
│   │   ├── ImageGrid (when centerView === 'grid')
│   │   ├── Settings (when centerView === 'settings')
│   │   ├── StylePrinter (when centerView === 'stylePrinter')
│   │   └── About (when centerView === 'about')
│   └── DetailPanel (always visible, shows last selected image)
```

### IPC Commands Status After Refactor

| Command | Frontend Caller | Status |
|---------|----------------|--------|
| move_images | F5 drag-to-folder | Connected |
| link_image_to_folder | F5 drag+Alt | Connected |
| export_images | F7 export | Needs real implementation |
| save_text_embedding | — | Remains DEFERRED |
| visual_search | — | Remains DEFERRED |
| check_for_update | — | No backend command exists (frontend stub only), DEFERRED |
| install_update | — | No backend command exists (frontend stub only), DEFERRED |

---

## Out of Scope

- Visual style, color, or icon changes (explicit constraint, except F8 background/divider)
- Virtual scroll (performance optimization, deferred)
- CLIP integration (deferred)
- Chat panel migration to Tauri backend (works via IndexedDB)
- Thumbnail generation (uses originals as fallback)
- Auto-update system (no GitHub Releases configured)
