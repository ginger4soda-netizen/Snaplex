# Snaplex Desktop Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 bugs and wire up 9 disconnected features to make Snaplex desktop functionally complete for Phase 0-2.

**Architecture:** The refactor replaces the current full-screen mode switching (`App.tsx` renders Settings/Printer as separate pages) with a unified three-column layout where the center column routes between grid/settings/printer/about views. A new `useNavigationHistory` hook manages Eagle/Obsidian-style back/forward navigation. The sidebar gains collapse/expand with VidBee-style icon-only mode.

**Tech Stack:** Tauri v2, React 18, TypeScript, TailwindCSS, idb-keyval, SQLite (via Tauri IPC)

**Spec:** `docs/superpowers/specs/2026-03-23-snaplex-refactor-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/App.tsx` | Remove full-screen settings/printer rendering, delegate all routing to ThreeColumnLayout |
| Modify | `src/components/layout/ThreeColumnLayout.tsx` | Accept `centerView` + sidebar collapse state, route center column content, fix bg/divider |
| Modify | `src/components/layout/Sidebar.tsx` | Collapse/expand, restructure sections, About entry |
| Modify | `src/components/folders/FolderTree.tsx` | Add drop zone handlers to folder entries for drag-to-folder |
| Modify | `src/components/layout/ImageGrid.tsx` | Fix drag-drop, add nav bar, rectangle selection, drag-to-folder source, batch export |
| Modify | `src/components/images/ImageCard.tsx` | Add HTML5 draggable for drag-to-folder |
| Modify | `src/components/detail/DetailPanel.tsx` | Remove "COLOR PALETTE" heading |
| Modify | `src/components/detail/DimensionCards.tsx` | Debug/fix AI analysis "Load failed" |
| Modify | `src/utils/imageToBase64.ts` | Fix asset:// URL handling if needed |
| Create | `src/hooks/useNavigationHistory.ts` | Navigation history stack (back/forward) |
| Create | `src/components/About.tsx` | About page component |
| Create | `src/utils/exportAnalysis.ts` | Export analysis data as JSON/CSV |

---

## Task 1: Fix Drag-Drop Import Duplicates (B1)

**Files:**
- Modify: `src/components/layout/ImageGrid.tsx:88-130`

- [ ] **Step 1: Add debounce + path dedup to drop handler**

In `ImageGrid.tsx`, replace the drag-drop `useEffect` (lines 88-130) with debounced logic. The issue is Tauri's `onDragDropEvent` firing `drop` multiple times for one OS gesture.

```typescript
// At top of component, add a ref for collecting drop paths
const dropPathsRef = useRef<Set<string>>(new Set());
const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Replace the `drop` case (lines 98-117) with:

```typescript
} else if (event.payload.type === 'drop') {
  setIsDragOver(false);
  // Collect paths from potentially multiple drop events
  const paths = event.payload.paths;
  const imagePaths = paths.filter((p: string) =>
    /\.(png|jpe?g|gif|webp|bmp|svg|tiff?)$/i.test(p)
  );
  imagePaths.forEach(p => dropPathsRef.current.add(p));

  // Debounce: wait 150ms for any more drop events, then import once
  if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
  dropTimerRef.current = setTimeout(async () => {
    const uniquePaths = Array.from(dropPathsRef.current);
    dropPathsRef.current = new Set();
    if (uniquePaths.length === 0 || importingRef.current) return;

    importingRef.current = true;
    setLoading(true);
    try {
      await importImages(uniquePaths, folderId);
      await loadImages();
    } catch (err) {
      showToast(`Import failed: ${err}`, 'error');
    } finally {
      setLoading(false);
      importingRef.current = false;
    }
  }, 150);
}
```

Also add cleanup for the debounce timer in the `useEffect` return (around existing line 129):

```typescript
return () => {
  unlisten?.();
  if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
};
```

- [ ] **Step 2: Test manually — drag one image, verify only one copy appears**

Run: `pnpm tauri dev`
Test: Drag a single image file onto the grid. Verify exactly one copy appears, not two.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ImageGrid.tsx
git commit -m "fix(B1): debounce drag-drop to prevent duplicate imports"
```

---

## Task 2: Fix System Language Detection (B3)

**Files:**
- Modify: `src/App.tsx:27-70`

- [ ] **Step 1: Audit current language detection flow**

Read `src/App.tsx` lines 27-70. The current code calls `detectSystemLanguage()` and applies it. Check whether the `setSettings()` call happens before the component renders children.

The current code looks correct — `detectSystemLanguage()` is called synchronously in the init effect, and the result is applied to settings before `setInitState('ready')`. The UI shows a loading spinner until `initState === 'ready'`.

Verify by adding a console.log:

```typescript
// In the init() function, after line 32:
const detected = detectSystemLanguage();
console.log('[Snaplex] Detected system language:', detected, 'from navigator.language:', navigator.language);
```

- [ ] **Step 2: Fix potential issue — cardBackLanguage override**

