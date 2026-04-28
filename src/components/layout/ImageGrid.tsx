import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { ImageItem, FolderNode } from '@/types';
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

interface ImageGridProps {
  folderId?: string;
  selectedImageId?: string;
  onImageSelect: (imageId: string | undefined) => void;
  onToggleDetail: () => void;
  isDetailVisible: boolean;
  nav?: { goBack: () => void; goForward: () => void; canGoBack: boolean; canGoForward: boolean };
  refreshTrigger?: number;
}

const ImageGrid: React.FC<ImageGridProps> = ({
  folderId,
  selectedImageId,
  onImageSelect,
  onToggleDetail,
  isDetailVisible,
  nav,
  refreshTrigger
}) => {
  const { getImages, getImageDetail, getImagesByIds, importImages, deleteImages, toggleFavorite, openImageInFinder, moveImages, getFolderTree } = useTauriIPC();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [gridSize, setGridSize] = useState(200);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [moveToFolderTarget, setMoveToFolderTarget] = useState<string | null>(null);
  const [folderList, setFolderList] = useState<FolderNode[]>([]);
  const [rectSelect, setRectSelect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const importingRef = useRef(false);
  const dropPathsRef = useRef<Set<string>>(new Set());
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { columnCount, rowHeight } = useGridDimensions(scrollContainerRef, gridSize);
  const rowCount = Math.ceil(images.length / Math.max(1, columnCount));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });

  const isMultiMode = multiSelected.size > 0;

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getImages(folderId);
      setImages(result);
    } catch (err) {
      showToast(`Failed to load images: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [folderId, getImages]);

  useEffect(() => {
    if (searchResultIds === null) {
      loadImages();
    }
  }, [folderId, searchResultIds, loadImages, refreshTrigger]);

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

    const setupDragDrop = async () => {
      try {
        const webview = getCurrentWebviewWindow();
        unlisten = await webview.onDragDropEvent(async (event) => {
          if (event.payload.type === 'over') {
            setIsDragOver(true);
          } else if (event.payload.type === 'drop') {
            setIsDragOver(false);
            // Collect paths from potentially multiple drop events
            const paths = event.payload.paths;
            const imagePaths = paths.filter((p: string) =>
              /\.(png|jpe?g|gif|webp|bmp|svg|tiff?)$/i.test(p)
            );
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
          } else if (event.payload.type === 'cancel') {
            setIsDragOver(false);
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
    if (e && (e.metaKey || e.ctrlKey)) {
      // Cmd/Ctrl+click: toggle multi-select
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    if (e && e.shiftKey && selectedImageId) {
      // Shift+click: range select
      const startIdx = images.findIndex(img => img.id === selectedImageId);
      const endIdx = images.findIndex(img => img.id === id);
      if (startIdx >= 0 && endIdx >= 0) {
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = images.slice(lo, hi + 1).map(img => img.id);
        setMultiSelected(new Set(rangeIds));
        return;
      }
    }
    // Normal click: single select
    if (isMultiMode) {
      setMultiSelected(new Set());
    }
    onImageSelect(id);
  }, [images, selectedImageId, isMultiMode, onImageSelect]);

  const handleBatchDelete = useCallback(async () => {
    if (multiSelected.size === 0) return;
    try {
      await deleteImages(Array.from(multiSelected));
      setImages(prev => prev.filter(img => !multiSelected.has(img.id)));
      if (selectedImageId && multiSelected.has(selectedImageId)) onImageSelect(undefined);
      showToast(`Deleted ${multiSelected.size} image(s)`, 'success');
      setMultiSelected(new Set());
    } catch (err) {
      showToast(`Failed to delete: ${err}`, 'error');
    }
  }, [multiSelected, deleteImages, selectedImageId, onImageSelect]);

  const handleSelectAll = useCallback(() => {
    setMultiSelected(new Set(images.map(img => img.id)));
  }, [images]);

  const handleClearSelection = useCallback(() => {
    setMultiSelected(new Set());
  }, []);

  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      await toggleFavorite(id);
      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, isFavorite: !img.isFavorite } : img
      ));
    } catch (err) {
      showToast(`Failed to toggle favorite: ${err}`, 'error');
    }
  }, [toggleFavorite]);

  const handleDeleteImage = useCallback(async (id: string) => {
    try {
      await deleteImages([id]);
      setImages(prev => prev.filter(img => img.id !== id));
      if (selectedImageId === id) onImageSelect(undefined);
    } catch (err) {
      showToast(`Failed to delete image: ${err}`, 'error');
    }
  }, [deleteImages, selectedImageId, onImageSelect]);

  const handleOpenInFinder = useCallback(async (id: string) => {
    try {
      await openImageInFinder(id);
    } catch (err) {
      showToast(`Failed to open in Finder: ${err}`, 'error');
    }
  }, [openImageInFinder]);

  const handleMoveToFolder = useCallback(async (imageId: string) => {
    setMoveToFolderTarget(imageId);
    try {
      const tree = await getFolderTree();
      setFolderList(tree);
    } catch (err) {
      showToast(`Failed to load folders: ${err}`, 'error');
    }
  }, [getFolderTree]);

  const confirmMoveToFolder = useCallback(async (targetFolderId: string) => {
    if (!moveToFolderTarget) return;
    try {
      await moveImages([moveToFolderTarget], targetFolderId);
      showToast('Image moved', 'success');
      await loadImages();
    } catch (err) {
      showToast(`Move failed: ${err}`, 'error');
    }
    setMoveToFolderTarget(null);
    setFolderList([]);
  }, [moveToFolderTarget, moveImages, loadImages]);

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

    const selected = new Set<string>();
    for (let i = 0; i < images.length; i++) {
      const r = cardRectAtIndex(i, Math.max(1, columnCount), gridSize, GRID_GAP, GRID_PADDING, GRID_PADDING);
      if (rectsIntersect(selRect, r)) {
        selected.add(images[i].id);
      }
    }
    setMultiSelected(selected);
  }, [rectSelect, images, columnCount, gridSize]);

  const handleGridMouseUp = useCallback(() => {
    setRectSelect(null);
  }, []);

  // Drag-to-folder: set drag data with selected image IDs and source folder
  const handleDragStart = useCallback((imageId: string, e: React.DragEvent) => {
    const ids = multiSelected.size > 0 && multiSelected.has(imageId)
      ? Array.from(multiSelected)
      : [imageId];
    e.dataTransfer.setData('application/snaplex-images', JSON.stringify(ids));
    e.dataTransfer.setData('text/plain', `${ids.length} image(s)`);
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('application/snaplex-source-folder', folderId || '');
  }, [multiSelected, folderId]);

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
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Grid Size Slider */}
            <div className="flex items-center gap-2 group">
              <svg className="w-3 h-3 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
              <input 
                type="range" 
                min="100" 
                max="400" 
                step="20"
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                className="w-24 h-1 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
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
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{multiSelected.size} selected</span>
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
              <p className="font-bold text-lg">Drop images here to import</p>
            </div>
          </div>
        )}

        {loading && images.length === 0 ? (
          <div className="p-6 h-full">
            <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading...</p>
            </div>
          </div>
        ) : images.length === 0 ? (
          <div className="p-6 h-full">
            <div
              onClick={handleClickUpload}
              className="flex flex-col items-center justify-center h-full text-stone-400 gap-4 opacity-60 hover:opacity-80 cursor-pointer transition-opacity"
            >
              <div className="p-6 bg-stone-50 dark:bg-stone-800/50 rounded-3xl">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{searchResultIds !== null ? 'No results match your search' : 'No images found'}</p>
                <p className="text-sm">{searchResultIds !== null ? 'Try different keywords or filters' : 'Drag & drop images or click to import'}</p>
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

      {/* Move to Folder Modal */}
      {moveToFolderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMoveToFolderTarget(null)}>
          <div className="bg-white dark:bg-stone-800 rounded-xl shadow-2xl w-72 max-h-80 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700">
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">Move to Folder</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {folderList.length === 0 ? (
                <p className="text-xs text-stone-400 px-2 py-4 text-center">No folders available</p>
              ) : (
                folderList.map(folder => (
                  <FolderPickerItem key={folder.id} folder={folder} onSelect={confirmMoveToFolder} currentFolderId={folderId} />
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-stone-200 dark:border-stone-700">
              <button onClick={() => setMoveToFolderTarget(null)} className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">Cancel</button>
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
