import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { mineHistory, MiningResult } from '../utils/historyMiner';
import { explainVisualTerm, TermExplanation } from '../services/geminiService';
import { HistoryItem } from '../types';
import { playSound, startPrintSound } from '../utils/sound';
import { AESTHETIC_TERMS } from '../data/aestheticTerms';
import { getTranslation } from '../translations';

interface Props {
  systemLanguage?: string;
  mode?: 'analysis' | 'standalone';
  isFinished?: boolean;
  onViewResult?: () => void;
  preFetchedTerm?: MiningResult | null;
  preFetchedExplanation?: TermExplanation | null;
}

const StylePrinter: React.FC<Props> = ({
  systemLanguage = 'English',
  mode = 'analysis',
  isFinished = false,
  onViewResult,
  preFetchedTerm,
  preFetchedExplanation
}) => {
  const [queue, setQueue] = useState<MiningResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentExplanation, setCurrentExplanation] = useState<TermExplanation | null>(null);
  const [imageCursor, setImageCursor] = useState(0);

  const [isPrinting, setIsPrinting] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  // In standalone mode, start with isAiLoading=false since we don't auto-load AI
  const [isAiLoading, setIsAiLoading] = useState(mode === 'analysis');
  const [printedVisual, setPrintedVisual] = useState<React.ReactNode>(null);

  const [favorites, setFavorites] = useState<any[]>([]);

  // AbortController ref for cancelling AI requests in standalone mode
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper function to get localized category label
  const getCategoryLabel = (category: string): string => {
    const t = getTranslation(systemLanguage);
    const categoryMap: Record<string, string> = {
      'Style': t.categoryStyle || 'STYLE',
      'Lighting': t.categoryLighting || 'LIGHTING',
      'Composition': t.categoryComposition || 'COMPOSITION',
      'Mood': t.categoryMood || 'MOOD',
    };
    return categoryMap[category] || category;
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const historyItems = (await get('visionLearnHistory')) || [];

        // For standalone mode, try to restore saved queue first
        if (mode === 'standalone') {
          const savedQueue = await get('printer_saved_queue');
          const savedTerm = await get('printer_current_term');
          const savedHistoryLength = await get('printer_history_length');

          // Use saved queue if history hasn't changed
          if (savedQueue && savedQueue.length > 0 && savedHistoryLength === historyItems.length) {
            setQueue(savedQueue);
            if (savedTerm) {
              const idx = savedQueue.findIndex((q: any) => q.term === savedTerm);
              if (idx !== -1) {
                setCurrentIndex(idx);
              }
            }
            await loadFavoritesForDisplay();
            return; // Early return, use saved queue
          }
        }

        // Create new queue (either analysis mode or first time/history changed in standalone)
        const minedResults = mineHistory(historyItems);

        // 确保有足够的项，如果历史不足则补齐预设
        const langPrefix = systemLanguage.split(' ')[0];
        const presets = AESTHETIC_TERMS.map(t => {
          const content = t.languages[langPrefix] || t.languages['English'] || Object.values(t.languages)[0];
          return {
            term: content.term,
            category: t.category,
            images: [],
            isPreset: true,
            presetId: t.id
          };
        });

        const finalQueue = [...minedResults];
        presets.forEach(p => {
          if (!finalQueue.find(q => q.term === p.term)) finalQueue.push(p);
        });

        setQueue(finalQueue);

        // Save queue for standalone mode
        if (mode === 'standalone') {
          await set('printer_saved_queue', finalQueue);
          await set('printer_history_length', historyItems.length);
          // Reset to first term when queue changes
          if (finalQueue.length > 0) {
            await set('printer_current_term', finalQueue[0].term);
          }
        }

        if (mode === 'analysis') {
          if (finalQueue.length > 0) loadTermExplanation(finalQueue[0]);
        }
        // 独立模式下不自动调用 AI，用户点击刷新按钮才加载（节省 token）
      } catch (e) {
        console.error("Printer init failed", e);
      }
      // ✅ Always load favorites on mount, regardless of mode or history
      await loadFavoritesForDisplay();
    };
    initData();
  }, [mode, systemLanguage]);

  // Handle pre-fetched term
  useEffect(() => {
    if (mode === 'analysis' && preFetchedTerm && preFetchedExplanation && queue.length > 0) {
      // Find index of pre-fetched term in queue if possible, or just set it
      const idx = queue.findIndex(q => q.term === preFetchedTerm.term);
      if (idx !== -1) {
        setCurrentIndex(idx);
        setCurrentExplanation(preFetchedExplanation);
        setIsAiLoading(false);
      }
    }
  }, [preFetchedTerm, preFetchedExplanation, queue]);

  // ✅ New: Simple function to load favorites for display only (no queue modification)
  const loadFavoritesForDisplay = async () => {
    try {
      const dbFavs = (await get('favorite_terms')) || [];
      // Strict filter: Must have term, savedAt, def, and app to be valid
      const validFavs = dbFavs.filter((f: any) =>
        f.term && f.savedAt && f.def && f.app && !f.isPreset
      );

      // Purge invalid items from DB
      if (validFavs.length !== dbFavs.length) {
        await set('favorite_terms', validFavs);
        console.log(`🧹 Purged ${dbFavs.length - validFavs.length} ghost favorites`);
      }

      setFavorites(validFavs);
    } catch (e) { console.error("Load favs for display failed", e); }
  };

  // Keep the old loadFavorites for standalone-mode queue bootstrapping
  const loadFavorites = async () => {
    await loadFavoritesForDisplay();
    const currentFavs = favorites; // This won't work due to stale closure, need to re-fetch
    const validFavs = (await get('favorite_terms')) || [];

    if (validFavs.length > 0 && queue.length === 0) {
      const first = validFavs[0];
      const newItem: MiningResult = { term: first.term, category: first.category, images: first.images || [], isPreset: false };
      setQueue([newItem]);
      setCurrentIndex(0);
      setCurrentExplanation({ def: first.def, app: first.app });
      setIsAiLoading(false);
      setIsFavorited(true);
      if (first.images && first.images.length > 0) setPrintedVisual(<img src={first.images[0]} alt="Fav Visual" className="w-full h-full object-cover" />);
    } else if (validFavs.length === 0 && queue.length === 0) {
      // Only load defaults into QUEUE if no favorites AND no queue
      const defaults: MiningResult[] = [
        { term: "Cyberpunk", category: "Style", images: [], isPreset: true, presetId: "Cyberpunk" },
        { term: "Minimalism", category: "Composition", images: [], isPreset: true, presetId: "Minimalism" },
        { term: "Baroque", category: "Style", images: [], isPreset: true, presetId: "Baroque" }
      ];
      setQueue(defaults);
      loadTermExplanation(defaults[0]);
    }
  };

  const loadTermExplanation = async (termData: MiningResult) => {
    // Cancel any ongoing request in standalone mode
    if (mode === 'standalone' && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const controller = new AbortController();
    if (mode === 'standalone') {
      abortControllerRef.current = controller;
    }

    setIsAiLoading(true);
    setCurrentExplanation(null);

    try {
      const explanation = await explainVisualTerm(termData.term, systemLanguage);
      // Check if this request was aborted
      if (controller.signal.aborted) return;
      setCurrentExplanation(explanation);
    } catch (e: any) {
      if (e.name === 'AbortError' || controller.signal.aborted) return;
      console.error('AI explanation failed', e);
    } finally {
      if (!controller.signal.aborted) {
        setIsAiLoading(false);
      }
    }

    const favs = (await get('favorite_terms')) || [];
    const exists = favs.find((f: any) => f.term === termData.term);
    setIsFavorited(!!exists);
    setImageCursor(0);
  };

  const refreshTerm = (playAudio = true) => {
    if (queue.length <= 1) return;
    if (playAudio) playSound('click');
    const nextIndex = (currentIndex + 1) % queue.length;
    setCurrentIndex(nextIndex);
    // Persist current term for standalone mode
    if (mode === 'standalone' && queue[nextIndex]) {
      set('printer_current_term', queue[nextIndex].term);
    }
    loadTermExplanation(queue[nextIndex]);
  };

  const handlePrint = () => {
    if (isPrinting || isAiLoading) return;
    setPrintedVisual(getCurrentVisual());
    playSound('click');
    setIsPrinting(true);
    let stopSound: () => void;
    setTimeout(() => { stopSound = startPrintSound(); }, 200);
    setTimeout(() => {
      setIsPrinting(false); setShowCard(true);
      if (stopSound) stopSound();
      if (mode === 'analysis') {
        const currentTerm = queue[currentIndex];
        if (currentTerm && !currentTerm.isPreset && currentTerm.images.length > 1) {
          setImageCursor((prev) => (prev + 1) % currentTerm.images.length);
        }
      }
    }, 1500);
  };

  const handleDownload = async () => {
    const term = queue[currentIndex];
    // Use the hidden clean template instead of the visible card
    const cardElement = document.getElementById('printer-card-export');
    if (!term || !cardElement) return;

    try {
      // @ts-ignore
      const html2canvas = (await import('html2canvas')).default;

      // Temporarily show the hidden template
      cardElement.style.display = 'block';
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#ffffff', // Force White Opaque
        scale: 2
      });
      cardElement.style.display = 'none';

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `snaplex-card-${term.term}.png`;
      link.click();
    } catch (e) {
      console.error("Card capture failed", e);
    }
  };

  const handleDeleteFavorite = async (e: React.MouseEvent, favTerm: string) => {
    e.stopPropagation();
    // No sound for delete on card
    try {
      const favs = (await get('favorite_terms')) || [];
      const newFavs = favs.filter((f: any) => f.term !== favTerm);
      await set('favorite_terms', newFavs);
      setFavorites(newFavs);
      if (queue[currentIndex]?.term === favTerm) setIsFavorited(false);
    } catch (e) { console.error("Delete fav failed", e); }
  };

  const handleCopyTerm = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    // No sound for copy
    navigator.clipboard.writeText(text).then(() => {
      // Optional success feedback if needed
    }).catch(err => console.error('Copy failed', err));
  };

  const handleFavorite = async () => {
    const currentTerm = queue[currentIndex];
    if (!currentTerm || !currentExplanation) return;
    playSound('click');

    const newStatus = !isFavorited;
    setIsFavorited(newStatus);

    const favItem = {
      id: currentTerm.term, term: currentTerm.term,
      def: currentExplanation.def, app: currentExplanation.app,
      category: currentTerm.category, savedAt: Date.now(),
      images: currentTerm.images && currentTerm.images.length > 0 ? [currentTerm.images[imageCursor % currentTerm.images.length]] : []
    };

    try {
      const favs = (await get('favorite_terms')) || [];
      let newFavs;
      if (newStatus) {
        if (!favs.find((f: any) => f.term === favItem.term)) newFavs = [favItem, ...favs];
        else newFavs = favs;
      } else {
        newFavs = favs.filter((f: any) => f.term !== favItem.term);
      }
      await set('favorite_terms', newFavs);
      setFavorites(newFavs);
    } catch (e) { console.error("Save fav failed", e); }
  };

  const handleSelectFav = (fav: any) => {
    // No sound when selecting from list (per feedback)
    // 不要重置 queue，否则会导致刷新按钮失效
    const idx = queue.findIndex(q => q.term === fav.term);
    if (idx !== -1) {
      setCurrentIndex(idx);
      loadTermExplanation(queue[idx]);
    } else {
      // 如果不在当前队列，将其加入并跳转
      const newItem: MiningResult = { term: fav.term, category: fav.category, images: fav.images || [], isPreset: false };
      setQueue(prev => [newItem, ...prev]);
      setCurrentIndex(0);
      setCurrentExplanation({ def: fav.def, app: fav.app });
    }
    setIsFavorited(true);
    setIsAiLoading(false);
    if (fav.images && fav.images.length > 0) {
      setPrintedVisual(<img src={fav.images[0]} alt="Fav Visual" className="w-full h-full object-cover" />);
    } else {
      setPrintedVisual(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getCurrentVisual = () => {
    const term = queue[currentIndex];
    if (!term) return null;
    if (!term.isPreset && term.images.length > 0) {
      const imgUrl = term.images[imageCursor % term.images.length];
      return <img src={imgUrl} alt="History Visual" className="w-full h-full object-cover shadow-inner" />;
    }
    const presetData = AESTHETIC_TERMS.find(t => t.id === term.presetId) || AESTHETIC_TERMS[0];
    return <div className="w-full h-full opacity-80" style={presetData?.visualStyle || { background: '#eee' }}></div>;
  };

  const isAnalysisMode = mode === 'analysis';

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Style': return 'bg-coral';
      case 'Lighting': return 'bg-sunny';
      case 'Composition': return 'bg-softblue';
      case 'Mood': return 'bg-mint';
      default: return 'bg-stone-400';
    }
  };

  return (
    <div className={`relative w-full flex flex-col items-center ${isAnalysisMode ? 'h-auto py-8 justify-center' : 'min-h-screen pt-8 pb-20'}`}>

      {showCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_0.3s]" onClick={() => setShowCard(false)}>
          <div className="bg-white p-6 rounded-3xl shadow-2xl transform transition-all animate-[popIn_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)] max-w-[85%] w-80 relative flex flex-col h-auto" onClick={(e) => e.stopPropagation()}>
            <div className="h-40 rounded-2xl mb-5 relative overflow-hidden shadow-inner bg-stone-100 shrink-0">{printedVisual}</div>
            <div className="px-1 text-left flex-1 min-h-0">
              <h3 className="text-3xl font-black text-stone-800 mb-4 tracking-tight">
                {typeof queue[currentIndex]?.term === 'string' ? queue[currentIndex]?.term : (queue[currentIndex]?.term as any)?.term || '...'}
              </h3>
              <div className="space-y-4">
                <div><h4 className="text-[12px] font-bold text-stone-400 uppercase tracking-widest mb-1">DEFINITION</h4><p className="text-sm text-stone-600 font-medium">{currentExplanation?.def}</p></div>
                <div><h4 className="text-[12px] font-bold text-stone-400 uppercase tracking-widest mb-1">APPLICATION</h4><p className="text-sm text-stone-600 font-medium">{currentExplanation?.app}</p></div>
              </div>
            </div>
            <div className="mt-6 flex gap-2 pt-2">
              <button onClick={handleDownload} className="flex-1 bg-stone-800 text-white py-3 rounded-2xl font-bold text-sm hover:bg-stone-700 active:scale-95 transition-all">Download Card</button>
            </div>
            <button data-html2canvas-ignore onClick={() => setShowCard(false)} className="absolute top-4 right-4 w-8 h-8 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center hover:bg-stone-200">✕</button>
          </div>

          {/* Hidden Template for Clean Export */}
          <div id="printer-card-export" className="absolute left-[-9999px] top-0 w-[400px] bg-white p-6 font-sans items-center flex flex-col text-center" style={{ display: 'none' }}>
            <div className="relative w-full rounded-2xl overflow-hidden mb-4 bg-stone-100 flex items-center justify-center">
              <div className="w-full relative">
                {/* Full Image Display: No cropping, natural height logic */}
                {queue[currentIndex]?.images && queue[currentIndex]?.images.length > 0 ? (
                  <img src={queue[currentIndex]?.images[(imageCursor || 0) % queue[currentIndex].images.length]} className="w-full h-auto object-contain" />
                ) : printedVisual}
              </div>
            </div>
            <div className="w-full text-left">
              <h3 className="text-3xl font-black text-stone-800 mb-6 tracking-tight leading-tight">
                {typeof queue[currentIndex]?.term === 'string' ? queue[currentIndex]?.term : (queue[currentIndex]?.term as any)?.term || '...'}
              </h3>
              <div className="space-y-6">
                <div><h4 className="text-[10px] font-black text-coral uppercase tracking-widest mb-2">DEFINITION</h4><p className="text-sm text-stone-600 font-medium leading-relaxed">{currentExplanation?.def}</p></div>
                <div><h4 className="text-[10px] font-black text-sunny uppercase tracking-widest mb-2">APPLICATION</h4><p className="text-sm text-stone-600 font-medium leading-relaxed">{currentExplanation?.app}</p></div>
              </div>
            </div>
            {/* Branding footer restored */}
            <div className="mt-8 pt-4 border-t border-stone-100 w-full text-center">
              <span className="text-[10px] font-black text-stone-300 uppercase tracking-[0.3em]">GENERATED BY SNAPLEX</span>
            </div>
          </div>

        </div>
      )}

      {/* ✅ 修复手机端显示尺寸：更宽的复古比例，使用 scale 适配 - ONLY show in analysis mode */}
      {isAnalysisMode && (
        <div className={`transform transition-transform duration-500 origin-top sm:origin-center ${isAnalysisMode ? 'scale-90' : 'scale-[0.8] xs:scale-85 sm:scale-100'}`}>
          <div className="relative w-[360px] sm:w-[440px] bg-[#e8e4dc] rounded-[2.5rem] p-8 shadow-[inset_0_-8px_10px_rgba(0,0,0,0.05),0_30px_60px_rgba(0,0,0,0.15)] border border-[#d6d3cb]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3/4 h-5 bg-[#d1cec5] rounded-full shadow-inner overflow-visible">
              <div className={`absolute top-2 left-2 right-2 bg-white shadow-sm transition-all duration-[1.5s] ease-linear flex flex-col items-center justify-center border border-stone-100 overflow-hidden ${isPrinting ? 'h-40 -translate-y-32 opacity-100' : 'h-0 opacity-0'}`}>{printedVisual}</div>
            </div>
            <div className="text-[#d1cec5] font-black text-xs tracking-[0.25em] mb-6 ml-1" style={{ textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.1)' }}>SNAPLEX</div>

            <div className="flex gap-4 sm:gap-5">
              <div className="flex-1 flex flex-col gap-4">
                <div className="bg-[#1a1c1a] rounded-xl p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-[5px] border-[#d1cec5] relative overflow-hidden h-32 w-full shrink-0 flex flex-col justify-center">
                  <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-white/5 to-transparent pointer-events-none z-10 rounded-lg"></div>
                  <div className="px-3 font-mono text-[#33ff00] leading-relaxed opacity-90 overflow-hidden relative h-full flex flex-col justify-center">
                    <div className="font-bold mb-1 text-[12px] text-[#33ff00]/70 uppercase tracking-wider">
                      {getCategoryLabel(queue[currentIndex]?.category || 'Loading')}: {typeof queue[currentIndex]?.term === 'string' ? queue[currentIndex]?.term : (queue[currentIndex]?.term as any)?.term || '...'}
                    </div>
                    <div className="relative h-20 overflow-hidden">
                      {isAiLoading ? <div className="animate-pulse">Thinking...</div> : <div className="animate-marquee"><span className="block pb-8 text-sm">{currentExplanation?.def}</span><span className="block pb-8 text-sm">{currentExplanation?.def}</span></div>}
                    </div>
                  </div>
                </div>

                <div className="h-16 relative opacity-90 ml-1">
                  <svg className="absolute top-2 left-5 w-11 h-10 text-coral -rotate-12 transform hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(1px 1px 0px rgba(255,255,255,0.4))' }}><path d="M7 8V6h10v2h2v6h-2v2h-2v2H9v-2H7v-2H5V8h2zm2 2v2h2v-2H9zm4 0v2h2v-2h-2z" /></svg>
                  <svg className="absolute top-6 left-32 w-8 h-8 text-softblue rotate-45 transform hover:rotate-90 transition-transform duration-700" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(1px 1px 0px rgba(255,255,255,0.4))' }}><path d="M11 2h2v7h-2V2zm0 13h2v7h-2v-7zm9-4v2h-7v-2h7zM4 11v2h7v-2H4zm13.657-6.343l1.414 1.414-4.95 4.95-1.414-1.414 4.95-4.95zM6.343 17.657l1.414 1.414-4.95 4.95-1.414-1.414 4.95-4.95zm12.728 0l-1.414 1.414-4.95-4.95 1.414-1.414 4.95 4.95zM7.757 6.343l-1.414 1.414 4.95 4.95 1.414-1.414-4.95-4.95z" /></svg>
                  <svg className="absolute top-0 left-44 w-10 h-10 text-sunny rotate-12 transform hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(1px 1px 0px rgba(255,255,255,0.4))' }}><path d="M4 8h2v2H4V8zm14 0h2v2h-2V8zm-3 8h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2 0h2v2h-2v-2zm-2-2h2v2H9v-2z" /></svg>
                </div>
              </div>

              <div className="flex flex-col gap-4 justify-start pt-1">
                <button onClick={() => refreshTerm(true)} disabled={queue.length <= 1} className="w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-600 shadow-sm hover:bg-[#eae8e1] disabled:opacity-50"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                <button onClick={handlePrint} disabled={isPrinting || isAiLoading} className="w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-800 shadow-sm hover:bg-[#eae8e1] disabled:opacity-50"><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12v2H8v-4h8v2zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z" /><circle cx="18" cy="11.5" r="1" /></svg></button>
                <button onClick={handleFavorite} disabled={isAiLoading} className={`w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center shadow-sm hover:bg-[#eae8e1] ${isFavorited ? 'text-coral' : 'text-stone-400'}`}><svg className="w-6 h-6" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAnalysisMode ? (
        <div className="mt-8 text-center animate-[fadeIn_0.5s]">
          <h3 className="text-2xl font-black text-stone-800 mb-2">{isFinished ? "Decoding Complete" : (isAiLoading ? "Connecting..." : "Visual Decoding...")}</h3>
          {isFinished ? (
            <button onClick={() => onViewResult && onViewResult()} className="bg-stone-800 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 mx-auto">
              View Result <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          ) : (
            <p className="text-stone-500 text-sm font-bold tracking-wider uppercase animate-pulse">Learn visual terms while waiting.</p>
          )}
        </div>
      ) : (
        /* Standalone Mode: Full-screen split layout for desktop */
        <div className="min-h-screen pt-20 pb-10">
          {/* Desktop: Split layout - 1/3 printer, 2/3 favorites */}
          <div className="hidden md:flex h-[calc(100vh-8rem)] max-w-full">
            {/* Left Side: Printer (1/3 width, centered) */}
            <div className="w-1/3 flex items-center justify-center bg-cream">
              <div className="transform scale-75 lg:scale-85">
                <div className="relative w-[440px] bg-[#e8e4dc] rounded-[2.5rem] p-8 shadow-[inset_0_-8px_10px_rgba(0,0,0,0.05),0_30px_60px_rgba(0,0,0,0.15)] border border-[#d6d3cb]">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3/4 h-5 bg-[#d1cec5] rounded-full shadow-inner overflow-visible">
                    <div className={`absolute top-2 left-2 right-2 bg-white shadow-sm transition-all duration-[1.5s] ease-linear flex flex-col items-center justify-center border border-stone-100 overflow-hidden ${isPrinting ? 'h-40 -translate-y-32 opacity-100' : 'h-0 opacity-0'}`}>{printedVisual}</div>
                  </div>
                  <div className="text-[#d1cec5] font-black text-xs tracking-[0.25em] mb-6 ml-1" style={{ textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.1)' }}>SNAPLEX</div>

                  <div className="flex gap-5">
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="bg-[#1a1c1a] rounded-xl p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-[5px] border-[#d1cec5] relative overflow-hidden h-32 w-full shrink-0 flex flex-col justify-center">
                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-white/5 to-transparent pointer-events-none z-10 rounded-lg"></div>
                        <div className="px-3 font-mono text-[#33ff00] leading-relaxed opacity-90 overflow-hidden relative h-full flex flex-col justify-center">
                          <div className="font-bold mb-1 text-[12px] text-[#33ff00]/70 uppercase tracking-wider">
                            {getCategoryLabel(queue[currentIndex]?.category || 'Loading')}: {typeof queue[currentIndex]?.term === 'string' ? queue[currentIndex]?.term : (queue[currentIndex]?.term as any)?.term || '...'}
                          </div>
                          <div className="relative h-20 overflow-hidden">
                            {isAiLoading ? <div className="animate-pulse">Thinking...</div> : <div className="animate-marquee"><span className="block pb-8 text-sm">{currentExplanation?.def}</span><span className="block pb-8 text-sm">{currentExplanation?.def}</span></div>}
                          </div>
                        </div>
                      </div>

                      <div className="h-16 relative opacity-90 ml-1">
                        <svg className="absolute top-2 left-5 w-11 h-10 text-coral -rotate-12 transform hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(1px 1px 0px rgba(255,255,255,0.4))' }}><path d="M7 8V6h10v2h2v6h-2v2h-2v2H9v-2H7v-2H5V8h2zm2 2v2h2v-2H9zm4 0v2h2v-2h-2z" /></svg>
                        <svg className="absolute top-6 left-32 w-8 h-8 text-softblue rotate-45 transform hover:rotate-90 transition-transform duration-700" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(1px 1px 0px rgba(255,255,255,0.4))' }}><path d="M11 2h2v7h-2V2zm0 13h2v7h-2v-7zm9-4v2h-7v-2h7zM4 11v2h7v-2H4zm13.657-6.343l1.414 1.414-4.95 4.95-1.414-1.414 4.95-4.95zM6.343 17.657l1.414 1.414-4.95 4.95-1.414-1.414 4.95-4.95zm12.728 0l-1.414 1.414-4.95-4.95 1.414-1.414 4.95 4.95zM7.757 6.343l-1.414 1.414 4.95 4.95 1.414-1.414-4.95-4.95z" /></svg>
                        <svg className="absolute top-0 left-44 w-10 h-10 text-sunny rotate-12 transform hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(1px 1px 0px rgba(255,255,255,0.4))' }}><path d="M4 8h2v2H4V8zm14 0h2v2h-2V8zm-3 8h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2 0h2v2h-2v-2zm-2-2h2v2H9v-2z" /></svg>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 justify-start pt-1">
                      <button onClick={() => refreshTerm(true)} disabled={queue.length <= 1} className="w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-600 shadow-sm hover:bg-[#eae8e1] disabled:opacity-50"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                      <button onClick={handlePrint} disabled={isPrinting || isAiLoading} className="w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-800 shadow-sm hover:bg-[#eae8e1] disabled:opacity-50"><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12v2H8v-4h8v2zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z" /><circle cx="18" cy="11.5" r="1" /></svg></button>
                      <button onClick={handleFavorite} disabled={isAiLoading} className={`w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center shadow-sm hover:bg-[#eae8e1] ${isFavorited ? 'text-coral' : 'text-stone-400'}`}><svg className="w-6 h-6" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Favorites collection (2/3 width) with coral background and pixel heart */}
            <div className="w-2/3 relative overflow-hidden rounded-l-3xl" style={{ backgroundColor: '#f5c4c0' }}>
              {/* Pixel Heart Background Pattern */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
                <svg viewBox="0 0 32 32" className="w-80 h-80" fill="#c25a52">
                  <rect x="9" y="5" width="2" height="2" />
                  <rect x="11" y="5" width="2" height="2" />
                  <rect x="13" y="5" width="2" height="2" />
                  <rect x="19" y="5" width="2" height="2" />
                  <rect x="21" y="5" width="2" height="2" />
                  <rect x="23" y="5" width="2" height="2" />
                  <rect x="7" y="7" width="2" height="2" />
                  <rect x="9" y="7" width="2" height="2" />
                  <rect x="11" y="7" width="2" height="2" />
                  <rect x="13" y="7" width="2" height="2" />
                  <rect x="15" y="7" width="2" height="2" />
                  <rect x="17" y="7" width="2" height="2" />
                  <rect x="19" y="7" width="2" height="2" />
                  <rect x="21" y="7" width="2" height="2" />
                  <rect x="23" y="7" width="2" height="2" />
                  <rect x="25" y="7" width="2" height="2" />
                  <rect x="5" y="9" width="2" height="2" />
                  <rect x="7" y="9" width="2" height="2" />
                  <rect x="9" y="9" width="2" height="2" />
                  <rect x="11" y="9" width="2" height="2" />
                  <rect x="13" y="9" width="2" height="2" />
                  <rect x="15" y="9" width="2" height="2" />
                  <rect x="17" y="9" width="2" height="2" />
                  <rect x="19" y="9" width="2" height="2" />
                  <rect x="21" y="9" width="2" height="2" />
                  <rect x="23" y="9" width="2" height="2" />
                  <rect x="25" y="9" width="2" height="2" />
                  <rect x="27" y="9" width="2" height="2" />
                  <rect x="5" y="11" width="2" height="2" />
                  <rect x="7" y="11" width="2" height="2" />
                  <rect x="9" y="11" width="2" height="2" />
                  <rect x="11" y="11" width="2" height="2" />
                  <rect x="13" y="11" width="2" height="2" />
                  <rect x="15" y="11" width="2" height="2" />
                  <rect x="17" y="11" width="2" height="2" />
                  <rect x="19" y="11" width="2" height="2" />
                  <rect x="21" y="11" width="2" height="2" />
                  <rect x="23" y="11" width="2" height="2" />
                  <rect x="25" y="11" width="2" height="2" />
                  <rect x="27" y="11" width="2" height="2" />
                  <rect x="5" y="13" width="2" height="2" />
                  <rect x="7" y="13" width="2" height="2" />
                  <rect x="9" y="13" width="2" height="2" />
                  <rect x="11" y="13" width="2" height="2" />
                  <rect x="13" y="13" width="2" height="2" />
                  <rect x="15" y="13" width="2" height="2" />
                  <rect x="17" y="13" width="2" height="2" />
                  <rect x="19" y="13" width="2" height="2" />
                  <rect x="21" y="13" width="2" height="2" />
                  <rect x="23" y="13" width="2" height="2" />
                  <rect x="25" y="13" width="2" height="2" />
                  <rect x="27" y="13" width="2" height="2" />
                  <rect x="7" y="15" width="2" height="2" />
                  <rect x="9" y="15" width="2" height="2" />
                  <rect x="11" y="15" width="2" height="2" />
                  <rect x="13" y="15" width="2" height="2" />
                  <rect x="15" y="15" width="2" height="2" />
                  <rect x="17" y="15" width="2" height="2" />
                  <rect x="19" y="15" width="2" height="2" />
                  <rect x="21" y="15" width="2" height="2" />
                  <rect x="23" y="15" width="2" height="2" />
                  <rect x="25" y="15" width="2" height="2" />
                  <rect x="9" y="17" width="2" height="2" />
                  <rect x="11" y="17" width="2" height="2" />
                  <rect x="13" y="17" width="2" height="2" />
                  <rect x="15" y="17" width="2" height="2" />
                  <rect x="17" y="17" width="2" height="2" />
                  <rect x="19" y="17" width="2" height="2" />
                  <rect x="21" y="17" width="2" height="2" />
                  <rect x="23" y="17" width="2" height="2" />
                  <rect x="11" y="19" width="2" height="2" />
                  <rect x="13" y="19" width="2" height="2" />
                  <rect x="15" y="19" width="2" height="2" />
                  <rect x="17" y="19" width="2" height="2" />
                  <rect x="19" y="19" width="2" height="2" />
                  <rect x="21" y="19" width="2" height="2" />
                  <rect x="13" y="21" width="2" height="2" />
                  <rect x="15" y="21" width="2" height="2" />
                  <rect x="17" y="21" width="2" height="2" />
                  <rect x="19" y="21" width="2" height="2" />
                  <rect x="15" y="23" width="2" height="2" />
                  <rect x="17" y="23" width="2" height="2" />
                </svg>
              </div>

              {/* Content */}
              <div className="relative z-10 h-full p-8 overflow-y-auto">
                {favorites.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#c25a52]/60">
                    <svg viewBox="0 0 32 32" className="w-20 h-20 mb-6" fill="currentColor">
                      <rect x="9" y="5" width="2" height="2" />
                      <rect x="11" y="5" width="2" height="2" />
                      <rect x="13" y="5" width="2" height="2" />
                      <rect x="19" y="5" width="2" height="2" />
                      <rect x="21" y="5" width="2" height="2" />
                      <rect x="23" y="5" width="2" height="2" />
                      <rect x="7" y="7" width="2" height="2" />
                      <rect x="25" y="7" width="2" height="2" />
                      <rect x="5" y="9" width="2" height="2" />
                      <rect x="27" y="9" width="2" height="2" />
                      <rect x="5" y="11" width="2" height="2" />
                      <rect x="27" y="11" width="2" height="2" />
                      <rect x="7" y="15" width="2" height="2" />
                      <rect x="25" y="15" width="2" height="2" />
                      <rect x="9" y="17" width="2" height="2" />
                      <rect x="23" y="17" width="2" height="2" />
                      <rect x="11" y="19" width="2" height="2" />
                      <rect x="21" y="19" width="2" height="2" />
                      <rect x="13" y="21" width="2" height="2" />
                      <rect x="19" y="21" width="2" height="2" />
                      <rect x="15" y="23" width="2" height="2" />
                      <rect x="17" y="23" width="2" height="2" />
                    </svg>
                    <p className="font-bold text-lg">No collections yet</p>
                    <p className="text-sm mt-2 opacity-70">Favorite terms to save them here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {favorites.map((fav) => (
                      <div key={`${fav.term}-${fav.savedAt}`} className="relative">
                        {/* File Index Tab Header */}
                        <div className={`absolute -top-5 left-2 px-3 py-1 rounded-t-lg text-[10px] font-black text-white uppercase tracking-widest z-10 ${getCategoryColor(fav.category)}`}>
                          {fav.category}
                        </div>

                        <button
                          onClick={() => handleSelectFav(fav)}
                          className={`w-full p-4 pt-5 rounded-2xl rounded-tl-none text-left transition-all active:scale-[0.98] border-2 group relative overflow-hidden ${queue[currentIndex]?.term === fav.term ? 'bg-[#c25a52] text-white border-[#c25a52] shadow-xl' : 'bg-white/90 text-stone-600 border-white/50 hover:border-white hover:shadow-lg backdrop-blur-sm'}`}
                        >
                          <div className="font-black text-base leading-tight mb-1 relative z-10 pr-6">
                            {typeof fav.term === 'string' ? fav.term : (fav.term as any)?.term || 'Unknown'}
                          </div>
                          <p className={`text-xs line-clamp-2 ${queue[currentIndex]?.term === fav.term ? 'text-white/70' : 'text-stone-400'}`}>{fav.def}</p>

                          <div className="absolute top-2 right-1 flex gap-1 z-20">
                            <div
                              onClick={(e) => handleCopyTerm(e, typeof fav.term === 'string' ? fav.term : (fav.term as any)?.term || '')}
                              className="w-6 h-6 rounded-full bg-stone-100/50 flex items-center justify-center text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Copy"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                            </div>
                            <div
                              onClick={(e) => handleDeleteFavorite(e, fav.term)}
                              className="w-6 h-6 rounded-full bg-stone-100/50 flex items-center justify-center text-stone-400 hover:bg-[#c25a52] hover:text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Delete"
                            >
                              ✕
                            </div>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile: Original vertical layout */}
          <div className="md:hidden">
            <div className="flex justify-center mb-8">
              <div className="transform scale-[0.8]">
                <div className="relative w-[360px] bg-[#e8e4dc] rounded-[2.5rem] p-8 shadow-[inset_0_-8px_10px_rgba(0,0,0,0.05),0_30px_60px_rgba(0,0,0,0.15)] border border-[#d6d3cb]">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3/4 h-5 bg-[#d1cec5] rounded-full shadow-inner overflow-visible">
                    <div className={`absolute top-2 left-2 right-2 bg-white shadow-sm transition-all duration-[1.5s] ease-linear flex flex-col items-center justify-center border border-stone-100 overflow-hidden ${isPrinting ? 'h-40 -translate-y-32 opacity-100' : 'h-0 opacity-0'}`}>{printedVisual}</div>
                  </div>
                  <div className="text-[#d1cec5] font-black text-xs tracking-[0.25em] mb-6 ml-1" style={{ textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.1)' }}>SNAPLEX</div>

                  <div className="flex gap-4">
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="bg-[#1a1c1a] rounded-xl p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-[5px] border-[#d1cec5] relative overflow-hidden h-32 w-full shrink-0 flex flex-col justify-center">
                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-white/5 to-transparent pointer-events-none z-10 rounded-lg"></div>
                        <div className="px-3 font-mono text-[#33ff00] leading-relaxed opacity-90 overflow-hidden relative h-full flex flex-col justify-center">
                          <div className="font-bold mb-1 text-[12px] text-[#33ff00]/70 uppercase tracking-wider">
                            {getCategoryLabel(queue[currentIndex]?.category || 'Loading')}: {typeof queue[currentIndex]?.term === 'string' ? queue[currentIndex]?.term : (queue[currentIndex]?.term as any)?.term || '...'}
                          </div>
                          <div className="relative h-20 overflow-hidden">
                            {isAiLoading ? <div className="animate-pulse">Thinking...</div> : <div className="animate-marquee"><span className="block pb-8 text-sm">{currentExplanation?.def}</span><span className="block pb-8 text-sm">{currentExplanation?.def}</span></div>}
                          </div>
                        </div>
                      </div>

                      <div className="h-16 relative opacity-90 ml-1">
                        <svg className="absolute top-2 left-5 w-11 h-10 text-coral -rotate-12 transform" viewBox="0 0 24 24" fill="currentColor"><path d="M7 8V6h10v2h2v6h-2v2h-2v2H9v-2H7v-2H5V8h2zm2 2v2h2v-2H9zm4 0v2h2v-2h-2z" /></svg>
                        <svg className="absolute top-6 left-32 w-8 h-8 text-softblue rotate-45 transform" viewBox="0 0 24 24" fill="currentColor"><path d="M11 2h2v7h-2V2zm0 13h2v7h-2v-7zm9-4v2h-7v-2h7zM4 11v2h7v-2H4z" /></svg>
                        <svg className="absolute top-0 left-44 w-10 h-10 text-sunny rotate-12 transform" viewBox="0 0 24 24" fill="currentColor"><path d="M4 8h2v2H4V8zm14 0h2v2h-2V8zm-3 8h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2 0h2v2h-2v-2zm-2-2h2v2H9v-2z" /></svg>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 justify-start pt-1">
                      <button onClick={() => refreshTerm(true)} disabled={queue.length <= 1} className="w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-600 shadow-sm disabled:opacity-50"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                      <button onClick={handlePrint} disabled={isPrinting || isAiLoading} className="w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-800 shadow-sm disabled:opacity-50"><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12v2H8v-4h8v2zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z" /><circle cx="18" cy="11.5" r="1" /></svg></button>
                      <button onClick={handleFavorite} disabled={isAiLoading} className={`w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center shadow-sm ${isFavorited ? 'text-coral' : 'text-stone-400'}`}><svg className="w-6 h-6" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 animate-[fadeIn_0.5s]">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px bg-stone-200 flex-1"></div>
                <h2 className="text-stone-400 font-bold text-xs tracking-[0.2em] uppercase">Collected Terms ({favorites.length})</h2>
                <div className="h-px bg-stone-200 flex-1"></div>
              </div>
              {favorites.length === 0 ? (
                <div className="text-center py-10 text-stone-400">
                  <p className="mb-2 text-3xl">📭</p>
                  <p>No collections yet.</p>
                  <p className="text-xs mt-2">Favorite terms during analysis to save them here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 pb-20">
                  {favorites.map((fav) => (
                    <div key={`${fav.term}-${fav.savedAt}`} className="relative">
                      <div className={`absolute -top-6 left-2 px-3 py-1 rounded-t-lg text-[10px] font-black text-white uppercase tracking-widest z-10 ${getCategoryColor(fav.category)}`}>
                        {fav.category}
                      </div>

                      <button
                        onClick={() => handleSelectFav(fav)}
                        className={`w-full p-4 pt-6 rounded-2xl rounded-tl-none text-left transition-all active:scale-[0.98] border-2 group relative overflow-hidden h-auto flex flex-col justify-between min-h-[100px] ${queue[currentIndex]?.term === fav.term ? 'bg-stone-800 text-white border-stone-800 shadow-xl' : 'bg-white text-stone-600 border-stone-100/80 hover:border-stone-200 hover:shadow-lg'}`}
                      >
                        <div className="font-black text-base leading-tight mb-2 relative z-10 pr-6">
                          {typeof fav.term === 'string' ? fav.term : (fav.term as any)?.term || 'Unknown'}
                        </div>

                        <div className="absolute top-2 right-1 flex gap-1 z-20">
                          <div
                            onClick={(e) => handleCopyTerm(e, typeof fav.term === 'string' ? fav.term : (fav.term as any)?.term || '')}
                            className="w-6 h-6 rounded-full bg-stone-100/50 flex items-center justify-center text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Copy"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                          </div>
                          <div
                            onClick={(e) => handleDeleteFavorite(e, fav.term)}
                            className="w-6 h-6 rounded-full bg-stone-100/50 flex items-center justify-center text-stone-400 hover:bg-coral hover:text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Delete"
                          >
                            ✕
                          </div>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes marquee { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } } .animate-marquee { animation: marquee 8s linear infinite; } @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
};

export default StylePrinter;