The current code at line 38: `cardBackLanguage: stored.cardBackLanguage || detected` — this preserves the user's saved `cardBackLanguage` if it exists. But `systemLanguage` should always match the system. Check that `systemLanguage` is actually being used by child components.

Look at how `settings.systemLanguage` propagates — if components read from IndexedDB directly (via `get('visionLearnSettings')`), there may be a race where they read stale data. The fix is to ensure the `set()` call at line 41 completes before proceeding:

```typescript
// Change line 41 from:
set('visionLearnSettings', updated);
// To:
await set('visionLearnSettings', updated);

// Also change line 46 from:
set('visionLearnSettings', autoSettings);
// To:
await set('visionLearnSettings', autoSettings);
```

- [ ] **Step 3: Test — change system language and relaunch**

Run: `pnpm tauri dev`
Check console output for detected language. Verify UI text matches system language.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix(B3): await settings persistence and log system language detection"
```

---

## Task 3: Remove "COLOR PALETTE" Title (F6)

**Files:**
- Modify: `src/components/detail/DetailPanel.tsx:140-143`

- [ ] **Step 1: Remove the heading**

In `DetailPanel.tsx`, replace lines 140-143:

```tsx
// BEFORE:
<section>
  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Color Palette</h3>
  <ColorPalette colors={detail.colorPalette} />
</section>
```

```tsx
// AFTER:
<ColorPalette colors={detail.colorPalette} />
```

Remove the wrapping `<section>` and the `<h3>` heading. The ColorPalette component renders directly in the flow.

- [ ] **Step 2: Verify visually**

Run: `pnpm tauri dev`, select an image, confirm color bars appear directly below the image preview with no "COLOR PALETTE" title.

- [ ] **Step 3: Commit**

```bash
git add src/components/detail/DetailPanel.tsx
git commit -m "feat(F6): remove COLOR PALETTE heading, show bars directly under image"
```

---

## Task 4: Fix Background Color + Divider (F8)

**Files:**
- Modify: `src/components/layout/ThreeColumnLayout.tsx:79,117-119`

- [ ] **Step 1: Check the web app's cream color definition**

Find the `bg-cream` class definition. Search `tailwind.config` or `index.css` for the cream color value.

```bash
grep -r "cream" src/ --include="*.css" --include="*.ts" --include="*.js"
```

- [ ] **Step 2: Update background color**

In `ThreeColumnLayout.tsx` line 79, update the background. If `bg-cream` is defined in the Tailwind config (likely as a custom color), use it:

```tsx
// BEFORE (line 79):
className="flex h-screen w-full overflow-hidden bg-stone-50 dark:bg-stone-900 ..."

// AFTER:
className="flex h-screen w-full overflow-hidden bg-cream dark:bg-stone-900 ..."
```

Also update `ImageGrid.tsx` line 235 and `Sidebar.tsx` line 40 — both have explicit `bg-stone-50 dark:bg-stone-900` that would override the parent. Change both to inherit (remove the bg class) or update to `bg-cream dark:bg-stone-900`.

Also update the detail panel background at line 119:
```tsx
// BEFORE:
className="h-full flex-shrink-0 bg-stone-50 dark:bg-stone-900"
// AFTER:
className="h-full flex-shrink-0 border-l border-stone-200 dark:border-stone-800"
```

The `border-l` ensures there is a visible divider between center and right columns. Background inherits from parent.

- [ ] **Step 3: Verify divider is visible between all three columns**

Run: `pnpm tauri dev`. Confirm:
- Left-center divider: visible (resize handle)
- Center-right divider: visible (new border-l)
- Background matches web app cream tone

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/ThreeColumnLayout.tsx
git commit -m "feat(F8): align background to cream tone, add center-right divider"
```

---

## Task 5: Create Navigation History Hook (F3)

**Files:**
- Create: `src/hooks/useNavigationHistory.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useReducer, useCallback, useEffect } from 'react';

export interface NavEntry {
  type: 'folder' | 'settings' | 'stylePrinter' | 'about';
  id?: string; // folderId or undefined for "All Images", '__favorites__' for Favorites
}

const MAX_HISTORY = 50;

interface NavState {
  history: NavEntry[];
  index: number;
}

type NavAction =
  | { type: 'push'; entry: NavEntry }
  | { type: 'back' }
  | { type: 'forward' };

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'push': {
      const cur = state.history[state.index];
      // Don't push if identical to current
      if (cur && cur.type === action.entry.type && cur.id === action.entry.id) return state;
      // Truncate forward history, append new entry
      const newHistory = [...state.history.slice(0, state.index + 1), action.entry];
      // Trim to max from the front
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return { history: newHistory, index: newHistory.length - 1 };
      }
      return { history: newHistory, index: newHistory.length - 1 };
    }
    case 'back':
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;
    case 'forward':
      return state.index < state.history.length - 1 ? { ...state, index: state.index + 1 } : state;
    default:
      return state;
  }
}

export function useNavigationHistory(initialEntry?: NavEntry) {
  const [state, dispatch] = useReducer(navReducer, {
    history: [initialEntry || { type: 'folder', id: undefined }],
    index: 0,
  });

  const current = state.history[state.index];
  const canGoBack = state.index > 0;
  const canGoForward = state.index < state.history.length - 1;

  const push = useCallback((entry: NavEntry) => dispatch({ type: 'push', entry }), []);
  const goBack = useCallback(() => dispatch({ type: 'back' }), []);
  const goForward = useCallback(() => dispatch({ type: 'forward' }), []);

  // Keyboard shortcuts: Cmd+[ and Cmd+]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '[') {
        e.preventDefault();
        dispatch({ type: 'back' });
      }
      if (e.metaKey && e.key === ']') {
        e.preventDefault();
        dispatch({ type: 'forward' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { current, push, goBack, goForward, canGoBack, canGoForward };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNavigationHistory.ts
git commit -m "feat(F3): create useNavigationHistory hook with keyboard shortcuts"
```

