import React, { useState, useEffect } from 'react';
import { AnalysisResult, DimensionKey, PromptSegment, UserSettings, DEFAULT_SETTINGS, DimensionHistories } from '@/types';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { analyzeImage, regenerateDimension } from '@/services/geminiService';
import { getCurrentProvider, getCurrentModel } from '@/services/providers/types';
import { getImageBase64 } from '@/utils/imageToBase64';
import { translatePromptDimensions } from '@/services/googleTranslate';
import { get } from 'idb-keyval';

const ALL_DIMS: DimensionKey[] = ['subject', 'environment', 'composition', 'lighting', 'mood', 'style'];

interface DimensionCardsProps {
  imageId: string;
  analysis: AnalysisResult | null;
  image: string; // asset:// URL from convertFileSrc
  onAnalysisComplete?: (analysis: AnalysisResult) => void;
}

const DIMENSIONS: { key: DimensionKey; label: string; color: string; icon: string }[] = [
  { key: 'subject', label: 'Subject', color: 'text-coral', icon: '👤' },
  { key: 'environment', label: 'Environment', color: 'text-mint', icon: '🌍' },
  { key: 'composition', label: 'Composition', color: 'text-softblue', icon: '📐' },
  { key: 'lighting', label: 'Lighting', color: 'text-sunny', icon: '💡' },
  { key: 'mood', label: 'Mood', color: 'text-softblue', icon: '✨' },
  { key: 'style', label: 'Style', color: 'text-stone-500', icon: '🎨' },
];

