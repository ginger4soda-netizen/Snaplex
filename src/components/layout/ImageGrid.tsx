import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { ImageItem, FolderNode, DEFAULT_SETTINGS, UserSettings, DimensionKey } from '@/types';
import ImageCard from '../images/ImageCard';
import SearchBar from '../search/SearchBar';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { showToast } from '@/hooks/useToast';
import { exportAnalysisData } from '@/utils/exportAnalysis';
import { importLegacyFile } from '@/utils/importLegacy';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useGridDimensions } from '@/hooks/useGridDimensions';
import { cardRectAtIndex, rectsIntersect, GRID_GAP, GRID_PADDING } from '@/utils/gridGeometry';
import { analyzeImage } from '@/services/geminiService';
import { getCurrentProvider, getCurrentModel } from '@/services/providers/types';
import { getImageBase64 } from '@/utils/imageToBase64';
import { get } from 'idb-keyval';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import Logo from '@/components/shared/Logo';
import { getTranslation } from '@/translations';

// macOS treats Ctrl+click as a right-click but ALSO emits a synthetic click
// with ctrlKey=true. Without platform-aware handling, that click toggles the
// image off the multi-selection. On Mac the multi-toggle modifier is Cmd.
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent);

const ALL_DIMS: DimensionKey[] = ['subject', 'environment', 'composition', 'lighting', 'mood', 'style'];

type SnaplexDragPayload = {
  ids: string[];
  sourceFolder: string;
  startedAt: number;
  lastX?: number;
  lastY?: number;
};

type InternalImageDrag = {
  ids: string[];
  x: number;
  y: number;
  thumbSrc: string;
};

declare global {
  interface Window {
    __SNAPLEX_IMAGE_DRAG__?: SnaplexDragPayload;
    __SNAPLEX_SELECTED_IMAGES__?: string[];
    __SNAPLEX_IMAGE_DRAG_OVER__?: (event: DragEvent) => void;
  }
}