---

## Task 6: Restructure App.tsx — Center Column Routing (F2)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace mode-based routing with centerView routing**

Rewrite `App.tsx` to always render `ThreeColumnLayout` and pass `centerView` + navigation callbacks down. Remove the full-screen settings/printer rendering (lines 122-149).

Key changes:
- Remove `DesktopMode` type and `mode` state
- Add `centerView` state: `'grid' | 'settings' | 'stylePrinter' | 'about'`
- Import and use `useNavigationHistory`
- Pass `centerView`, `settings`, `onSaveSettings`, and navigation handlers to `ThreeColumnLayout`
- `ThreeColumnLayout` is always rendered (no more conditional full-screen pages)

```typescript
import { useNavigationHistory, NavEntry } from './hooks/useNavigationHistory';

// Inside App component:
const nav = useNavigationHistory({ type: 'folder', id: undefined });

// Derive centerView from navigation state
const centerView = nav.current.type === 'folder' ? 'grid' : nav.current.type;
const navFolderId = nav.current.type === 'folder' ? nav.current.id : undefined;

// When sidebar triggers navigation:
const handleNavigate = (target: string) => {
  if (target === 'settings') nav.push({ type: 'settings' });
  else if (target === 'printer') nav.push({ type: 'stylePrinter' });
  else if (target === 'about') nav.push({ type: 'about' });
};

const handleFolderSelect = (folderId: string | undefined) => {
  nav.push({ type: 'folder', id: folderId });
};
```

Remove the entire `if (mode === 'settings' || mode === 'printer')` block (lines 122-149). The `return` should only render `ThreeColumnLayout`:

```tsx
return (
  <>
    <ThreeColumnLayout
      centerView={centerView}
      currentFolderId={navFolderId}
      onFolderSelect={handleFolderSelect}
      selectedImageId={selectedImageId}
      onImageSelect={setSelectedImageId}
      onNavigate={handleNavigate}
      settings={settings}
      onSaveSettings={handleSaveSettings}
      nav={{ goBack: nav.goBack, goForward: nav.goForward, canGoBack: nav.canGoBack, canGoForward: nav.canGoForward }}
    />
    <ToastContainer />
  </>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(F2): route center column content via navigation history, remove full-screen mode"
```

---

## Task 7: Update ThreeColumnLayout — Center Column Content Routing (F2 cont.)

**Files:**
- Modify: `src/components/layout/ThreeColumnLayout.tsx`

- [ ] **Step 1: Accept new props and route center column**

Update the interface and render logic:

```typescript
interface ThreeColumnLayoutProps {
  centerView: 'grid' | 'settings' | 'stylePrinter' | 'about';
  currentFolderId?: string;
  onFolderSelect: (folderId: string | undefined) => void;
  selectedImageId?: string;
  onImageSelect: (imageId: string | undefined) => void;
  onNavigate?: (mode: string) => void;
  settings: UserSettings;
  onSaveSettings: (settings: UserSettings) => void;
  nav: { goBack: () => void; goForward: () => void; canGoBack: boolean; canGoForward: boolean };
}
```

Replace the middle column content (line 99-107) with a routing switch:

```tsx
{/* Middle Column */}
<div className="flex-1 h-full flex flex-col min-w-[300px]">
  {centerView === 'grid' ? (
    <ImageGrid
      folderId={currentFolderId}
      selectedImageId={selectedImageId}
      onImageSelect={onImageSelect}
      onToggleDetail={() => setIsDetailVisible(!isDetailVisible)}
      isDetailVisible={isDetailVisible}
      nav={nav}
    />
  ) : centerView === 'settings' ? (
    <div className="h-full overflow-y-auto">
      <Settings settings={settings} onSave={onSaveSettings} />
    </div>
  ) : centerView === 'stylePrinter' ? (
    <div className="h-full overflow-y-auto">
      <StylePrinter mode="standalone" systemLanguage={settings.systemLanguage} />
    </div>
  ) : centerView === 'about' ? (
    <div className="h-full overflow-y-auto">
      <About />
    </div>
  ) : null}
</div>
```

