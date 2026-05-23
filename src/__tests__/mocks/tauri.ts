/**
 * Mock layer for Tauri IPC commands.
 *
 * Simulates the Rust backend behavior so frontend tests can validate
 * the full lifecycle without requiring a Tauri runtime.
 *
 * Each mock command mirrors the real Rust command's contract:
 * - Same parameter names and types
 * - Same success/error return shapes
 * - Same precondition checks (e.g., "No library open")
 */

import { vi } from 'vitest';
import type {
  LibraryInfo, FolderNode, ImageItem, ImageDetail,
  ImportResult, AnalysisResult, SearchResult, ColorInfo, ImageSource,
} from '../../types';

// ---- In-memory state (mirrors Rust's Mutex<Option<Database>>) ----

interface MockState {
  currentLibrary: LibraryInfo | null;
  folders: FolderNode[];
  images: MockImageItem[];
  imageDetails: Map<string, ImageDetail>;
  nextId: number;
}

interface MockImageItem extends ImageItem {
  folderId: string | null;
  fullUrl: string;
  fileSize: number;
}

let state: MockState = createFreshState();
const eventListeners = new Map<string, Set<(event: { payload: unknown }) => void>>();

function createFreshState(): MockState {
  return {
    currentLibrary: null,
    folders: [],
    images: [],
    imageDetails: new Map(),
    nextId: 1,
  };
}

/** Reset all mock state — call in beforeEach */
export function resetMockState() {
  state = createFreshState();
}

/** Get current mock state for assertions */
export function getMockState() {
  return state;
}

/** Manually set library as open (for tests that skip the create step) */
export function setMockLibraryOpen(info: LibraryInfo) {
  state.currentLibrary = info;
}

export function emitMockEvent(name: string, payload: unknown) {
  eventListeners.get(name)?.forEach(listener => listener({ payload }));
}

// ---- Command implementations ----

function requireLibrary(): LibraryInfo {
  if (!state.currentLibrary) {
    throw new Error('No library open');
  }
  return state.currentLibrary;
}

