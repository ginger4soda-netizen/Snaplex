import React, { useState, useEffect, useCallback } from 'react';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { ImageDetail, AnalysisResult } from '@/types';
import ImagePreview from './ImagePreview';
import ColorPalette from './ColorPalette';
import DimensionCards from './DimensionCards';
import MemoCard from './MemoCard';
import ChatPanel from './ChatPanel';
import { convertFileSrc } from '@tauri-apps/api/core';
import { extractColors, ExtractedColor } from '@/utils/colorExtract';

// Module-level cache keyed by "imageId:colorCount"
const colorCache = new Map<string, ExtractedColor[]>();

interface DetailPanelProps {
  imageId?: string;
  onClose: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ imageId, onClose }) => {
  const { getImageDetail, updateImageMemo, getColorPalette, saveColorPalette } = useTauriIPC();
  const [detail, setDetail] = useState<ImageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'chat'>('info');
  const [colorCount, setColorCount] = useState(8);

  useEffect(() => {
    if (!imageId) {
      setDetail(null);
      return;
    }

    // Clear stale detail immediately so Info tab shows loading, not the previous image's data
    setDetail(null);
    setLoading(true);

    let cancelled = false;
    const loadDetail = async () => {
      try {
        const result = await getImageDetail(imageId);
        if (!cancelled) setDetail(result);
      } catch (err) {
        console.error("Failed to load image detail", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadDetail();

    return () => { cancelled = true; };
  }, [imageId]);

  // Helper to resolve asset URL
  const resolveAssetUrl = useCallback((url: string) => {
    if (url.startsWith('asset://')) return url;
    return convertFileSrc(url.startsWith('file://') ? url.slice(7) : url);
  }, []);

  // Debounced color count — prevents rapid k-means extractions while dragging the slider
  const [debouncedColorCount, setDebouncedColorCount] = useState(colorCount);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedColorCount(colorCount), 300);
    return () => clearTimeout(timer);
  }, [colorCount]);

  // Extract colors when image loads or debounced colorCount changes (uses session cache + DB)
  // NOTE: This hook must be BEFORE any conditional returns to satisfy React's Rules of Hooks
  useEffect(() => {
    if (!detail) return;
    const id = detail.id;
    const cacheKey = `${id}:${debouncedColorCount}`;
    let cancelled = false;

    // Check session cache first
    const cached = colorCache.get(cacheKey);
    if (cached) {
      setDetail(prev => prev && prev.id === id ? { ...prev, colorPalette: cached } : prev);
      return;
    }

    // For default count (8), try loading from DB first
    if (debouncedColorCount === 8) {
      getColorPalette(id).then(dbColors => {
        if (cancelled) return;
        if (dbColors && dbColors.length > 0) {
          colorCache.set(cacheKey, dbColors);
          setDetail(prev => prev && prev.id === id ? { ...prev, colorPalette: dbColors } : prev);
          return;
        }
        doExtract();
      }).catch(() => { if (!cancelled) doExtract(); });
    } else {
      doExtract();
    }

    function doExtract() {
      const url = detail.fullUrl;
      if (!url) return;
      extractColors(resolveAssetUrl(url), debouncedColorCount).then(colors => {
        if (cancelled) return;
        colorCache.set(cacheKey, colors);
        setDetail(prev => prev && prev.id === id ? { ...prev, colorPalette: colors } : prev);
        // Only persist the default 8-color palette to DB
        if (debouncedColorCount === 8) {
          saveColorPalette(id, colors).catch(err =>
            console.warn('Failed to save color palette:', err)
          );
        }
      }).catch(err => {
        if (!cancelled) console.warn('Color extraction failed:', err);
      });
    }

    return () => { cancelled = true; };
  }, [detail?.id, debouncedColorCount]);

  const handleColorCountChange = useCallback((count: number) => {
    setColorCount(count);
  }, []);

  const handleMemoChange = async (memo: string) => {
    if (!imageId) return;
    try {
      await updateImageMemo(imageId, memo);
      setDetail(prev => prev ? { ...prev, memo } : null);
    } catch (err) {
      console.error("Failed to update memo", err);
    }
  };

  if (!imageId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-stone-400 p-8 text-center gap-4 opacity-50">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-sm font-medium leading-relaxed">Select an image to view<br/>details and analysis</p>
      </div>
    );
  }

  if (loading && !detail) {
    return (
      <div className="h-full flex items-center justify-center text-stone-400">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) return null;

  const fullUrl = (() => {
    const url = detail.fullUrl;
    if (!url) return '';
    if (url.startsWith('asset://')) return url;
    const filePath = url.startsWith('file://') ? url.slice(7) : url;
    return convertFileSrc(filePath);
  })();

  return (
    <div className="h-full flex flex-col bg-stone-50 dark:bg-stone-900 transition-colors">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800 shrink-0">
        <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('info')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'info' ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
          >
            Info
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'chat' ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
          >
            Chat
          </button>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Image always visible at top */}
      <div className="shrink-0">
        <ImagePreview src={fullUrl} filename={detail.filename} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'info' ? (
          <div className="px-5 py-6 space-y-8 pb-12">
            <ColorPalette colors={detail.colorPalette} colorCount={colorCount} onColorCountChange={handleColorCountChange} />

            {detail.sourceUrl && (
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Source</h3>
                <a href={detail.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                  {detail.sourceUrl}
                </a>
              </section>
            )}

            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">Prompt</h3>
              <DimensionCards
                imageId={detail.id}
                analysis={detail.analysis}
                image={fullUrl}
                onAnalysisComplete={(analysis) => {
                  setDetail(prev => prev ? { ...prev, analysis, hasAnalysis: true } : null);
                }}
              />
            </section>

            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Notes</h3>
              <MemoCard
                memo={detail.memo}
                onMemoChange={handleMemoChange}
              />
            </section>
          </div>
        ) : (
          <ChatPanel imageId={detail.id} image={fullUrl} />
        )}
      </div>
    </div>
  );
};

export default DetailPanel;
