import { invoke } from '@tauri-apps/api/core';
import {
  LibraryInfo, FolderNode, ImageItem, ImageDetail,
  ImportResult, AnalysisResult, DimensionKey, DimensionVersion,
  SearchResult, ColorInfo, UpdateInfo
} from '@/types';

/**
 * Stable IPC functions — defined at module level so references never change.
 * This prevents infinite re-render loops when used as useEffect dependencies.
 */
const ipc = {
  // Library
  openLibrary: (path: string) => invoke<LibraryInfo>('open_library', { path }),
  createLibrary: (path: string, name: string) => invoke<LibraryInfo>('create_library', { path, name }),
  getCurrentLibrary: () => invoke<LibraryInfo | null>('get_current_library'),

  // Folders
  getFolderTree: () => invoke<FolderNode[]>('get_folder_tree'),
  createFolder: (name: string, parentId: string | null) => invoke<FolderNode>('create_folder', { name, parentId }),
  renameFolder: (id: string, name: string) => invoke<void>('rename_folder', { id, name }),
  deleteFolder: (id: string) => invoke<void>('delete_folder', { id }),
  moveFolder: (id: string, newParentId: string | null) => invoke<void>('move_folder', { id, newParentId }),

  // Images
  getImages: (folderId?: string, offset: number = 0, limit: number = 50) =>
    invoke<ImageItem[]>('get_images', { folderId, offset, limit }),
  importImages: (filePaths: string[], folderId?: string) =>
    invoke<ImportResult>('import_images', { filePaths, folderId }),
  deleteImages: (ids: string[]) => invoke<void>('delete_images', { ids }),
  moveImages: (ids: string[], targetFolderId: string) =>
    invoke<void>('move_images', { ids, targetFolderId }),
  linkImageToFolder: (imageId: string, folderId: string) =>
    invoke<void>('link_image_to_folder', { imageId, folderId }),
  getImageDetail: (id: string) => invoke<ImageDetail>('get_image_detail', { id }),
  updateImageMemo: (id: string, memo: string) => invoke<void>('update_image_memo', { id, memo }),
  toggleFavorite: (id: string) => invoke<boolean>('toggle_favorite', { id }),
  openImageInFinder: (id: string) => invoke<void>('open_image_in_finder', { id }),
  exportImages: (ids: string[], format: string) => invoke<string>('export_images', { ids, format }),

  // Analysis
  getAnalysis: (imageId: string) => invoke<AnalysisResult | null>('get_analysis', { imageId }),
  saveAnalysis: (imageId: string, analysis: AnalysisResult, provider: string, model: string) =>
    invoke<void>('save_analysis', { imageId, analysis, provider, model }),
  getDimensionHistory: (imageId: string, dimension: DimensionKey) =>
    invoke<DimensionVersion[]>('get_dimension_history', { imageId, dimension }),
  saveDimensionVersion: (imageId: string, dimension: DimensionKey, original: string, translated: string) =>
    invoke<void>('save_dimension_version', { imageId, dimension, original, translated }),

  // Search
  searchImages: (query: string, folderId?: string) => invoke<SearchResult[]>('search_images', { query, folderId }),
  visualSearch: (query: string, limit: number = 50) => invoke<SearchResult[]>('visual_search', { query, limit }),

  // Color
  extractColorPalette: (imageId: string, colorCount: number = 8) =>
    invoke<ColorInfo[]>('extract_color_palette', { imageId, colorCount }),
  getColorPalette: (imageId: string) => invoke<ColorInfo[] | null>('get_color_palette', { imageId }),

  // File system
  writeTextFile: (path: string, content: string) => invoke<void>('write_text_file', { path, content }),

  // System
  checkForUpdate: () => invoke<UpdateInfo | null>('check_for_update'),
  installUpdate: () => invoke<void>('install_update'),
} as const;

/**
 * Hook that returns stable IPC function references.
 * Same object on every render — no re-render loops.
 */
export const useTauriIPC = () => ipc;
