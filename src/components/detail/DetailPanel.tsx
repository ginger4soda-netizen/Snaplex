import React, { useState, useEffect, useCallback } from 'react';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { ImageDetail, DimensionKey, DEFAULT_SETTINGS, ImageSource } from '@/types';
import ImagePreview from './ImagePreview';
import ColorPalette from './ColorPalette';
import DimensionCards from './DimensionCards';
import MemoCard from './MemoCard';
import ChatPanel from './ChatPanel';
import { convertFileSrc } from '@tauri-apps/api/core';
import { extractColors, ExtractedColor } from '@/utils/colorExtract';
import { getCorrectDisplayOrder } from '@/utils/languageDetect';
import { copyToClipboard } from '@/utils/clipboard';
import { showToast } from '@/hooks/useToast';
import { analyzeManager } from '@/utils/analyzeManager';
import { get } from 'idb-keyval';
import { getTranslation } from '@/translations';
import { dedupSources } from '@/utils/dedupSources';
import { handleExternalLinkClick } from '@/utils/openExternal';

// Labels here feed the structured-prompt copy template (`[label]` blocks are
// kept English so generated prompts stay portable across providers). The
// on-screen dimension labels are translated separately via `t['prompt.section.*']`.
const PROMPT_DIMS: { key: DimensionKey; label: string }[] = [
  { key: 'subject', label: 'Subject' },
  { key: 'environment', label: 'Environment' },
  { key: 'composition', label: 'Composition' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'mood', label: 'Mood' },
  { key: 'style', label: 'Style' },
];

// Module-level cache keyed by "imageId:colorCount"
const colorCache = new Map<string, ExtractedColor[]>();