const loadUserSettings = async (): Promise<UserSettings> => {
  try {
    const stored = await get('visionLearnSettings');
    return stored || DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const logBatchDebug = (message: string) => {
  invoke('debug_log', { message }).catch(() => {});
};

interface ImageGridProps {
  folderId?: string;
  selectedImageId?: string;
  onImageSelect: (imageId: string | undefined) => void;
  onToggleDetail: () => void;
  isDetailVisible: boolean;
  nav?: { goBack: () => void; goForward: () => void; canGoBack: boolean; canGoForward: boolean };
  refreshTrigger?: number;
  onImagesChanged?: () => void;
  systemLanguage?: string;
}

const ImageGrid: React.FC<ImageGridProps> = ({
  folderId,
  selectedImageId,
  onImageSelect,
  onToggleDetail,
  isDetailVisible,
  nav,
  refreshTrigger,
  onImagesChanged,
  systemLanguage,
}) => {
  const t = getTranslation(systemLanguage);
  const { getImages, getImageDetail, getImagesByIds, countImages, importImages, deleteImages, toggleFavorite, setFavorites, openImageInFinder, moveImages, removeImagesFromFolders, linkImageToFolder, getFolderTree, saveAnalysis, saveDimensionVersion } = useTauriIPC();
  const [images, setImages] = useState<ImageItem[]>([]);
  // Slider drives column count directly. Min cols = biggest cards (slider far right);
  // max cols = smallest cards (slider far left). Stepping the slider changes
  // columnCount by exactly 1, so the layout snaps to whole-card increments.
  const MIN_COLS = 4;
  const MAX_COLS = 10;
  const [columnCount, setColumnCount] = useState(MIN_COLS);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [moveToFolderTargets, setMoveToFolderTargets] = useState<string[] | null>(null);
  const [folderList, setFolderList] = useState<FolderNode[]>([]);
  const [rectSelect, setRectSelect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 500;
  const folderRequestRef = useRef<string | undefined>(undefined);
  // Synchronous re-entry guard for loadMore — state alone is async and can let
  // multiple scroll-triggered calls slip through before React commits.
  const loadingPageRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const importingRef = useRef(false);
  const dropPathsRef = useRef<Set<string>>(new Set());
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveSelectedIdsRef = useRef<Set<string>>(new Set());
  const multiSelectedRef = useRef<Set<string>>(new Set());
  const selectedImageIdRef = useRef<string | undefined>(selectedImageId);
  const visibleImageIdsRef = useRef<Set<string>>(new Set());
  const suppressNextClickRef = useRef(false);
  const [internalDrag, setInternalDrag] = useState<InternalImageDrag | null>(null);

  const { cellSize, rowHeight } = useGridDimensions(scrollContainerRef, columnCount);
  const effectiveCount = searchResultIds !== null ? images.length : Math.max(images.length, totalCount);
  const rowCount = Math.ceil(effectiveCount / Math.max(1, columnCount));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, rowHeight, cellSize, columnCount, rowCount]);

  const visibleImageIds = useMemo(() => new Set(images.map(img => img.id)), [images]);
  useEffect(() => {
    visibleImageIdsRef.current = visibleImageIds;
  }, [visibleImageIds]);

  useEffect(() => {
    selectedImageIdRef.current = selectedImageId;
  }, [selectedImageId]);

  const syncMultiSelected = useCallback((next: Set<string>, reason: string) => {
    const visible = visibleImageIdsRef.current;
    const normalized = new Set(Array.from(next).filter(id => visible.size === 0 || visible.has(id)));
    const effective = new Set(normalized);
    const focused = selectedImageIdRef.current;
    if (focused && normalized.size > 0 && (visible.size === 0 || visible.has(focused))) {
      effective.add(focused);
    }
    multiSelectedRef.current = normalized;
    effectiveSelectedIdsRef.current = effective;
    window.__SNAPLEX_SELECTED_IMAGES__ = Array.from(effective);
    logBatchDebug(`selection-${reason} multi=${normalized.size} effective=${effective.size}`);
    setMultiSelected(normalized);
  }, []);

  const effectiveSelectedIds = useMemo(() => {
    const ids = new Set(multiSelected);
    for (const id of ids) {
      if (!visibleImageIds.has(id)) {
        ids.delete(id);
      }
    }
    if (selectedImageId && multiSelected.size > 0 && visibleImageIds.has(selectedImageId)) {
      ids.add(selectedImageId);
    }
    return ids;
  }, [multiSelected, selectedImageId, visibleImageIds]);
  const isMultiMode = multiSelected.size > 0;
  const selectedCount = isMultiMode ? effectiveSelectedIds.size : 0;

  const getTargetImageIds = useCallback((imageId: string) => {
    const ids = new Set(window.__SNAPLEX_SELECTED_IMAGES__ || Array.from(effectiveSelectedIdsRef.current));
    document.querySelectorAll<HTMLElement>('[data-image-card][data-selected="true"]').forEach(node => {
      const id = node.dataset.imageId;
      if (id) ids.add(id);
    });
    if (ids.size > 0) {
      return Array.from(ids);
    }
    return [imageId];
  }, []);

  useEffect(() => {
    effectiveSelectedIdsRef.current = effectiveSelectedIds;
    window.__SNAPLEX_SELECTED_IMAGES__ = Array.from(effectiveSelectedIds);
  }, [effectiveSelectedIds]);

  useEffect(() => {
    if (multiSelected.size === 0) return;
    syncMultiSelected((() => {
      const prev = multiSelectedRef.current;
      const next = new Set(Array.from(prev).filter(id => visibleImageIds.has(id)));
      return next;
    })(), 'prune');
  }, [visibleImageIds, multiSelected.size, syncMultiSelected]);

  useEffect(() => {
    const clearSelection = () => {
      syncMultiSelected(new Set(), 'clear-external-drop');
      onImageSelect(undefined);
    };
    window.addEventListener('snaplex-clear-selection', clearSelection);
    return () => window.removeEventListener('snaplex-clear-selection', clearSelection);
  }, [syncMultiSelected, onImageSelect]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    loadingPageRef.current = true;
    // Clear immediately so the spinner gate (loading && images.length === 0) fires
    // and rect-select / loadMore don't run against the previous folder's data.
    setImages([]);
    setTotalCount(0);
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
      loadingPageRef.current = false;
    }
  }, [folderId, getImages, countImages]);

  const loadMore = useCallback(async () => {
    if (loadingPageRef.current) return;
    if (images.length >= totalCount) return;
    if (searchResultIds !== null) return; // search path doesn't paginate

    loadingPageRef.current = true;
    const requestFolder = folderId;
    folderRequestRef.current = requestFolder;
    try {
      const nextPage = await getImages(folderId, images.length, PAGE_SIZE);
      if (folderRequestRef.current !== requestFolder) return;
      setImages(prev => [...prev, ...nextPage]);
    } catch (err) {
      showToast(`Failed to load more images: ${err}`, 'error');
    } finally {
      loadingPageRef.current = false;
    }
  }, [folderId, images.length, totalCount, searchResultIds, getImages]);

  useEffect(() => {
    if (searchResultIds === null) {
      loadImages();
    }
  }, [folderId, searchResultIds, loadImages, refreshTrigger]);

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

  const handleSearchResults = async (ids: string[]) => {
    setSearchResultIds(ids);
    if (ids.length > 0) {
      setLoading(true);
      try {
        const items = await getImagesByIds(ids.slice(0, 200));
        // Sort by search result order
        const idOrder = new Map(ids.map((id, i) => [id, i]));
        items.sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999));
        setImages(items);
      } catch (err) {
        showToast(`Search failed: ${err}`, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      setImages([]);
    }
  };

  const handleSearchClear = () => {
    setSearchResultIds(null);
    loadImages();
  };

  // Tauri native drag-and-drop listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    // Track whether the current OS drag actually carries image files. Tauri 2
    // can fire events for in-app HTML5 drags (e.g. chat chips) where `paths`
    // is empty — we must not show the file-import overlay in that case.
    let dragHasImageFiles = false;
    const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg|tiff?)$/i;

    const setupDragDrop = async () => {
      try {
        const webview = getCurrentWebviewWindow();
        unlisten = await webview.onDragDropEvent(async (event) => {
          if (event.payload.type === 'enter') {
            const paths = (event.payload as any).paths as string[] | undefined;
            dragHasImageFiles = !!paths && paths.some((p: string) => IMAGE_RE.test(p));
            if (dragHasImageFiles) setIsDragOver(true);
          } else if (event.payload.type === 'over') {
            if (dragHasImageFiles) setIsDragOver(true);
          } else if (event.payload.type === 'drop') {
            setIsDragOver(false);
            const wasFileDrag = dragHasImageFiles;
            dragHasImageFiles = false;
            if (!wasFileDrag) return;
            // Collect paths from potentially multiple drop events
            const paths = event.payload.paths;
            const imagePaths = paths.filter((p: string) => IMAGE_RE.test(p));
            imagePaths.forEach((p: string) => dropPathsRef.current.add(p));

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
          } else if (event.payload.type === 'leave') {
            setIsDragOver(false);
            dragHasImageFiles = false;
          }
        });
      } catch (err) {
        console.log("Drag-drop events not available (web mode)");
      }
    };

    setupDragDrop();
    return () => {
      unlisten?.();
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
    };
  }, [folderId, importImages, loadImages]);

  const handleImageClick = useCallback((id: string, e?: React.MouseEvent) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    // Platform-aware multi-toggle modifier: Cmd on Mac, Ctrl elsewhere.
    // On Mac, Ctrl+click is reserved for the right-click contextmenu path;
    // treating it as a multi-toggle here would silently drop the image
    // out of the selection during the contextmenu flow.
    const isToggleModifier = e ? (IS_MAC ? e.metaKey : e.ctrlKey) : false;
    if (isToggleModifier) {
      const prev = multiSelectedRef.current;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      syncMultiSelected(next, 'toggle');
      return;
    }
    if (e && e.shiftKey && selectedImageId) {
      // Shift+click: range select
      const startIdx = images.findIndex(img => img.id === selectedImageId);
      const endIdx = images.findIndex(img => img.id === id);
      if (startIdx >= 0 && endIdx >= 0) {
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = images.slice(lo, hi + 1).map(img => img.id);
        syncMultiSelected(new Set(rangeIds), 'range');
        return;
      }
    }
    // Normal click: single select
    if (isMultiMode) {
      syncMultiSelected(new Set(), 'clear-click');
    }
    onImageSelect(id);
  }, [images, selectedImageId, isMultiMode, onImageSelect, syncMultiSelected]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedCount === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedCount} image${selectedCount === 1 ? '' : 's'}?\n\nThis will remove the library records and delete the stored image and thumbnail files from this Snaplex library.`
    );
    if (!confirmed) return;
    try {
      const deletedIds = Array.from(effectiveSelectedIds);
      await deleteImages(deletedIds);
      setImages(prev => prev.filter(img => !effectiveSelectedIds.has(img.id)));
      setTotalCount(prev => Math.max(0, prev - deletedIds.length));
      if (selectedImageId && effectiveSelectedIds.has(selectedImageId)) onImageSelect(undefined);
      showToast(`Deleted ${deletedIds.length} image(s)`, 'success');
      syncMultiSelected(new Set(), 'clear-delete');
    } catch (err) {
      showToast(`Failed to delete: ${err}`, 'error');
    }
  }, [selectedCount, effectiveSelectedIds, deleteImages, selectedImageId, onImageSelect, syncMultiSelected]);

  const handleSelectAll = useCallback(() => {
    syncMultiSelected(new Set(images.map(img => img.id)), 'select-all');
  }, [images, syncMultiSelected]);

  const handleClearSelection = useCallback(() => {
    syncMultiSelected(new Set(), 'clear-button');
  }, [syncMultiSelected]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      const ids = getTargetImageIds(id);
      if (ids.length > 1) {
        const clicked = images.find(img => img.id === id);
        const nextValue = !(clicked?.isFavorite ?? false);
        await setFavorites(ids, nextValue);
      if (folderId === '__favorites__' && !nextValue) {
        await loadImages();
      } else {
        setImages(prev => prev.map(img =>
          ids.includes(img.id) ? { ...img, isFavorite: nextValue } : img
        ));
      }
      showToast(`${nextValue ? 'Added' : 'Removed'} ${ids.length} image${ids.length === 1 ? '' : 's'} ${nextValue ? 'to' : 'from'} favorites`, 'success');
      onImagesChanged?.();
      return;
    }
      const nextValue = await toggleFavorite(id);
      if (folderId === '__favorites__' && !nextValue) {
        await loadImages();
      } else {
      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, isFavorite: nextValue } : img
      ));
    }
    onImagesChanged?.();
  } catch (err) {
    showToast(`Failed to toggle favorite: ${err}`, 'error');
  }
  }, [folderId, images, getTargetImageIds, toggleFavorite, setFavorites, loadImages, onImagesChanged]);

  const handleDeleteImage = useCallback(async (id: string) => {
    const image = images.find(img => img.id === id);
    const confirmed = window.confirm(
      `Delete "${image?.filename || 'this image'}"?\n\nThis will remove the library record and delete the stored image and thumbnail files from this Snaplex library.`
    );
    if (!confirmed) return;
    try {
      await deleteImages([id]);
      setImages(prev => prev.filter(img => img.id !== id));
      setTotalCount(prev => Math.max(0, prev - 1));
      if (selectedImageId === id) onImageSelect(undefined);
    } catch (err) {
      showToast(`Failed to delete image: ${err}`, 'error');
    }
  }, [deleteImages, images, selectedImageId, onImageSelect]);

  const handleOpenInFinder = useCallback(async (id: string) => {
    try {
      await openImageInFinder(id);
    } catch (err) {
      showToast(`Failed to open in Finder: ${err}`, 'error');
    }
  }, [openImageInFinder]);

  const handleMoveToFolder = useCallback(async (imageId: string) => {
    // If the right-clicked image is part of the visible multi-selection, move
    // the whole group. The single focused image is included because it is also
    // rendered as selected during Cmd/Ctrl multi-select.
    const ids = getTargetImageIds(imageId);
    logBatchDebug(`move-menu image=${imageId} ids=${ids.length} selectedRef=${effectiveSelectedIdsRef.current.size}`);
    setMoveToFolderTargets(ids);
    try {
      const tree = await getFolderTree();
      setFolderList(tree);
    } catch (err) {
      showToast(`Failed to load folders: ${err}`, 'error');
    }
  }, [getTargetImageIds, getFolderTree]);

  const confirmMoveToFolder = useCallback(async (targetFolderId: string) => {
    if (!moveToFolderTargets || moveToFolderTargets.length === 0) return;
    const movedIds = moveToFolderTargets;
    try {
      logBatchDebug(`move-confirm target=${targetFolderId} ids=${movedIds.length}`);
      if (targetFolderId === '__all__') {
        await removeImagesFromFolders(movedIds);
      } else {
        await moveImages(movedIds, targetFolderId);
      }
      showToast(`${targetFolderId === '__all__' ? 'Removed from folders' : 'Moved'} ${movedIds.length} image${movedIds.length === 1 ? '' : 's'}`, 'success');
      if (multiSelected.size > 0) syncMultiSelected(new Set(), 'clear-move');
      await loadImages();
      onImagesChanged?.();
    } catch (err) {
      showToast(`Move failed: ${err}`, 'error');
    }
    setMoveToFolderTargets(null);
    setFolderList([]);
  }, [moveToFolderTargets, multiSelected, moveImages, removeImagesFromFolders, loadImages, syncMultiSelected, onImagesChanged]);

  const handleRemoveFromFolder = useCallback(async (imageId: string) => {
    const ids = getTargetImageIds(imageId);
    try {
      await removeImagesFromFolders(ids);
      showToast(`Removed ${ids.length} image${ids.length === 1 ? '' : 's'} from folders`, 'success');
      syncMultiSelected(new Set(), 'clear-remove-folder');
      await loadImages();
      onImagesChanged?.();
    } catch (err) {
      showToast(`Remove from folder failed: ${err}`, 'error');
    }
  }, [getTargetImageIds, removeImagesFromFolders, loadImages, syncMultiSelected, onImagesChanged]);

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
      syncMultiSelected(new Set(), 'clear-rect-start');
      onImageSelect(undefined);
    }
  }, [syncMultiSelected, onImageSelect]);

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

    const selected = new Set<string>();
    for (let i = 0; i < images.length; i++) {
      const r = cardRectAtIndex(i, Math.max(1, columnCount), cellSize, GRID_GAP, GRID_PADDING, GRID_PADDING);
      if (rectsIntersect(selRect, r)) {
        selected.add(images[i].id);
      }
    }
    syncMultiSelected(selected, 'rect');
  }, [rectSelect, images, columnCount, cellSize, syncMultiSelected]);

  const handleGridMouseUp = useCallback(() => {
    setRectSelect(null);
  }, []);

  const dispatchInternalDragOverFolder = (folderId: string | null) => {
    window.dispatchEvent(new CustomEvent('snaplex-internal-drag-over-folder', { detail: { folderId } }));
  };

  const handleInternalDragMouseDown = useCallback((imageId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const ids = getTargetImageIds(imageId);
    const sourceFolder = folderId || '';
    const thumbSrc = (e.currentTarget as HTMLElement).querySelector('img')?.getAttribute('src') || '';
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    let lastFolderId: string | null = null;

    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      dispatchInternalDragOverFolder(null);
      setInternalDrag(null);
    };

    const getTargetFolderId = (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      return target?.closest<HTMLElement>('[data-folder-id]')?.dataset.folderId || null;
    };

    const commitDrop = async (targetFolderId: string, altKey: boolean) => {
      const isRemoveToAll = targetFolderId === '__all__';
      const shouldLink = !isRemoveToAll && (!sourceFolder || sourceFolder === '__favorites__' || altKey);
      logBatchDebug(`pointer-drop-folder target=${targetFolderId} ids=${ids.length} source=${sourceFolder || 'none'} link=${shouldLink}`);
      try {
        if (isRemoveToAll) {
          await removeImagesFromFolders(ids);
        } else if (shouldLink) {
          await Promise.all(ids.map(id => linkImageToFolder(id, targetFolderId)));
        } else {
          await moveImages(ids, targetFolderId);
        }
        showToast(`${isRemoveToAll ? 'Removed from folders' : shouldLink ? 'Linked' : 'Moved'} ${ids.length} image${ids.length === 1 ? '' : 's'}`, 'success');
        syncMultiSelected(new Set(), 'clear-pointer-drop');
        onImageSelect(undefined);
        await loadImages();
        onImagesChanged?.();
      } catch (err) {
        showToast(`Drag to folder failed: ${err}`, 'error');
      }
    };

    function handleMouseMove(event: MouseEvent) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!active && Math.hypot(dx, dy) < 6) return;

      if (!active) {
        active = true;
        suppressNextClickRef.current = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
        logBatchDebug(`pointer-drag-start image=${imageId} ids=${ids.length} selectedRef=${effectiveSelectedIdsRef.current.size}`);
      }

      event.preventDefault();
      const folderIdUnderPointer = getTargetFolderId(event.clientX, event.clientY);
      if (folderIdUnderPointer !== lastFolderId) {
        lastFolderId = folderIdUnderPointer;
        dispatchInternalDragOverFolder(folderIdUnderPointer);
      }
      setInternalDrag({ ids, x: event.clientX, y: event.clientY, thumbSrc });
    }

    async function handleMouseUp(event: MouseEvent) {
      const wasActive = active;
      const targetFolderId = wasActive ? getTargetFolderId(event.clientX, event.clientY) : null;
      cleanup();

      if (!wasActive) return;
      event.preventDefault();
      suppressNextClickRef.current = true;
      if (!targetFolderId) {
        logBatchDebug(`pointer-drop-miss ids=${ids.length} x=${event.clientX} y=${event.clientY}`);
        return;
      }
      await commitDrop(targetFolderId, event.altKey);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [folderId, getTargetImageIds, linkImageToFolder, moveImages, removeImagesFromFolders, loadImages, syncMultiSelected, onImageSelect, onImagesChanged]);

  // Drag-to-folder: set drag data with selected image IDs and source folder.
  // For multi-drag, render a small stacked thumbnail with a count badge so the
  // user can see they're moving more than one image (default browser drag image
  // would only show the single dragged card).
  const handleDragStart = useCallback((imageId: string, e: React.DragEvent) => {
    const ids = getTargetImageIds(imageId);
    logBatchDebug(`drag-start image=${imageId} ids=${ids.length} selectedRef=${effectiveSelectedIdsRef.current.size}`);
    const payload = JSON.stringify(ids);
    window.__SNAPLEX_IMAGE_DRAG__ = {
      ids,
      sourceFolder: folderId || '',
      startedAt: Date.now(),
      lastX: e.clientX,
      lastY: e.clientY,
    };
    if (window.__SNAPLEX_IMAGE_DRAG_OVER__) {
      document.removeEventListener('dragover', window.__SNAPLEX_IMAGE_DRAG_OVER__);
    }
    window.__SNAPLEX_IMAGE_DRAG_OVER__ = (event: DragEvent) => {
      if (!window.__SNAPLEX_IMAGE_DRAG__) return;
      window.__SNAPLEX_IMAGE_DRAG__.lastX = event.clientX;
      window.__SNAPLEX_IMAGE_DRAG__.lastY = event.clientY;
    };
    document.addEventListener('dragover', window.__SNAPLEX_IMAGE_DRAG_OVER__);
    e.dataTransfer.setData('application/snaplex-images', payload);
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', `snaplex-images:${payload}`);
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('application/snaplex-source-folder', folderId || '');

    if (ids.length > 1) {
      const thumbSrc = (e.currentTarget as HTMLElement).querySelector('img')?.getAttribute('src') || '';
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:72px;height:72px;border-radius:10px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.25),0 0 0 2px rgba(255,255,255,0.9);background:#e7e5e4;';
      const img = document.createElement('div');
      img.style.cssText = `width:100%;height:100%;background-image:url("${thumbSrc.replace(/"/g, '\\"')}");background-size:cover;background-position:center;`;
      const badge = document.createElement('span');
      badge.textContent = String(ids.length);
      badge.style.cssText = 'position:absolute;top:-6px;right:-6px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#3b82f6;color:white;font:600 12px/22px -apple-system,system-ui,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(59,130,246,0.5);';
      ghost.appendChild(img);
      ghost.appendChild(badge);
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 36, 36);
      // The browser snapshots the element synchronously for the drag preview,
      // so it's safe to remove on the next tick.
      setTimeout(() => ghost.remove(), 0);
    }
  }, [getTargetImageIds, folderId]);

  const handleDragEnd = useCallback(async (e: React.DragEvent) => {
    const payload = window.__SNAPLEX_IMAGE_DRAG__;
    if (!payload || payload.ids.length === 0) {
      if (window.__SNAPLEX_IMAGE_DRAG_OVER__) {
        document.removeEventListener('dragover', window.__SNAPLEX_IMAGE_DRAG_OVER__);
        delete window.__SNAPLEX_IMAGE_DRAG_OVER__;
      }
      delete window.__SNAPLEX_IMAGE_DRAG__;
      return;
    }

    const pointX = e.clientX || payload.lastX || 0;
    const pointY = e.clientY || payload.lastY || 0;
    const target = document.elementFromPoint(pointX, pointY) as HTMLElement | null;
    const folderEl = target?.closest<HTMLElement>('[data-folder-id]');
    const targetFolderId = folderEl?.dataset.folderId;
    if (!targetFolderId) {
      if (window.__SNAPLEX_IMAGE_DRAG_OVER__) {
        document.removeEventListener('dragover', window.__SNAPLEX_IMAGE_DRAG_OVER__);
        delete window.__SNAPLEX_IMAGE_DRAG_OVER__;
      }
      delete window.__SNAPLEX_IMAGE_DRAG__;
      return;
    }

    const ids = payload.ids;
    const isRemoveToAll = targetFolderId === '__all__';
    const shouldLink = !isRemoveToAll && (!payload.sourceFolder || payload.sourceFolder === '__favorites__' || e.altKey);
    logBatchDebug(`drag-end-folder target=${targetFolderId} ids=${ids.length} source=${payload.sourceFolder || 'none'} link=${shouldLink}`);
    try {
      if (isRemoveToAll) {
        await removeImagesFromFolders(ids);
      } else if (shouldLink) {
        await Promise.all(ids.map(id => linkImageToFolder(id, targetFolderId)));
      } else {
        await moveImages(ids, targetFolderId);
      }
      showToast(`${isRemoveToAll ? 'Removed from folders' : shouldLink ? 'Linked' : 'Moved'} ${ids.length} image${ids.length === 1 ? '' : 's'}`, 'success');
      syncMultiSelected(new Set(), 'clear-drag-end');
      await loadImages();
      onImagesChanged?.();
    } catch (err) {
      showToast(`Drag to folder failed: ${err}`, 'error');
    } finally {
      if (window.__SNAPLEX_IMAGE_DRAG_OVER__) {
        document.removeEventListener('dragover', window.__SNAPLEX_IMAGE_DRAG_OVER__);
        delete window.__SNAPLEX_IMAGE_DRAG_OVER__;
      }
      delete window.__SNAPLEX_IMAGE_DRAG__;
    }
  }, [linkImageToFolder, moveImages, removeImagesFromFolders, loadImages, syncMultiSelected, onImagesChanged]);

  const handleAnalyzePrompt = useCallback(async (imageId: string) => {
    const ids = getTargetImageIds(imageId);
    logBatchDebug(`analyze-menu image=${imageId} ids=${ids.length} selectedRef=${effectiveSelectedIdsRef.current.size}`);

    const settings = await loadUserSettings();
    const provider = getCurrentProvider();
    const model = getCurrentModel();
    const total = ids.length;
    let done = 0;
    let succeeded = 0;
    let failed = 0;

    if (total === 1) {
      showToast('Analyzing prompt...', 'success');
    } else {
      showToast(`Analyzing 0/${total}...`, 'success');
    }

    // Cap concurrency at 2 to be polite to free-tier providers.
    const CONCURRENCY = 2;
    const queue = [...ids];

    const runOne = async (id: string) => {
      try {
        const detail = await getImageDetail(id);
        const filePath = detail.fullUrl?.startsWith('file://') ? detail.fullUrl.slice(7) : detail.fullUrl;
        const assetUrl = filePath ? convertFileSrc(filePath) : '';
        const base64 = await getImageBase64(id, assetUrl);
        const result = await analyzeImage(base64, settings);
        if (!result.description) {
          result.description = result.structuredPrompts?.subject?.original?.slice(0, 120) || '';
        }
        await saveAnalysis(id, result, provider, model);
        // Persist each dimension as version 1 so the initial analysis is preserved
        // across reloads — without this, the first prompt is lost the moment the
        // user refreshes any single dimension later.
        await Promise.all(
          ALL_DIMS.map(d => {
            const seg = result.structuredPrompts?.[d];
            if (!seg) return Promise.resolve();
            return saveDimensionVersion(id, d, seg.original || '', seg.translated || '')
              .catch(err => console.warn(`Failed to persist initial ${d} for ${id}:`, err));
          })
        );
        succeeded += 1;
      } catch (e) {
        failed += 1;
        console.error(`Analyze failed for ${id}:`, e);
      } finally {
        done += 1;
        if (total > 1) {
          showToast(`Analyzing ${done}/${total}...`, 'success');
        }
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (next) await runOne(next);
        }
      })());
    }
    await Promise.all(workers);

    if (failed === 0) {
      showToast(total === 1 ? 'Prompt analyzed' : `Analyzed ${succeeded} image${succeeded === 1 ? '' : 's'}`, 'success');
    } else {
      showToast(`Analyzed ${succeeded}, ${failed} failed`, 'error');
    }
    await loadImages();
  }, [getTargetImageIds, getImageDetail, saveAnalysis, saveDimensionVersion, loadImages]);

  const handleImportXLS = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setLoading(true);
      try {
        const { result } = await importLegacyFile(file);
        showToast(
          t['import.xls.result']
            .replace('{imported}', String(result.imported))
            .replace('{failed}', String(result.failed)),
          result.failed > 0 ? 'error' : 'success'
        );
        await loadImages();
      } catch (err) {
        showToast(`${t['import.xls.failed']}: ${err}`, 'error');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  }, [loadImages]);

  const handleExportAnalysis = useCallback(async () => {
    if (selectedCount === 0) return;
    try {
      const items = await Promise.all(
        Array.from(effectiveSelectedIds).map(async (id) => {
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
  }, [selectedCount, effectiveSelectedIds, getImageDetail]);

  const handleClickUpload = useCallback(async () => {
    try {
      const selected = await openDialog({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }],
      });
      if (!selected || selected.length === 0) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      setLoading(true);
      try {
        await importImages(paths, folderId);
        await loadImages();
      } catch (err) {
        showToast(`Import failed: ${err}`, 'error');
      } finally {
        setLoading(false);
      }
    } catch (err) {
      showToast(`File dialog failed: ${err}`, 'error');
    }
  }, [folderId, importImages, loadImages]);

  return (
    <div className="flex flex-col h-full bg-cream dark:bg-stone-900 transition-colors">
      {/* Search & Toolbar */}
      <div className="flex flex-col border-b border-stone-200 dark:border-stone-800 bg-cream dark:bg-stone-900 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-6 py-3">
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

          <div className="flex-1">
            <SearchBar
              folderId={folderId}
              onSearchResults={handleSearchResults}
              onSearchClear={handleSearchClear}
              onSearching={setIsSearching}
              systemLanguage={systemLanguage}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Grid Size Slider — drives column count. Slider far right (max value)
                = MIN_COLS (largest cards). Each tick adds one column. Inverted with
                MAX_COLS + MIN_COLS - value so right end keeps the bigger-cards icon. */}
            <div className="flex items-center gap-2 group">
              <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              <input
                type="range"
                min={MIN_COLS}
                max={MAX_COLS}
                step={1}
                value={MAX_COLS + MIN_COLS - columnCount}
                onChange={(e) => setColumnCount(MAX_COLS + MIN_COLS - Number(e.target.value))}
                className="w-24 h-1 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                title={`${columnCount} per row`}
              />
              <svg className="w-3 h-3 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
            </div>

            <button
              onClick={handleImportXLS}
              className="p-2 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="Import from XLS"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>

            <div className="w-px h-6 bg-stone-200 dark:border-stone-800" />

            <button
              onClick={onToggleDetail}
              className={`p-2 rounded-lg transition-colors ${isDetailVisible ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
              title="Toggle Detail Panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            </button>
          </div>
        </div>
        
        {/* Batch Action Bar */}
        {isMultiMode && (
          <div className="flex items-center gap-3 px-6 pb-2">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{selectedCount} selected</span>
            <button onClick={handleSelectAll} className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors">Select All</button>
            <button onClick={handleClearSelection} className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors">Clear</button>
            <div className="flex-1" />
            <button
              onClick={handleExportAnalysis}
              className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              Export Analysis
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              Delete Selected
            </button>
          </div>
        )}

        {/* Search Status Bar */}
        {!isMultiMode && (isSearching || searchResultIds !== null) && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-2 px-1 py-1.5 text-xs text-stone-500">
              {isSearching ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Searching...
                </span>
              ) : (
                <span>{searchResultIds?.length || 0} result{(searchResultIds?.length || 0) !== 1 ? 's' : ''} found</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grid Content */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleGridMouseMove}
        onMouseUp={handleGridMouseUp}
        className={`flex-1 overflow-y-auto scroll-smooth relative select-none ${isDragOver ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
      >
        {/* Drop overlay */}
        {isDragOver && (
          <div className="absolute inset-4 border-2 border-dashed border-blue-400 rounded-2xl bg-blue-50/80 dark:bg-blue-900/30 flex items-center justify-center z-20 pointer-events-none">
            <div className="flex flex-col items-center gap-3 text-blue-500">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="font-bold text-lg">{t['grid.dropToImport']}</p>
            </div>
          </div>
        )}

        {loading && images.length === 0 ? (
          <div className="p-6 h-full">
            <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">{t['grid.loading']}</p>
            </div>
          </div>
        ) : images.length === 0 ? (
          <div className="p-6 h-full">
            <div
              onClick={handleClickUpload}
              className="flex flex-col items-center justify-center h-full text-stone-400 gap-5 cursor-pointer transition-opacity hover:opacity-90"
            >
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-mascot/15 bg-cream shadow-pop-sm dark:border-mascot/30 dark:bg-stone-800">
                <Logo variant="mark" size={96} className="drop-shadow-sm" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-mascot">{searchResultIds !== null ? t['grid.empty.noSearchResults'] : t['grid.empty.title']}</p>
                <p className="text-sm">{searchResultIds !== null ? t['grid.empty.noSearchHint'] : t['grid.empty.hint']}</p>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: rowVirtualizer.getTotalSize() + 2 * GRID_PADDING,
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualItems.map(virtualRow => (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: virtualRow.start + GRID_PADDING,
                  left: GRID_PADDING,
                  right: GRID_PADDING,
                  height: cellSize,
                  display: 'grid',
                  // 1fr columns let cards share the full row width evenly, so the
                  // gap between cards and the left/right padding stay uniform.
                  gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                  gap: `${GRID_GAP}px`,
                }}
              >
                {Array.from({ length: columnCount }).map((_, col) => {
                  const idx = virtualRow.index * columnCount + col;
                  const image = images[idx];
                  if (!image) {
                    // Unloaded slot — kept as a placeholder until the next page arrives, so the scrollbar height stays stable
                    return (
                      <div
                        key={`placeholder-${virtualRow.index}-${col}`}
                        className="rounded-xl bg-stone-100/40 dark:bg-stone-800/40"
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
                      onRemoveFromFolder={handleRemoveFromFolder}
                      onAnalyzePrompt={handleAnalyzePrompt}
                      canRemoveFromFolder={!!folderId && folderId !== '__favorites__'}
                      onDragMouseDown={(e) => handleInternalDragMouseDown(image.id, e)}
                      onDragStart={(e) => handleDragStart(image.id, e)}
                      onDragEnd={handleDragEnd}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Rectangle selection overlay */}
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
      </div>

      {internalDrag && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: internalDrag.x + 12, top: internalDrag.y + 12 }}
        >
          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-stone-200 dark:bg-stone-700 shadow-2xl ring-2 ring-white/90">
            {internalDrag.thumbSrc && (
              <img src={internalDrag.thumbSrc} alt="" className="w-full h-full object-cover" draggable={false} />
            )}
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[11px] leading-5 font-bold text-center shadow">
              {internalDrag.ids.length}
            </span>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {moveToFolderTargets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMoveToFolderTargets(null)}>
          <div className="bg-white dark:bg-stone-800 rounded-xl shadow-2xl w-72 max-h-80 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700">
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">
                {moveToFolderTargets.length > 1
                  ? t['moveToFolder.title.many'].replace('{count}', String(moveToFolderTargets.length))
                  : t['moveToFolder.title.one']}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {folderId && folderId !== '__favorites__' && (
                <button
                  onClick={() => confirmMoveToFolder('__all__')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 rounded-md text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
                >
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="truncate">{t['sidebar.allImages']}</span>
                  <span className="ml-auto text-[10px] text-stone-400">{t['moveToFolder.removeFromFolder']}</span>
                </button>
              )}
              {folderList.length === 0 ? (
                <p className="text-xs text-stone-400 px-2 py-4 text-center">{t['moveToFolder.empty']}</p>
              ) : (
                folderList.map(folder => (
                  <FolderPickerItem key={folder.id} folder={folder} onSelect={confirmMoveToFolder} currentFolderId={folderId} />
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-stone-200 dark:border-stone-700">
              <button onClick={() => setMoveToFolderTargets(null)} className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">{t['common.cancel']}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FolderPickerItem: React.FC<{ folder: FolderNode; onSelect: (id: string) => void; currentFolderId?: string; level?: number }> = ({ folder, onSelect, currentFolderId, level = 0 }) => {
  const isCurrent = folder.id === currentFolderId;
  return (
    <>
      <button
        onClick={() => !isCurrent && onSelect(folder.id)}
        disabled={isCurrent}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${isCurrent ? 'text-stone-300 dark:text-stone-600 cursor-not-allowed' : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'}`}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
      >
        <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
        <span className="truncate">{folder.name}</span>
        {isCurrent && <span className="text-[10px] text-stone-400">(current)</span>}
      </button>
      {folder.children?.map(child => (
        <FolderPickerItem key={child.id} folder={child} onSelect={onSelect} currentFolderId={currentFolderId} level={level + 1} />
      ))}
    </>
  );
};

export default ImageGrid;
