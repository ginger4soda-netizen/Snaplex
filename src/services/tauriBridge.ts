// ============================================
// Tauri IPC Bridge - Typed wrappers for Rust backend commands
// ============================================
// Gracefully falls back when not running inside Tauri (e.g., web dev mode).

import { SearchResult, ColorInfo, ImageItem, ImageDetail, FolderNode, LibraryInfo, ImportResult, AnalysisResult, DimensionKey, DimensionVersion } from '../types';

// Detect Tauri environment
const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Dynamic import of Tauri invoke to avoid build errors in web mode
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriListen: ((event: string, handler: (event: any) => void) => Promise<() => void>) | null = null;

async function getInvoke() {
  if (tauriInvoke) return tauriInvoke;
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    tauriInvoke = invoke;
    return invoke;
  } catch {
    return null;
  }
}

async function getListen() {
  if (tauriListen) return tauriListen;
  if (!isTauri()) return null;
  try {
    const { listen } = await import('@tauri-apps/api/event');
    tauriListen = listen;
    return listen;
  } catch {
    return null;
  }
}

// ─── Search Commands ───────────────────────────────────────────

export async function searchImages(query: string, folderId?: string): Promise<SearchResult[]> {
  const invoke = await getInvoke();
  if (!invoke) return [];
  return invoke('search_images', { query, folderId }) as Promise<SearchResult[]>;
}

export async function visualSearch(query: string, limit: number = 20): Promise<SearchResult[]> {
  const invoke = await getInvoke();
  if (!invoke) return [];
  return invoke('visual_search', { query, limit }) as Promise<SearchResult[]>;
}

export async function saveTextEmbedding(imageId: string, vector: number[], model: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke('save_text_embedding', { imageId, vector, model });
}

// ─── Color Palette Commands ────────────────────────────────────

export async function extractColorPalette(imageId: string, colorCount: number = 8): Promise<ColorInfo[]> {
  const invoke = await getInvoke();
  if (!invoke) return [];
  return invoke('extract_color_palette', { imageId, colorCount }) as Promise<ColorInfo[]>;
}

export async function getColorPalette(imageId: string): Promise<ColorInfo[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  return invoke('get_color_palette', { imageId }) as Promise<ColorInfo[] | null>;
}

// ─── Image Commands ────────────────────────────────────────────

export async function getImages(folderId?: string, offset: number = 0, limit: number = 50): Promise<ImageItem[]> {
  const invoke = await getInvoke();
  if (!invoke) return [];
  return invoke('get_images', { folderId, offset, limit }) as Promise<ImageItem[]>;
}

export async function getImageDetail(id: string): Promise<ImageDetail | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  return invoke('get_image_detail', { id }) as Promise<ImageDetail>;
}

export async function importImages(filePaths: string[], folderId?: string): Promise<ImportResult> {
  const invoke = await getInvoke();
  if (!invoke) return { imported: 0, failed: 0, errors: ['Not running in Tauri'] };
  return invoke('import_images', { filePaths, folderId }) as Promise<ImportResult>;
}

export async function deleteImages(ids: string[]): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke('delete_images', { ids });
}

export async function moveImages(ids: string[], targetFolderId: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke('move_images', { ids, targetFolderId });
}

export async function updateImageMemo(id: string, memo: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke('update_image_memo', { id, memo });
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const invoke = await getInvoke();
  if (!invoke) return false;
  return invoke('toggle_favorite', { id }) as Promise<boolean>;
}

export async function openImageInFinder(id: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke('open_image_in_finder', { id });
}

// ─── Folder Commands ───────────────────────────────────────────

export async function getFolderTree(): Promise<FolderNode[]> {
  const invoke = await getInvoke();
  if (!invoke) return [];
  return invoke('get_folder_tree') as Promise<FolderNode[]>;
}

export async function createFolder(name: string, parentId: string | null): Promise<FolderNode> {
  const invoke = await getInvoke();
  if (!invoke) throw new Error('Not running in Tauri');
  return invoke('create_folder', { name, parentId }) as Promise<FolderNode>;
}

// ─── Library Commands ──────────────────────────────────────────

export async function openLibrary(path: string): Promise<LibraryInfo> {
  const invoke = await getInvoke();
  if (!invoke) throw new Error('Not running in Tauri');
  return invoke('open_library', { path }) as Promise<LibraryInfo>;
}

export async function createLibrary(path: string, name: string): Promise<LibraryInfo> {
  const invoke = await getInvoke();
  if (!invoke) throw new Error('Not running in Tauri');
  return invoke('create_library', { path, name }) as Promise<LibraryInfo>;
}

export async function getCurrentLibrary(): Promise<LibraryInfo | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  return invoke('get_current_library') as Promise<LibraryInfo | null>;
}

// ─── Analysis Commands ─────────────────────────────────────────

export async function getAnalysis(imageId: string): Promise<AnalysisResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  return invoke('get_analysis', { imageId }) as Promise<AnalysisResult | null>;
}

export async function saveAnalysis(imageId: string, analysis: AnalysisResult, provider: string, model: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke('save_analysis', { imageId, analysis, provider, model });
}

// ─── Event Listeners ───────────────────────────────────────────

export async function listenFsChange(handler: (event: { type: 'add' | 'remove' | 'modify'; path: string; imageId?: string }) => void): Promise<(() => void) | null> {
  const listen = await getListen();
  if (!listen) return null;
  return listen('fs-change', (e: any) => handler(e.payload));
}

// ─── Utility ───────────────────────────────────────────────────

export { isTauri };