Add imports at top:
```typescript
import Settings from '../Settings';
import StylePrinter from '../StylePrinter';
import About from '../About';
import { UserSettings } from '@/types';
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/ThreeColumnLayout.tsx
git commit -m "feat(F2): route center column between grid/settings/printer/about"
```

---

## Task 8: Create About Page (F9)

**Files:**
- Create: `src/components/About.tsx`

- [ ] **Step 1: Create minimal About component**

```tsx
import React from 'react';

const About: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/20">
          S
        </div>
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Snaplex</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">v0.1.0</p>
        </div>
      </div>

      <div className="space-y-6 text-sm text-stone-600 dark:text-stone-400">
        <p>
          AI-powered image prompt analysis tool. Break any image into structured, reusable prompt dimensions — Subject, Environment, Composition, Lighting, Mood, and Style.
        </p>

        <div className="border-t border-stone-200 dark:border-stone-800 pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Built with</span>
            <span className="font-medium dark:text-stone-300">Tauri v2 + React</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">License</span>
            <span className="font-medium dark:text-stone-300">MIT</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/About.tsx
git commit -m "feat(F9): add About page component"
```

---

## Task 9: Sidebar Collapse/Expand + Layout Restructure (F1)

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/ThreeColumnLayout.tsx`

This is the largest task. Break it into sub-steps.

- [ ] **Step 1: Add collapse state to ThreeColumnLayout**

In `ThreeColumnLayout.tsx`, add sidebar collapse state:

```typescript
const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
  return localStorage.getItem('snaplex-sidebar-collapsed') === 'true';
});

useEffect(() => {
  localStorage.setItem('snaplex-sidebar-collapsed', String(sidebarCollapsed));
}, [sidebarCollapsed]);
```

Update the sidebar column width:

```tsx
<div
  style={{ width: sidebarCollapsed ? 56 : sidebarWidth }}
  className="h-full flex-shrink-0 border-r border-stone-200 dark:border-stone-800 transition-[width] duration-200"
>
  <Sidebar
    collapsed={sidebarCollapsed}
    onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
    currentFolderId={currentFolderId}
    onFolderSelect={onFolderSelect}
    onNavigate={onNavigate}
  />
</div>
```

Hide the sidebar resize handle when collapsed:

```tsx
{!sidebarCollapsed && (
  <div onMouseDown={() => handleMouseDown('sidebar')} className={`w-1 ...`} />
)}
```

- [ ] **Step 2: Restructure Sidebar for expanded/collapsed states**

Rewrite `Sidebar.tsx` to accept `collapsed` and `onToggleCollapse` props. The expanded state keeps the current design but reorganizes sections: LIBRARY → FOLDERS → TOOLS (moved below folders) → bottom: Settings + About (separated by border-top).

The collapsed state renders a 56px-wide icon bar. Each icon has a `title` tooltip. The folder icon shows a hover popup.

Update the `SidebarProps` interface:

```typescript
interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentFolderId?: string;
  onFolderSelect: (folderId: string | undefined) => void;
  onNavigate?: (mode: string) => void;
}
```

The expanded layout should be:
1. Logo + collapse button (« icon)
2. LIBRARY section (All Images, Favorites)
3. FOLDERS section (with + button, FolderTree)
4. TOOLS section (Style Printer) — moved from bottom to after folders
5. Spacer (flex-1)
6. Bottom: Settings, About — with border-top separator

The collapsed layout should be:
1. "S" logo icon
2. All Images icon (🏠 → use current SVG icon)
3. Favorites icon (⭐ → use current SVG icon)
4. Divider line
5. Folder icon with hover popup
6. Divider line
7. Style Printer icon
8. Spacer
9. Settings icon (gear)
10. About icon (info circle)

For the folder hover popup, add state:

```typescript
const [showFolderPopup, setShowFolderPopup] = useState(false);
const folderPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleFolderMouseEnter = () => {
  if (folderPopupTimerRef.current) clearTimeout(folderPopupTimerRef.current);
  setShowFolderPopup(true);
};

const handleFolderMouseLeave = () => {
  folderPopupTimerRef.current = setTimeout(() => setShowFolderPopup(false), 200);
};
```

The popup renders as an absolute-positioned panel to the right of the sidebar:

```tsx
{showFolderPopup && collapsed && (
  <div
    className="absolute left-14 top-0 z-50 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl p-2 min-w-[200px]"
    onMouseEnter={handleFolderMouseEnter}
    onMouseLeave={handleFolderMouseLeave}
  >
    <h3 className="px-2 mb-1 text-xs font-semibold text-stone-400 uppercase">Folders</h3>
    <FolderTree currentFolderId={currentFolderId} onFolderSelect={onFolderSelect} refreshTrigger={refreshTrigger} />
  </div>
)}
```

- [ ] **Step 3: Test collapse/expand**

Run: `pnpm tauri dev`. Test:
- Click collapse button → sidebar shrinks to icons
- Hover folder icon → popup shows folder list
- Click a folder in popup → grid navigates
- Click expand button → sidebar returns to full width
- Refresh → collapse state persists

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/ThreeColumnLayout.tsx
git commit -m "feat(F1): add sidebar collapse/expand with VidBee-style icon bar"
```

