import React, { useState, useEffect } from 'react';
import { useTauriIPC } from '@/hooks/useTauriIPC';
import { ImageDetail, AnalysisResult } from '@/types';
import ImagePreview from './ImagePreview';
import ColorPalette from './ColorPalette';
import DimensionCards from './DimensionCards';
import MemoCard from './MemoCard';
import ChatPanel from './ChatPanel';
import { convertFileSrc } from '@tauri-apps/api/core';

interface DetailPanelProps {
  imageId?: string;
  onClose: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ imageId, onClose }) => {
  const { getImageDetail, updateImageMemo } = useTauriIPC();
  const [detail, setDetail] = useState<ImageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'chat'>('info');

  useEffect(() => {
    if (!imageId) {
      setDetail(null);
      return;
    }

    const loadDetail = async () => {
      setLoading(true);
      try {
        const result = await getImageDetail(imageId);
        setDetail(result);
      } catch (err) {
        console.error("Failed to load image detail", err);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [imageId]);

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
    const filePath = url.startsWith('file://') ? url.slice(7) : url;
    return convertFileSrc(filePath);
  })();

  return (
    <div className="h-full flex flex-col bg-white dark:bg-stone-900 transition-colors">
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

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'info' ? (
          <div className="flex flex-col">
            <ImagePreview src={fullUrl} filename={detail.filename} />
            
            <div className="px-5 py-6 space-y-8 pb-12">
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Color Palette</h3>
                <ColorPalette colors={detail.colorPalette} />
              </section>

              {detail.sourceUrl && (
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Source</h3>
                  <a href={detail.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                    {detail.sourceUrl}
                  </a>
                </section>
              )}

              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">AI Analysis</h3>
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
          </div>
        ) : (
          <ChatPanel imageId={detail.id} image={fullUrl} />
        )}
      </div>
    </div>
  );
};

export default DetailPanel;
