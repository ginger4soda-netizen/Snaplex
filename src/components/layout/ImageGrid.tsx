import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { ImageItem } from '@/types';
import ImageCard from '../images/ImageCard';
import SearchBar from '../search/SearchBar';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { showToast } from '@/hooks/useToast';

interface ImageGridProps {
  folderId?: string;
  selectedImageId?: string;
  onImageSelect: (imageId: string | undefined) => void;
  onToggleDetail: () => void;
  isDetailVisible: boolean;
}

const ImageGrid: React.FC<ImageGridProps> = ({
  folderId,
  selectedImageId,
  onImageSelect,
  onToggleDetail,
  isDetailVisible
}) => {
  const { getImages, getImageDetail, importImages, deleteImages, toggleFavorite, openImageInFinder } = useTauriIPC();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [gridSize, setGridSize] = useState(200);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const importingRef = useRef(false);
  const dropPathsRef = useRef<Set<string>>(new Set());
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [folderId, searchResultIds, loadImages]);

  const handleSearchResults = async (ids: string[]) => {
    setSearchResultIds(ids);
    if (ids.length > 0) {
      setLoading(true);
      try {
        // Fetch full ImageItem details for search results
        // In a real implementation, the search IPC might return ImageItem[] directly
        // For now, we fetch them individually or use a batch command if available
        const items = await Promise.all(ids.slice(0, 100).map(async (id) => {
          try {
            const detail = await getImageDetail(id);
            return detail as ImageItem;
          } catch (e) {
            return null;
          }
        }));
        setImages(items.filter((item): item is ImageItem => item !== null));
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
    <div className="flex flex-col h-full bg-stone-50 dark:bg-stone-900 transition-colors">
      {/* Search & Toolbar */}
      <div className="flex flex-col border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-6 py-3">
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
        className={`flex-1 overflow-y-auto p-6 scroll-smooth relative ${isDragOver ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
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
          <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Loading...</p>
          </div>
        ) : images.length === 0 ? (
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
        ) : (
          <div 
            className="grid gap-6 auto-rows-max"
            style={{ 
              gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))` 
            }}
          >
            {images.map(image => (
              <ImageCard
                key={image.id}
                image={image}
                isSelected={selectedImageId === image.id || multiSelected.has(image.id)}
                onClick={(e) => handleImageClick(image.id, e)}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDeleteImage}
                onOpenInFinder={handleOpenInFinder}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGrid;
