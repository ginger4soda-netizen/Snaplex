import React, { useState } from 'react';
import { AnalysisResult, DimensionKey, PromptSegment } from '@/types';
import { useTauriIPC } from '@/hooks/useTauriIPC';

interface DimensionCardsProps {
  imageId: string;
  analysis: AnalysisResult | null;
  image: string;
}

const DIMENSIONS: { key: DimensionKey; label: string; color: string; icon: string }[] = [
  { key: 'subject', label: 'Subject', color: 'text-coral', icon: '👤' },
  { key: 'environment', label: 'Environment', color: 'text-mint', icon: '🌍' },
  { key: 'composition', label: 'Composition', color: 'text-softblue', icon: '📐' },
  { key: 'lighting', label: 'Lighting', color: 'text-sunny', icon: '💡' },
  { key: 'mood', label: 'Mood', color: 'text-softblue', icon: '✨' },
  { key: 'style', label: 'Style', color: 'text-stone-500', icon: '🎨' },
];

const DimensionCards: React.FC<DimensionCardsProps> = ({ imageId, analysis, image }) => {
  const [expandedKey, setExpandedKey] = useState<DimensionKey | null>('subject');
  const { saveDimensionVersion } = useTauriIPC();

  if (!analysis) {
    return (
      <div className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-6 text-center border-2 border-dashed border-stone-200 dark:border-stone-700">
        <p className="text-xs text-stone-400 font-medium">No analysis available for this image</p>
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-bold shadow-md hover:bg-blue-700 transition-all">
          Analyze Now
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {DIMENSIONS.map((dim) => {
        const isExpanded = expandedKey === dim.key;
        const content = analysis.structuredPrompts[dim.key];

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
                  <div className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
                    {content.original}
                  </div>
                  <div className="h-px bg-stone-200 dark:bg-stone-800" />
                  <div className="text-sm text-stone-500 dark:text-stone-400 italic">
                    {content.translated}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-3">
                  <button className="p-2 text-stone-300 hover:text-stone-500 dark:hover:text-stone-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                  <button className="p-2 text-stone-300 hover:text-stone-500 dark:hover:text-stone-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
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
