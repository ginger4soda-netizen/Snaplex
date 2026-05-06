import { invoke } from '@tauri-apps/api/core';
import {
  LibraryInfo, FolderNode, ImageItem, ImageDetail,
  ImportResult, AnalysisResult, DimensionKey, DimensionVersion,
  SearchResult, ColorInfo, UpdateInfo, ChatMessage, TextEmbeddingSettings,
  IndexHealth, BackfillRun, ClipModelStatus, ImageSource
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
  getImages: (folderId?: string, offset: number = 0, limit: number = 500) =>
    invoke<ImageItem[]>('get_images', { folderId, offset, limit }),
  countImages: (folderId?: string) =>
    invoke<number>('count_images', { folderId }),
  getImagesByIds: (ids: string[]) => invoke<ImageItem[]>('get_images_by_ids', { ids }),
  importImages: (filePaths: string[], folderId?: string) =>
    invoke<ImportResult>('import_images', { filePaths, folderId }),
  deleteImages: (ids: string[]) => invoke<void>('delete_images', { ids }),
  moveImages: (ids: string[], targetFolderId: string) =>
    invoke<void>('move_images', { ids, targetFolderId }),
  removeImagesFromFolders: (ids: string[]) =>
    invoke<void>('remove_images_from_folders', { ids }),
  linkImageToFolder: (imageId: string, folderId: string) =>
    invoke<void>('link_image_to_folder', { imageId, folderId }),
  getImageDetail: (id: string) => invoke<ImageDetail>('get_image_detail', { id }),
  updateImageMemo: (id: string, memo: string) => invoke<void>('update_image_memo', { id, memo }),
  toggleFavorite: (id: string) => invoke<boolean>('toggle_favorite', { id }),
  setFavorites: (ids: string[], isFavorite: boolean) =>
    invoke<void>('set_favorites', { ids, isFavorite }),
  openImageInFinder: (id: string) => invoke<void>('open_image_in_finder', { id }),
  exportImages: (ids: string[], format: string) => invoke<string>('export_images', { ids, format }),
  getImageSources: (imageId: string) => invoke<ImageSource[]>('get_image_sources', { imageId }),

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
  getIndexHealth: () => invoke<IndexHealth>('get_index_health'),
  clipModelStatus: () => invoke<ClipModelStatus>('clip_model_status'),
  startBackfill: () => invoke<BackfillRun>('start_backfill'),
  cancelBackfill: () => invoke<void>('cancel_backfill'),
  rebuildTextIndex: () => invoke<void>('rebuild_text_index'),
  setClipIndexingEnabled: (enabled: boolean) => invoke<void>('set_clip_indexing_enabled', { enabled }),
  setTextEmbeddingConfig: (config: TextEmbeddingSettings | null) =>
    invoke<void>('set_text_embedding_config', { config }),
  setCurrentLocale: (locale: string) => invoke<void>('set_current_locale', { locale }),
  getCurrentLocale: () => invoke<string>('get_current_locale'),

  // Image base64 (for AI analysis — bypasses asset:// fetch issues)
  readImageBase64: (id: string) => invoke<string>('read_image_base64', { id }),

  // Color
  extractColorPalette: (imageId: string, colorCount: number = 8) =>
    invoke<ColorInfo[]>('extract_color_palette', { imageId, colorCount }),
  getColorPalette: (imageId: string) => invoke<ColorInfo[] | null>('get_color_palette', { imageId }),
  saveColorPalette: (imageId: string, colors: ColorInfo[]) =>
    invoke<void>('save_color_palette', { imageId, colors }),

  // Chat
  getChatMessages: (imageId: string) => invoke<ChatMessage[]>('get_chat_messages', { imageId }),
  saveChatMessage: (id: string, imageId: string, role: string, text: string) =>
    invoke<void>('save_chat_message', { id, imageId, role, text }),
  deleteChatMessages: (imageId: string) => invoke<void>('delete_chat_messages', { imageId }),

  // File system
  writeTextFile: (path: string, content: string) => invoke<void>('write_text_file', { path, content }),
  writeClipboardText: (text: string) => invoke<void>('write_clipboard_text', { text }),
  exportCaptureDiagnostics: (path: string) => invoke<void>('export_capture_diagnostics', { path }),

  // System
  checkForUpdate: () => invoke<UpdateInfo | null>('check_for_update'),
  installUpdate: () => invoke<void>('install_update'),
} as const;

/**
 * Hook that returns stable IPC function references.
 * Same object on every render — no re-render loops.
 */
export const useTauriIPC = () => ipc;