const commands: Record<string, (...args: any[]) => any> = {
  create_library: ({ path, name }: { path: string; name: string }) => {
    const info: LibraryInfo = { path, name, imageCount: 0, createdAt: new Date().toISOString() };
    state.currentLibrary = info;
    return info;
  },

  open_library: ({ path }: { path: string }) => {
    const name = path.split('/').pop()?.replace('.snpx', '') || 'Library';
    const info: LibraryInfo = { path, name, imageCount: state.images.length, createdAt: new Date().toISOString() };
    state.currentLibrary = info;
    return info;
  },

  get_current_library: () => {
    return state.currentLibrary; // null if none
  },

  get_folder_tree: () => {
    requireLibrary();
    return state.folders;
  },

  create_folder: ({ name, parentId }: { name: string; parentId: string | null }) => {
    requireLibrary();
    const folder: FolderNode = {
      id: `folder-${state.nextId++}`,
      name,
      parentId,
      children: [],
      imageCount: 0,
    };
    state.folders.push(folder);
    return folder;
  },

  rename_folder: ({ id, name }: { id: string; name: string }) => {
    requireLibrary();
    const folder = state.folders.find(f => f.id === id);
    if (!folder) throw new Error(`Folder ${id} not found`);
    folder.name = name;
  },

  delete_folder: ({ id }: { id: string }) => {
    requireLibrary();
    state.folders = state.folders.filter(f => f.id !== id);
  },

  move_folder: ({ id, newParentId }: { id: string; newParentId: string | null }) => {
    requireLibrary();
    const folder = state.folders.find(f => f.id === id);
    if (!folder) throw new Error(`Folder ${id} not found`);
    folder.parentId = newParentId;
  },

  get_images: ({ folderId, offset = 0, limit = 50 }: { folderId?: string; offset?: number; limit?: number }) => {
    requireLibrary();
    let filtered = folderId ? state.images.filter(i => i.folderId === folderId) : state.images;
    return filtered.slice(offset, offset + limit);
  },

  count_images: ({ folderId }: { folderId?: string }) => {
    requireLibrary();
    const filtered = folderId ? state.images.filter(i => i.folderId === folderId) : state.images;
    return filtered.length;
  },

  import_images: ({ filePaths, folderId }: { filePaths: string[]; folderId?: string }) => {
    requireLibrary();
    const imported: MockImageItem[] = filePaths.map(fp => {
      const filename = fp.split('/').pop() || 'unknown.jpg';
      const item: MockImageItem = {
        id: `img-${state.nextId++}`,
        filename,
        thumbUrl: `file://${fp}`,
        fullUrl: `file://${fp}`,
        width: 800,
        height: 600,
        fileSize: 1024,
        folderId: folderId || null,
        isFavorite: false,
        hasAnalysis: false,
        createdAt: new Date().toISOString(),
      };
      state.images.push(item);
      return item;
    });

    const result: ImportResult = {
      imported: imported.length,
      failed: 0,
      errors: [],
    };
    return result;
  },

  delete_images: ({ ids }: { ids: string[] }) => {
    requireLibrary();
    state.images = state.images.filter(i => !ids.includes(i.id));
  },

  get_image_detail: ({ id }: { id: string }) => {
    requireLibrary();
    const img = state.images.find(i => i.id === id);
    if (!img) throw new Error(`Image ${id} not found`);
    const detail: ImageDetail = {
      ...img,
      memo: '',
      analysis: null,
      colorPalette: null,
      sourceUrl: null,
      folderIds: img.folderId ? [img.folderId] : [],
    };
    return detail;
  },

  get_image_sources: ({ imageId }: { imageId: string }) => {
    requireLibrary();
    return [] as ImageSource[];
  },

  update_image_memo: ({ id, memo }: { id: string; memo: string }) => {
    requireLibrary();
    const img = state.images.find(i => i.id === id);
    if (!img) throw new Error(`Image ${id} not found`);
  },

  toggle_favorite: ({ id }: { id: string }) => {
    requireLibrary();
    const img = state.images.find(i => i.id === id);
    if (!img) throw new Error(`Image ${id} not found`);
    img.isFavorite = !img.isFavorite;
    return img.isFavorite;
  },

  search_images: ({ query, folderId }: { query: string; folderId?: string }) => {
    requireLibrary();
    return [] as SearchResult[];
  },

  visual_search: ({ query, limit, folderId }: { query: string; limit?: number; folderId?: string }) => {
    requireLibrary();
    return [] as SearchResult[];
  },

  get_index_health: () => {
    requireLibrary();
    return {
      totalImages: state.images.length,
      text: {
        indexed: 0,
        failed: 0,
        modelVersion: null,
        lastFailure: null,
      },
      visual: {
        indexed: 0,
        failed: 0,
        modelVersion: 'clip-vit-b-32-int8',
        lastFailure: null,
      },
      latestBackfill: null,
    };
  },

  clip_model_status: () => ({
    available: true,
    expectedPath: 'models/clip/clip-vit-b-32-int8.onnx',
    modelVersion: 'clip-vit-b-32-int8',
    error: null,
  }),

  start_backfill: () => {
    requireLibrary();
    return {
      channelId: 'backfill-test',
      alreadyRunning: false,
    };
  },

  extract_color_palette: ({ imageId, colorCount }: { imageId: string; colorCount?: number }) => {
    requireLibrary();
    return [] as ColorInfo[];
  },

  get_color_palette: ({ imageId }: { imageId: string }) => {
    requireLibrary();
    return null;
  },

  get_analysis: ({ imageId }: { imageId: string }) => {
    requireLibrary();
    return null;
  },

  save_analysis: () => { requireLibrary(); },
  get_dimension_history: () => { requireLibrary(); return []; },
  save_dimension_version: () => { requireLibrary(); },
  move_images: () => { requireLibrary(); },
  link_image_to_folder: () => { requireLibrary(); },
  open_image_in_finder: () => { requireLibrary(); },
  export_images: () => { requireLibrary(); return ''; },
  export_capture_diagnostics: () => {},
  cancel_backfill: () => {},
  rebuild_text_index: () => { requireLibrary(); },
  set_clip_indexing_enabled: () => {},
  set_text_embedding_config: () => {},
  set_current_locale: () => {},
  get_current_locale: () => 'en',
  check_for_update: () => null,
  install_update: () => {},
};

/**
 * Mock implementation of Tauri's `invoke` function.
 * Routes command names to the mock implementations above.
 */
export const mockInvoke = vi.fn(async (cmd: string, args?: Record<string, any>) => {
  const handler = commands[cmd];
  if (!handler) {
    throw new Error(`Unknown Tauri command: ${cmd}`);
  }
  return handler(args || {});
});

/**
 * Setup all Tauri module mocks.
 * Call this in your test setup file.
 */
export function setupTauriMocks() {
  vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke,
    convertFileSrc: (path: string) => `asset://localhost/${path}`,
  }));

  vi.mock('@tauri-apps/api/path', () => ({
    homeDir: vi.fn(async () => '/tmp/test-home/'),
  }));

  vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn(async (name: string, listener: (event: { payload: unknown }) => void) => {
      if (!eventListeners.has(name)) eventListeners.set(name, new Set());
      eventListeners.get(name)!.add(listener);
      return () => {
        eventListeners.get(name)?.delete(listener);
      };
    }),
  }));

  vi.mock('@tauri-apps/api/webviewWindow', () => ({
    getCurrentWebviewWindow: () => ({
      onDragDropEvent: vi.fn(async () => () => {}),
    }),
  }));

  vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn(async () => null),
    save: vi.fn(async () => null),
  }));

  vi.mock('idb-keyval', () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  }));

  // Toast hook uses global state — no mock needed, but ensure module resolves
}