const DimensionCards: React.FC<DimensionCardsProps> = ({ imageId, analysis, image, onAnalysisComplete }) => {
  const [expandedKey, setExpandedKey] = useState<DimensionKey | null>('subject');
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshingDim, setRefreshingDim] = useState<DimensionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localAnalysis, setLocalAnalysis] = useState<AnalysisResult | null>(null);
  const [dimensionHistories, setDimensionHistories] = useState<DimensionHistories>({});
  const { saveAnalysis, saveDimensionVersion, getDimensionHistory } = useTauriIPC();

  // Reset local state when image changes
  useEffect(() => {
    setLocalAnalysis(null);
    setDimensionHistories({});
  }, [imageId]);

  const currentAnalysis = localAnalysis || analysis;
  const [translating, setTranslating] = useState(false);

  // Load persisted dimension history once analysis is available. Backend returns DESC
  // (newest first); we reverse to ASC so versions[0] is oldest, versions[last] is current.
  // For images analyzed before history-tracking shipped, the DB is empty but the
  // analysis row exists — we backfill that initial version into the DB so it's
  // preserved across reloads going forward.
  useEffect(() => {
    if (!imageId || !currentAnalysis) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          ALL_DIMS.map(d => getDimensionHistory(imageId, d).catch(() => []))
        );
        if (cancelled) return;
        const next: DimensionHistories = {};
        ALL_DIMS.forEach((d, i) => {
          const dbVersions = [...results[i]]
            .reverse()
            .map(v => ({ original: v.original, translated: v.translated }));
          if (dbVersions.length > 0) {
            next[d] = { versions: dbVersions, currentIndex: dbVersions.length - 1 };
            return;
          }
          const seed = currentAnalysis.structuredPrompts?.[d];
          if (seed && (seed.original || seed.translated)) {
            next[d] = { versions: [seed], currentIndex: 0 };
            saveDimensionVersion(imageId, d, seed.original || '', seed.translated || '')
              .catch(err => console.warn(`Backfill ${d} v1 failed:`, err));
          }
        });
        setDimensionHistories(next);
      } catch (e) {
        console.warn('Failed to load dimension histories:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [imageId, currentAnalysis?.description]);

  const getCurrentSegment = (dim: DimensionKey): PromptSegment | null => {
    const h = dimensionHistories[dim];
    if (h && h.versions.length > 0) return h.versions[h.currentIndex];
    return currentAnalysis?.structuredPrompts?.[dim] ?? null;
  };

  // Auto-translate when analysis exists but translations are empty
  useEffect(() => {
    if (!currentAnalysis) return;
    const prompts = currentAnalysis.structuredPrompts;
    const hasUntranslated = Object.values(prompts).some(
      (seg: PromptSegment) => seg.original && !seg.translated
    );
    if (!hasUntranslated) return;

    const doTranslate = async () => {
      setTranslating(true);
      try {
        const settings = await loadSettings();
        const targetLang = settings.cardBackLanguage || 'Chinese';
        const originals: Record<string, string> = {};
        for (const key of Object.keys(prompts)) {
          const seg = prompts[key as DimensionKey];
          if (seg.original && !seg.translated) {
            originals[key] = seg.original;
          }
        }
        if (Object.keys(originals).length === 0) return;
        const translated = await translatePromptDimensions(originals, targetLang);
        // Merge translations into analysis
        const updated = {
          ...currentAnalysis,
          structuredPrompts: { ...currentAnalysis.structuredPrompts },
        };
        for (const [key, val] of Object.entries(translated)) {
          if (val) {
            (updated.structuredPrompts as any)[key] = {
              ...(updated.structuredPrompts as any)[key],
              translated: val,
            };
          }
        }
        setLocalAnalysis(updated);
      } catch (e) {
        console.warn('Auto-translate failed:', e);
      } finally {
        setTranslating(false);
      }
    };
    doTranslate();
  }, [currentAnalysis?.description]); // Only trigger when analysis changes (use description as key)

  const loadSettings = async (): Promise<UserSettings> => {
    try {
      const stored = await get('visionLearnSettings');
      return stored || DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const [settings, base64] = await Promise.all([
        loadSettings(),
        getImageBase64(imageId, image),
      ]);
      const result = await analyzeImage(base64, settings);
      // Ensure description exists (some AI responses omit it)
      if (!result.description) {
        result.description = result.structuredPrompts?.subject?.original?.slice(0, 120) || '';
      }
      const provider = getCurrentProvider();
      const model = getCurrentModel();
      await saveAnalysis(imageId, result, provider, model);
      // Persist each dimension as version 1 so the initial analysis is preserved
      // across reloads (otherwise the very first prompt is lost as soon as the
      // user refreshes any single dimension).
      await Promise.all(
        ALL_DIMS.map(d => {
          const seg = result.structuredPrompts?.[d];
          if (!seg) return Promise.resolve();
          return saveDimensionVersion(imageId, d, seg.original || '', seg.translated || '')
            .catch(err => console.warn(`Failed to persist initial ${d}:`, err));
        })
      );
      setLocalAnalysis(result);
      onAnalysisComplete?.(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      console.error('Analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = async (dim: DimensionKey) => {
    const content = getCurrentSegment(dim);
    if (!content) return;
    const text = content.original + (content.translated ? '\n---\n' + content.translated : '');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const handleRefresh = async (dim: DimensionKey) => {
    setRefreshingDim(dim);
    try {
      const [settings, base64] = await Promise.all([
        loadSettings(),
        getImageBase64(imageId, image),
      ]);
      const result = await regenerateDimension(base64, dim, settings);
      await saveDimensionVersion(imageId, dim, result.original, result.translated);
      // Update local analysis with new dimension
      const updated = currentAnalysis ? {
        ...currentAnalysis,
        structuredPrompts: {
          ...currentAnalysis.structuredPrompts,
          [dim]: result,
        },
      } : null;
      if (updated) {
        setLocalAnalysis(updated);
        onAnalysisComplete?.(updated);
      }
      // Append the new version to history. Functional update so concurrent
      // refreshes on different dims don't clobber each other.
      setDimensionHistories(prev => {
        const existing = prev[dim];
        const versions = existing ? [...existing.versions, result] : [result];
        return { ...prev, [dim]: { versions, currentIndex: versions.length - 1 } };
      });
    } catch (e) {
      console.error(`Refresh ${dim} failed:`, e);
    } finally {
      setRefreshingDim(null);
    }
  };

  const handleNavigateHistory = (dim: DimensionKey, direction: 'prev' | 'next') => {
    setDimensionHistories(prev => {
      const h = prev[dim];
      if (!h) return prev;
      const newIndex = direction === 'prev'
        ? Math.max(0, h.currentIndex - 1)
        : Math.min(h.versions.length - 1, h.currentIndex + 1);
      if (newIndex === h.currentIndex) return prev;
      return { ...prev, [dim]: { ...h, currentIndex: newIndex } };
    });
  };

  if (!currentAnalysis) {
    return (
      <div className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-6 text-center border-2 border-dashed border-stone-200 dark:border-stone-700">
        <p className="text-xs text-stone-400 font-medium">No analysis available for this image</p>
        {error && (
          <p className="mt-2 text-xs text-red-500 font-medium">{error}</p>
        )}
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-bold shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : 'Analyze Now'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {DIMENSIONS.map((dim) => {
        const isExpanded = expandedKey === dim.key;
        const content = getCurrentSegment(dim.key) ?? { original: '', translated: '' };
        const isRefreshing = refreshingDim === dim.key;
        const history = dimensionHistories[dim.key];
        const versions = history?.versions ?? [];
        const currentIndex = history?.currentIndex ?? 0;
        const hasHistory = versions.length > 1;
        const canGoPrev = currentIndex > 0;
        const canGoNext = currentIndex < versions.length - 1;

        return (
          <div
            key={dim.key}
            className={`rounded-2xl border transition-all duration-300 ${isExpanded ? 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 shadow-sm' : 'bg-stone-50/50 dark:bg-stone-900/50 border-transparent hover:border-stone-200 dark:hover:border-stone-800'}`}
          >
            <button
              onClick={() => setExpandedKey(isExpanded ? null : dim.key)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">{dim.icon}</span>
                <span className={`text-[11px] font-black uppercase tracking-widest ${dim.color}`}>{dim.label}</span>
                {hasHistory && (
                  <span className="text-[10px] text-stone-400 font-mono tabular-nums">
                    {currentIndex + 1}/{versions.length}
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-stone-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 animate-[fadeIn_0.2s]">
                <div className="p-4 bg-stone-50 dark:bg-stone-900/50 rounded-xl space-y-3">
                  {isRefreshing ? (
                    <div className="flex items-center justify-center py-4">
                      <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
                        {content.original}
                      </div>
                      {content.translated ? (
                        <>
                          <div className="h-px bg-stone-200 dark:bg-stone-800" />
                          <div className="text-sm text-stone-500 dark:text-stone-400 italic">
                            {content.translated}
                          </div>
                        </>
                      ) : translating ? (
                        <div className="text-xs text-stone-400 italic">Translating...</div>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="flex justify-end items-center gap-2 mt-3">
                  {hasHistory && (
                    <>
                      <button
                        onClick={() => handleNavigateHistory(dim.key, 'prev')}
                        disabled={!canGoPrev}
                        title="Previous version"
                        className="p-2 text-stone-300 hover:text-stone-500 dark:hover:text-stone-400 transition-colors disabled:opacity-30 disabled:hover:text-stone-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleNavigateHistory(dim.key, 'next')}
                        disabled={!canGoNext}
                        title="Next version"
                        className="p-2 text-stone-300 hover:text-stone-500 dark:hover:text-stone-400 transition-colors disabled:opacity-30 disabled:hover:text-stone-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopy(dim.key)}
                    title="Copy to clipboard"
                    className="p-2 text-stone-300 hover:text-stone-500 dark:hover:text-stone-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                  {/* Refresh button */}
                  <button
                    onClick={() => handleRefresh(dim.key)}
                    disabled={isRefreshing}
                    title="Regenerate this dimension"
                    className="p-2 text-stone-300 hover:text-stone-500 dark:hover:text-stone-400 transition-colors disabled:opacity-50"
                  >
                    <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DimensionCards;