interface DetailPanelProps {
  imageId?: string;
  onClose: () => void;
  systemLanguage?: string;
  onAnalysisChanged?: (imageId: string) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ imageId, onClose, systemLanguage, onAnalysisChanged }) => {
  const { getImageDetail, getImageSources, updateImageMemo, getColorPalette, saveColorPalette } = useTauriIPC();
  const t = getTranslation(systemLanguage);
  const captureTypeLabels: Record<string, string> = {
    image: t['captureType.image'],
    screenshot_visible: t['captureType.screenshotVisible'],
    screenshot_region: t['captureType.screenshotRegion'],
    video_frame: t['captureType.videoFrame'],
  };
  const [detail, setDetail] = useState<ImageDetail | null>(null);
  const [imageSources, setImageSources] = useState<ImageSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'chat'>('info');
  const [colorCount, setColorCount] = useState(8);

  useEffect(() => {
    if (!imageId) {
      setDetail(null);
      setImageSources([]);
      return;
    }

    // Clear stale detail immediately so Info tab shows loading, not the previous image's data
    setDetail(null);
    setImageSources([]);
    setLoading(true);

    let cancelled = false;
    const loadDetail = async () => {
      try {
        const result = await getImageDetail(imageId);
        if (!cancelled) setDetail(result);
      } catch (err) {
        console.error("Failed to load image detail", err);
      }

      try {
        const sources = await getImageSources(imageId);
        if (!cancelled) setImageSources(dedupSources(sources));
      } catch (err) {
        console.error("Failed to load image sources", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadDetail();

    return () => { cancelled = true; };
  }, [imageId]);

  // Re-fetch detail whenever a background analysis completes for the image
  // currently on screen. This closes the race where the runner finishes
  // saving to the DB after DetailPanel has already loaded `detail` (without
  // analysis) — without this, returning from another image during in-flight
  // analyze can briefly show "Analyze prompt" again after the spinner clears.
  useEffect(() => {
    if (!imageId) return;
    return analyzeManager.subscribe(({ imageId: changedId, state }) => {
      if (state !== 'completed' || changedId !== imageId) return;
      getImageDetail(imageId)
        .then(result => {
          setDetail(prev => prev && prev.id === imageId ? result : prev);
        })
        .catch(err => console.warn('Refetch after analyze failed:', err));
    });
  }, [imageId, getImageDetail]);

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

  const formatCapturedAt = useCallback((capturedAt: string) => {
    const date = new Date(capturedAt);
    if (Number.isNaN(date.getTime())) return capturedAt;
    return date.toLocaleString();
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

  const [promptCopied, setPromptCopied] = useState(false);
  const handleCopyAllPrompts = useCallback(async () => {
    if (!detail?.analysis) return;
    let systemLang = 'English';
    let copyIncludedModules = DEFAULT_SETTINGS.copyIncludedModules || [];
    try {
      const stored = await get('visionLearnSettings');
      systemLang = (stored && stored.systemLanguage) || DEFAULT_SETTINGS.systemLanguage || 'English';
      copyIncludedModules = (stored && stored.copyIncludedModules) || copyIncludedModules;
    } catch {
      systemLang = DEFAULT_SETTINGS.systemLanguage || 'English';
    }
    const allowedModules = copyIncludedModules.map((m: string) => m.toLowerCase());
    const parts: string[] = [];
    for (const { key, label } of PROMPT_DIMS) {
      if (allowedModules.length > 0 && !allowedModules.includes(label.toLowerCase())) continue;
      const seg = detail.analysis.structuredPrompts?.[key];
      if (!seg) continue;
      const { front } = getCorrectDisplayOrder(seg.original || '', seg.translated || '', systemLang);
      const text = (front || '').trim();
      if (!text) continue;
      parts.push(`[${label}]\n${text}`);
    }
    if (parts.length === 0) return;
    const ok = await copyToClipboard(parts.join('\n\n'));
    if (ok) {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
    } else {
      showToast('Copy failed', 'error');
    }
  }, [detail?.analysis]);

  if (!imageId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-stone-400 p-8 text-center gap-4 opacity-50">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-sm font-medium leading-relaxed whitespace-pre-line">{t['detail.empty']}</p>
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
            {t['detail.tab.info']}
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'chat' ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
          >
            {t['detail.tab.chat']}
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

            {(imageSources.length > 0 || detail.sourceUrl) && (
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">{t['detail.section.sources']}</h3>
                {imageSources.length > 0 ? (
                  <div className="space-y-3">
                    {imageSources.map((source) => {
                      const primaryUrl = source.pageUrl || source.sourceUrl;
                      const title = source.pageTitle || source.sourceDomain || primaryUrl || t['detail.capturedSource'];
                      const sourceUrl = source.sourceUrl && source.sourceUrl !== primaryUrl ? source.sourceUrl : null;

                      return (
                        <div key={source.id} className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950/40 p-3">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                              {captureTypeLabels[source.captureType] || source.captureType}
                            </span>
                            <span className="text-[10px] font-bold text-stone-400 whitespace-nowrap">
                              {formatCapturedAt(source.capturedAt)}
                            </span>
                          </div>
                          {primaryUrl ? (
                            <a
                              href={primaryUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => handleExternalLinkClick(event, primaryUrl)}
                              className="text-xs font-bold text-blue-500 hover:underline truncate block"
                            >
                              {title}
                            </a>
                          ) : (
                            <p className="text-xs font-bold text-stone-500 truncate">{title}</p>
                          )}
                          {sourceUrl && (
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => handleExternalLinkClick(event, sourceUrl)}
                              className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 hover:underline truncate block"
                            >
                              {sourceUrl}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : detail.sourceUrl ? (
                  <a
                    href={detail.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => handleExternalLinkClick(event, detail.sourceUrl)}
                    className="text-xs text-blue-500 hover:underline truncate block"
                  >
                    {detail.sourceUrl}
                  </a>
                ) : null}
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t['detail.section.prompt']}</h3>
                {detail.analysis && (
                  <button
                    onClick={handleCopyAllPrompts}
                    title={t['detail.copyAllPrompts']}
                    className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    {promptCopied ? (
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <DimensionCards
                imageId={detail.id}
                analysis={detail.analysis}
                image={fullUrl}
                systemLanguage={systemLanguage}
                onAnalysisComplete={(completedId, analysis) => {
                  // Only refresh the visible Info panel if the completed
                  // analysis belongs to the image still being shown.
                  setDetail(prev => prev && prev.id === completedId
                    ? { ...prev, analysis, hasAnalysis: true }
                    : prev
                  );
                  onAnalysisChanged?.(completedId);
                }}
              />
            </section>

            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">{t['detail.section.notes']}</h3>
              <MemoCard
                memo={detail.memo}
                onMemoChange={handleMemoChange}
                systemLanguage={systemLanguage}
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