---

## Task 10: Add Navigation Bar to ImageGrid (F3 cont.)

**Files:**
- Modify: `src/components/layout/ImageGrid.tsx`

- [ ] **Step 1: Accept nav props and render back/forward buttons**

Update `ImageGridProps`:

```typescript
interface ImageGridProps {
  folderId?: string;
  selectedImageId?: string;
  onImageSelect: (imageId: string | undefined) => void;
  onToggleDetail: () => void;
  isDetailVisible: boolean;
  nav?: { goBack: () => void; goForward: () => void; canGoBack: boolean; canGoForward: boolean };
}
```

In the toolbar (line 238, inside the `flex items-center gap-4 px-6 py-3` div), add nav buttons before the SearchBar:

```tsx
{/* Back/Forward Navigation */}
{nav && (
  <div className="flex items-center gap-1 mr-2">
    <button
      onClick={nav.goBack}
      disabled={!nav.canGoBack}
      className={`p-1.5 rounded-md transition-colors ${nav.canGoBack ? 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800' : 'text-stone-300 dark:text-stone-700 cursor-not-allowed'}`}
      title="Back (Cmd+[)"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
    </button>
    <button
      onClick={nav.goForward}
      disabled={!nav.canGoForward}
      className={`p-1.5 rounded-md transition-colors ${nav.canGoForward ? 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800' : 'text-stone-300 dark:text-stone-700 cursor-not-allowed'}`}
      title="Forward (Cmd+])"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
    </button>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/ImageGrid.tsx
git commit -m "feat(F3): add back/forward navigation buttons to image grid toolbar"
```

---

## Task 11: Mouse Rectangle Selection (F4)

**Files:**
- Modify: `src/components/layout/ImageGrid.tsx`

- [ ] **Step 1: Add rectangle selection state and handlers**

Add state variables inside the component:

```typescript
const [rectSelect, setRectSelect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
const gridRef = useRef<HTMLDivElement>(null);
```

Add handlers:

```typescript
const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
  // Only start rect select if clicking on grid background (not on an image card)
  const target = e.target as HTMLElement;
  if (target.closest('[data-image-card]')) return;
  // Only left button
  if (e.button !== 0) return;

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const startX = e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft;
  const startY = e.clientY - rect.top + (e.currentTarget as HTMLElement).scrollTop;
  setRectSelect({ startX, startY, endX: startX, endY: startY });

  if (!(e.metaKey || e.ctrlKey)) {
    setMultiSelected(new Set());
  }
}, []);

const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
  if (!rectSelect) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const endX = e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft;
  const endY = e.clientY - rect.top + (e.currentTarget as HTMLElement).scrollTop;
  setRectSelect(prev => prev ? { ...prev, endX, endY } : null);

  // Find intersecting images
  const selRect = {
    left: Math.min(rectSelect.startX, endX),
    top: Math.min(rectSelect.startY, endY),
    right: Math.max(rectSelect.startX, endX),
    bottom: Math.max(rectSelect.startY, endY),
  };

  const container = e.currentTarget as HTMLElement;
  const cards = container.querySelectorAll('[data-image-card]');
  const selected = new Set<string>();
  cards.forEach(card => {
    const cardRect = card.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const cardRelative = {
      left: cardRect.left - containerRect.left + container.scrollLeft,
      top: cardRect.top - containerRect.top + container.scrollTop,
      right: cardRect.right - containerRect.left + container.scrollLeft,
      bottom: cardRect.bottom - containerRect.top + container.scrollTop,
    };
    // Check intersection
    if (selRect.left < cardRelative.right && selRect.right > cardRelative.left &&
        selRect.top < cardRelative.bottom && selRect.bottom > cardRelative.top) {
      const id = card.getAttribute('data-image-id');
      if (id) selected.add(id);
    }
  });
  setMultiSelected(selected);
}, [rectSelect]);

const handleGridMouseUp = useCallback(() => {
  setRectSelect(null);
}, []);
```

- [ ] **Step 2: Add data attributes to ImageCard**

In `ImageCard.tsx`, add `data-image-card` and `data-image-id` to the outer div:

```tsx
<div
  data-image-card
  data-image-id={image.id}
  onClick={(e) => onClick(e)}
  // ... rest of props
