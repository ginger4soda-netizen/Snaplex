import React, { useState } from 'react';
import { AnalysisResult, DimensionKey, PromptSegment, UserSettings, DEFAULT_SETTINGS } from '@/types';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { analyzeImage, regenerateDimension } from '@/services/geminiService';
import { getCurrentProvider, getCurrentModel } from '@/services/providers/types';
import { imageUrlToBase64 } from '@/utils/imageToBase64';
import { get } from 'idb-keyval';

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
  const { saveAnalysis, saveDimensionVersion } = useTauriIPC();

  const currentAnalysis = localAnalysis || analysis;

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
        imageUrlToBase64(image),
      ]);
      const result = await analyzeImage(base64, settings);
      const provider = getCurrentProvider();
      const model = getCurrentModel();
      await saveAnalysis(imageId, result, provider, model);
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
    if (!currentAnalysis) return;
    const content = currentAnalysis.structuredPrompts[dim];
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
        imageUrlToBase64(image),
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
    } catch (e) {
      console.error(`Refresh ${dim} failed:`, e);
    } finally {
      setRefreshingDim(null);
    }
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
        const content = currentAnalysis.structuredPrompts[dim.key];
        const isRefreshing = refreshingDim === dim.key;

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
                      {content.translated && (
                        <>
                          <div className="h-px bg-stone-200 dark:bg-stone-800" />
                          <div className="text-sm text-stone-500 dark:text-stone-400 italic">
                            {content.translated}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-3">
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