>
```

- [ ] **Step 3: Add mouse handlers and selection rectangle to the grid container**

On the scrollable grid container div (currently line 313-315), add mouse handlers:

```tsx
<div
  ref={scrollContainerRef}
  onMouseDown={handleGridMouseDown}
  onMouseMove={handleGridMouseMove}
  onMouseUp={handleGridMouseUp}
  className={`flex-1 overflow-y-auto p-6 scroll-smooth relative select-none ...`}
>
```

Add the selection rectangle overlay inside the grid container, after the grid:

```tsx
{rectSelect && (
  <div
    className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-10 rounded-sm"
    style={{
      left: Math.min(rectSelect.startX, rectSelect.endX),
      top: Math.min(rectSelect.startY, rectSelect.endY),
      width: Math.abs(rectSelect.endX - rectSelect.startX),
      height: Math.abs(rectSelect.endY - rectSelect.startY),
    }}
  />
)}
```

- [ ] **Step 4: Test rectangle selection**

Run: `pnpm tauri dev`. Test:
- Click and drag on empty grid background → blue rectangle appears
- Images within rectangle become selected (blue ring + checkmark)
- Release → rectangle disappears, selection persists
- Cmd+drag → adds to existing selection

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/ImageGrid.tsx src/components/images/ImageCard.tsx
git commit -m "feat(F4): add mouse rectangle selection for multi-select in image grid"
```

---

## Task 12: Drag Images to Sidebar Folders (F5)

**Files:**
- Modify: `src/components/images/ImageCard.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/ImageGrid.tsx`

- [ ] **Step 1: Make ImageCard draggable and pass multi-selected IDs from ImageGrid**

Note: `data-image-card` and `data-image-id` attributes were already added in Task 11 (F4 rectangle selection).

Update `ImageCard` props and outer div to accept and use `onDragStart` from parent:

In `ImageGrid.tsx`, pass a drag handler down or handle at grid level. When dragging a selected image, include all selected image IDs:

Add a wrapper in ImageGrid that sets the drag data to include multi-selected IDs:

```typescript
const handleDragStart = useCallback((imageId: string, e: React.DragEvent) => {
  const ids = multiSelected.size > 0 && multiSelected.has(imageId)
    ? Array.from(multiSelected)
    : [imageId];
  e.dataTransfer.setData('application/snaplex-images', JSON.stringify(ids));
  e.dataTransfer.setData('text/plain', `${ids.length} image(s)`);
  e.dataTransfer.effectAllowed = 'copyMove';
  // Store source folder for move vs link logic
  e.dataTransfer.setData('application/snaplex-source-folder', folderId || '');
}, [multiSelected, folderId]);
```

Pass `onDragStart` down to `ImageCard`:

```tsx
<ImageCard
  key={image.id}
  image={image}
  isSelected={...}
  onClick={(e) => handleImageClick(image.id, e)}
  onDragStart={(e) => handleDragStart(image.id, e)}
  // ... rest
/>
```

Update `ImageCard` to accept and use `onDragStart`:

```typescript
interface ImageCardProps {
  // ... existing
  onDragStart?: (e: React.DragEvent) => void;
}

// In the outer div:
onDragStart={(e) => onDragStart?.(e)}
```

- [ ] **Step 3: Make folder entries drop zones in FolderTree.tsx**

The folder entries are rendered inside `src/components/folders/FolderTree.tsx` (in the `renderFolder` function), NOT in `Sidebar.tsx`. Modify `FolderTree.tsx` to accept drop handlers.

Add new props to `FolderTree`:

```typescript
// In FolderTree.tsx
interface FolderTreeProps {
  currentFolderId?: string;
  onFolderSelect: (folderId: string | undefined) => void;
  refreshTrigger: number;
  // NEW: drag-to-folder support
  onFolderDrop?: (targetFolderId: string, e: React.DragEvent) => void;
  dragOverFolderId?: string | null;
  onDragOverFolder?: (folderId: string | null) => void;
}
```

In the `renderFolder` function, add drag event handlers to each folder button:

```tsx
<button
  // ... existing props
  onDragOver={(e) => { e.preventDefault(); onDragOverFolder?.(folder.id); }}
  onDragLeave={() => onDragOverFolder?.(null)}
  onDrop={(e) => onFolderDrop?.(folder.id, e)}
  className={`... ${dragOverFolderId === folder.id ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
>
```

Then in `Sidebar.tsx`, manage the drop state and pass handlers to `FolderTree`:

```typescript
const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
const { moveImages, linkImageToFolder } = useTauriIPC();

const handleFolderDrop = async (targetFolderId: string, e: React.DragEvent) => {
  e.preventDefault();
  setDragOverFolderId(null);

  const data = e.dataTransfer.getData('application/snaplex-images');
  if (!data) return;
  const imageIds: string[] = JSON.parse(data);
  const sourceFolder = e.dataTransfer.getData('application/snaplex-source-folder');
  const isAltHeld = e.altKey;

  // From All Images or Favorites: always link
  // From a specific folder: default = move, Alt = link
  const shouldLink = !sourceFolder || sourceFolder === '__favorites__' || isAltHeld;

  try {
    if (shouldLink) {
      for (const id of imageIds) {
        await linkImageToFolder(id, targetFolderId);
      }
      showToast(`Linked ${imageIds.length} image(s) to folder`, 'success');
    } else {
      await moveImages(imageIds, targetFolderId);
      showToast(`Moved ${imageIds.length} image(s) to folder`, 'success');
    }
  } catch (err) {
    showToast(`Failed: ${err}`, 'error');
  }
};
```

Pass to FolderTree:
```tsx
<FolderTree
  currentFolderId={currentFolderId}
  onFolderSelect={onFolderSelect}
  refreshTrigger={refreshTrigger}
  onFolderDrop={handleFolderDrop}
  dragOverFolderId={dragOverFolderId}
  onDragOverFolder={setDragOverFolderId}
/>
```

- [ ] **Step 4: Test drag-to-folder**

Run: `pnpm tauri dev`. Test:
- Select images in grid → drag to a folder → images move
- Hold Alt while dropping → images link instead
- From "All Images" → drag to folder → always links
- Folder highlights during dragover

- [ ] **Step 5: Commit**

```bash
git add src/components/images/ImageCard.tsx src/components/layout/Sidebar.tsx src/components/layout/ImageGrid.tsx
git commit -m "feat(F5): drag images from grid to sidebar folders (move/link)"
```

---

## Task 13: Export Analysis Data (F7 — Export)

**Files:**
- Create: `src/utils/exportAnalysis.ts`
- Modify: `src/components/layout/ImageGrid.tsx`

- [ ] **Step 1: Create exportAnalysis utility**

```typescript
import { AnalysisResult } from '@/types';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

interface ExportItem {
  filename: string;
  analysis: AnalysisResult | null;
  memo?: string;
}

export async function exportAnalysisData(items: ExportItem[]): Promise<void> {
  const path = await saveDialog({
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'CSV', extensions: ['csv'] },
    ],
  });

  if (!path) return; // User cancelled

  if (path.endsWith('.csv')) {
    const header = 'filename,subject,environment,composition,lighting,mood,style,memo';
    const rows = items.map(item => {
      const p = item.analysis?.structuredPrompts;
      return [
        csvEscape(item.filename),
        csvEscape(p?.subject?.original || ''),
        csvEscape(p?.environment?.original || ''),
        csvEscape(p?.composition?.original || ''),
        csvEscape(p?.lighting?.original || ''),
        csvEscape(p?.mood?.original || ''),
        csvEscape(p?.style?.original || ''),
        csvEscape(item.memo || ''),
      ].join(',');
    });
    await writeTextFile(path, [header, ...rows].join('\n'));
  } else {
    const data = {
      exportedAt: new Date().toISOString(),
      images: items.map(item => ({
        filename: item.filename,
        analysis: item.analysis?.structuredPrompts || null,
        description: item.analysis?.description || null,
        memo: item.memo || null,
      })),
    };
    await writeTextFile(path, JSON.stringify(data, null, 2));
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

- [ ] **Step 2: Add "Export Analysis" button to batch action bar**

In `ImageGrid.tsx`, add the export button in the batch action bar (after "Delete Selected", around line 288):

```tsx
<button
  onClick={handleExportAnalysis}
  className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
>
  Export Analysis
</button>
```

Add the handler:

```typescript
import { exportAnalysisData } from '@/utils/exportAnalysis';

const handleExportAnalysis = useCallback(async () => {
  if (multiSelected.size === 0) return;
  try {
    const items = await Promise.all(
      Array.from(multiSelected).map(async (id) => {
        const detail = await getImageDetail(id);
        return {
          filename: detail.filename,
          analysis: detail.analysis,
          memo: detail.memo,
        };
      })
    );
    await exportAnalysisData(items);
    showToast('Analysis data exported', 'success');
  } catch (err) {
    showToast(`Export failed: ${err}`, 'error');
  }
}, [multiSelected, getImageDetail]);
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/exportAnalysis.ts src/components/layout/ImageGrid.tsx
git commit -m "feat(F7): add analysis data export as JSON/CSV"
```

---

## Task 14: Import Legacy XLS (F7 — Import)

**Files:**
- Modify: `src/components/layout/ImageGrid.tsx`

**NOTE:** The `importLegacyFile()` function in `src/utils/importLegacy.ts` calls `invoke('import_legacy_item', {...})` but this IPC command does **not exist** in the Rust backend. The frontend button will be wired up, but actual XLS import will fail at runtime until the backend command is implemented. This is a known limitation — the UI entry point is added now; backend implementation is deferred.

- [ ] **Step 1: Add "Import XLS" button to toolbar**

In the toolbar section of ImageGrid (around the grid size slider area), add an import menu or button:

```tsx
<button
  onClick={handleImportXLS}
  className="p-2 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
  title="Import from XLS"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
</button>
```

Add the handler (uses a hidden file input for XLS selection):

```typescript
import { importLegacyFile } from '@/utils/importLegacy';

const handleImportXLS = useCallback(async () => {
  // Create a temporary file input for XLS files
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xls,.xlsx';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { result } = await importLegacyFile(file);
      showToast(`Imported ${result.imported} items (${result.failed} failed)`, result.failed > 0 ? 'error' : 'success');
      await loadImages();
    } catch (err) {
      showToast(`XLS import failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  input.click();
}, [loadImages]);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/ImageGrid.tsx
git commit -m "feat(F7): add legacy XLS import button to toolbar"
```

---

## Task 15: Debug and Fix AI Analysis (B2)

**Files:**
- Modify: `src/utils/imageToBase64.ts`
- Modify: `src/components/detail/DimensionCards.tsx`

This is an investigation task. The fix depends on what's found.

- [ ] **Step 1: Add detailed error logging to the analysis chain**

In `DimensionCards.tsx`, update `handleAnalyze` to log each step:

```typescript
const handleAnalyze = async () => {
  setAnalyzing(true);
  setError(null);
  try {
    const settings = await loadSettings();
    console.log('[Analysis] Settings loaded:', { provider: settings.persona, hasApiKey: !!settings.descriptionStyle });

    console.log('[Analysis] Converting image to base64, URL:', image?.substring(0, 80));
    const base64 = await imageUrlToBase64(image);
    console.log('[Analysis] Base64 length:', base64.length);

    console.log('[Analysis] Calling analyzeImage...');
    const result = await analyzeImage(base64, settings);
    console.log('[Analysis] Result received:', Object.keys(result));
    // ... rest of existing code
```

- [ ] **Step 2: Test and check console for the failure point**

Run: `pnpm tauri dev`, select an image, click "Analyze Now", check browser console for the `[Analysis]` logs.

Common findings and fixes:
- If `imageUrlToBase64` fails on `fetch(asset://...)`: The `fetch` API may not support `asset://` protocol. Fix by using Tauri's `readFile`:

```typescript
// In imageToBase64.ts:
import { readFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';

export async function imageUrlToBase64(url: string): Promise<string> {
  // Try fetch first (works for http/https and some asset:// URLs)
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (fetchErr) {
    console.warn('[imageToBase64] fetch failed, trying readFile:', fetchErr);
    // Fallback: extract file path from asset:// URL and use Tauri readFile
    const filePath = extractFilePath(url);
    if (!filePath) throw fetchErr;
    const bytes = await readFile(filePath);
    const base64 = btoa(String.fromCharCode(...bytes));
    const mime = url.match(/\.png$/i) ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  }
}

function extractFilePath(url: string): string | null {
  // asset://localhost/path/to/file → /path/to/file
  if (url.startsWith('asset://')) {
    const path = url.replace(/^asset:\/\/localhost/, '');
    return decodeURIComponent(path);
  }
  if (url.startsWith('file://')) {
    return url.slice(7);
  }
  return null;
}
```

- If API key is missing: Check that `settings.persona` (provider) and API key fields are correctly populated from IndexedDB.

- [ ] **Step 3: Verify fix**

Run: `pnpm tauri dev`, select an image, click "Analyze Now". Verify:
- Console shows successful base64 conversion
- AI provider receives the request
- Analysis results appear in dimension cards

- [ ] **Step 4: Commit**

```bash
git add src/utils/imageToBase64.ts src/components/detail/DimensionCards.tsx
git commit -m "fix(B2): add fallback file reading for asset:// URLs in AI analysis"
```

---

## Task 16: Final Integration Test

- [ ] **Step 1: Run all tests**

```bash
cd /Users/ccginger/Downloads/Antigravity/Snaplex-1231/snaplex
pnpm test
```

Expected: All existing tests pass.

- [ ] **Step 2: Run cargo check**

```bash
cd /Users/ccginger/Downloads/Antigravity/Snaplex-1231/snaplex/src-tauri
cargo check
```

Expected: No errors (warnings OK).

- [ ] **Step 3: Manual smoke test checklist**

Run `pnpm tauri dev` and verify:
- [ ] Drag-drop import: one image per drop, no duplicates
- [ ] System language: matches OS language on launch
- [ ] Sidebar collapse/expand: toggle button works, persists
- [ ] Collapsed sidebar: hover on folder icon shows popup
- [ ] Settings page: renders in center column, sidebar visible
- [ ] About page: renders in center column
- [ ] Back/forward nav: ← → buttons and Cmd+[/] work
- [ ] Rectangle selection: drag on grid background selects images
- [ ] Drag to folder: move from specific folder, link from All Images
- [ ] Color palette: no "COLOR PALETTE" heading
- [ ] Background: cream tone, divider between center and right columns
- [ ] Export analysis: select images → batch bar → Export Analysis → saves JSON/CSV
- [ ] AI analysis: "Analyze Now" completes successfully (requires valid API key)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final integration verification for Phase 0-2 refactor"
```
