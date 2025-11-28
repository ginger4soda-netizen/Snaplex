import React, { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { mineHistory, MiningResult } from '../utils/historyMiner'; // ✅ 新增
import { explainVisualTerm, TermExplanation } from '../services/geminiService'; // ✅ 新增
import { playSound, startPrintSound } from '../utils/sound';
import { AESTHETIC_TERMS } from '../data/aestheticTerms'; // 仅作兜底样式引用

interface Props {
  systemLanguage?: string;
  isFinished?: boolean;
  onViewResult?: () => void;
}

const StylePrinter: React.FC<Props> = ({ systemLanguage = 'English', isFinished = false, onViewResult }) => {
  // --- 状态管理升级 ---
  const [queue, setQueue] = useState<MiningResult[]>([]); // 挖掘出的词条队列
  const [currentIndex, setCurrentIndex] = useState(0);    // 当前播放的词条索引
  const [currentExplanation, setCurrentExplanation] = useState<TermExplanation | null>(null); // AI 实时生成的解释
  const [imageCursor, setImageCursor] = useState(0);      // 图片轮播指针
  
  // UI 状态
  const [isPrinting, setIsPrinting] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(true);   // 原有代码
  const [printedVisual, setPrintedVisual] = useState<React.ReactNode>(null); // ✅ 新增：用于锁定打印时的画面

  // --- 1. 初始化：挖掘历史数据 ---
  useEffect(() => {
    const initData = async () => {
      try {
        const historyItems = (await get('visionLearnHistory')) || [];
        // 挖掘用户历史
        const minedResults = mineHistory(historyItems);
        setQueue(minedResults);
        
        // 加载第一个词条的 AI 解释
        if (minedResults.length > 0) {
          loadTermExplanation(minedResults[0]);
        }
      } catch (e) {
        console.error("Mining failed:", e);
      }
    };
    initData();
  }, [systemLanguage]); 

  // --- 2. 核心逻辑：调用 AI 解释词条 ---
  const loadTermExplanation = async (termData: MiningResult) => {
    setIsAiLoading(true);
    setCurrentExplanation(null);
    
    // 调用 Gemini API 实时生成解释 (需确保 geminiService 已更新)
    // 如果还没更新 service，这里可能会报错，请确保 Step 1 已执行
    const explanation = await explainVisualTerm(termData.term, systemLanguage);
    
    setCurrentExplanation(explanation);
    setIsAiLoading(false);
    setIsFavorited(false); // 重置收藏状态
    setImageCursor(0);     // 重置图片轮播游标
  };

  // --- 3. 交互：刷新词条 ---
  const refreshTerm = (playAudio = true) => {
    if (queue.length <= 1) return; // 只有一个词就不刷新了
    if (playAudio) playSound('click');
    
    // 顺序切换到下一个词条 (循环)
    const nextIndex = (currentIndex + 1) % queue.length;
    setCurrentIndex(nextIndex);
    loadTermExplanation(queue[nextIndex]);
  };

  // --- 4. 交互：打印逻辑 (包含图片轮播) ---
  const handlePrint = () => {
    if (isPrinting || isAiLoading) return; // AI 思考时禁止打印
    
    // ✅ 新增：在按下按钮的瞬间，锁死当前要打印的画面
    setPrintedVisual(getCurrentVisual());

    playSound('click'); 
    setIsPrinting(true);
    
    let stopSound: () => void;
    setTimeout(() => { stopSound = startPrintSound(); }, 200);

    setTimeout(() => { 
        setIsPrinting(false); 
        setShowCard(true);
        if (stopSound) stopSound();

        // ✅ 核心升级：打印完成后，游标后移
        // 这样用户关掉卡片再次点击打印时，会看到该词条下的下一张历史图片
        const currentTerm = queue[currentIndex];
        if (currentTerm && !currentTerm.isPreset && currentTerm.images.length > 1) {
          setImageCursor((prev) => (prev + 1) % currentTerm.images.length);
        }
    }, 1500);
  };

  // --- 5. 交互：收藏 ---
  const handleFavorite = async () => {
    const currentTerm = queue[currentIndex];
    if (!currentTerm || !currentExplanation) return;

    playSound('click'); 
    setIsFavorited(!isFavorited);
    
    // 构造存储对象 (把 AI 解释也存进去)
    const favItem = {
      id: currentTerm.term,
      term: currentTerm.term,
      def: currentExplanation.def,
      app: currentExplanation.app,
      category: currentTerm.category,
      savedAt: Date.now()
    };

    try {
      const favs = (await get('favorite_terms')) || [];
      const exists = favs.find((f: any) => f.id === favItem.id);
      let newFavs;
      if (exists) newFavs = favs.filter((f: any) => f.id !== favItem.id);
      else newFavs = [...favs, favItem];
      await set('favorite_terms', newFavs);
    } catch (e) { console.error("Save fav failed", e); }
  };

  // --- 辅助：获取当前要显示的视觉内容 (历史图 OR 预设CSS) ---
  const getCurrentVisual = () => {
    const term = queue[currentIndex];
    if (!term) return null;

    // A. 历史图片模式：显示当前游标对应的图片
    if (!term.isPreset && term.images.length > 0) {
      const imgUrl = term.images[imageCursor % term.images.length];
      return <img src={imgUrl} alt="Historical" className="w-full h-full object-cover" />;
    }

    // B. 预设 CSS 模式：从静态库中查找对应的 CSS 样式 (作为兜底)
    const presetData = AESTHETIC_TERMS.find(t => t.id === term.presetId);
    return <div className="w-full h-full opacity-80" style={presetData?.visualStyle || { background: '#eee' }}></div>;
  };

  const handleViewResult = () => {
      playSound('click');
      if (onViewResult) onViewResult();
  };

  // 安全检查
  if (queue.length === 0) return null;
  const currentTerm = queue[currentIndex];

  return (
    <div className="relative w-full h-[65vh] flex flex-col items-center justify-center p-4">
      
      {/* --- 1. 卡片 Modal --- */}
      {showCard && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-[fadeIn_0.3s]">
          <div className="bg-white p-4 rounded-3xl shadow-2xl transform transition-all animate-[popIn_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)] max-w-[85%] w-80 relative overflow-y-auto max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            {/* 卡片顶部：动态显示 */}
            <div className="h-40 rounded-2xl mb-5 relative overflow-hidden shadow-inner bg-stone-100">
                {printedVisual}
            </div>
            <div className="px-1 pb-2 text-left">
                <h3 className="text-3xl font-black text-stone-800 mb-4 tracking-tight">{currentTerm.term}</h3>
                <div className="space-y-4">
                    <div>
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">DEFINITION</h4>
                        <p className="text-sm text-stone-600 leading-relaxed font-medium">
                            {currentExplanation?.def || "..."}
                        </p>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">APPLICATION</h4>
                        <p className="text-sm text-stone-600 leading-relaxed font-medium">
                            {currentExplanation?.app || "..."}
                        </p>
                    </div>
                </div>
            </div>
            <button onClick={() => setShowCard(false)} className="absolute top-4 right-4 w-8 h-8 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center hover:bg-stone-200 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* --- 2. 复古打印机 (保留你的视觉参数: scale-110, max-w-md) --- */}
      <div className="transform scale-110 origin-center transition-transform duration-500">
        <div className="relative w-full max-w-md bg-[#e8e4dc] rounded-[2.5rem] p-8 shadow-[inset_0_-8px_10px_rgba(0,0,0,0.05),0_30px_60px_rgba(0,0,0,0.15)] border border-[#d6d3cb]">
            
            {/* 顶部出纸口 */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3/4 h-5 bg-[#d1cec5] rounded-full shadow-inner overflow-visible">
                <div className={`absolute top-2 left-2 right-2 bg-white shadow-sm transition-all duration-[1.5s] ease-linear flex flex-col items-center justify-center border border-stone-100 overflow-hidden ${isPrinting ? 'h-40 -translate-y-32 opacity-100' : 'h-0 opacity-0'}`}>
                    {/* 打印时动态显示内容 */}
                    {printedVisual}
                </div>
            </div>

            {/* LOGO */}
            <div className="text-[#d1cec5] font-black text-xs tracking-[0.25em] mb-5 ml-1" style={{ textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.1)' }}>
                SNAPLEX
            </div>

            <div className="flex gap-5">
                {/* 左侧：屏幕 + 装饰区域 */}
                <div className="flex-1 flex flex-col gap-4">
                    
                    {/* 屏幕 */}
                    <div className="bg-[#1a1c1a] rounded-xl p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-[5px] border-[#d1cec5] relative overflow-hidden h-32 w-full min-w-[310px] shrink-0 flex flex-col justify-center">
                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-white/5 to-transparent pointer-events-none z-10 rounded-lg"></div>
                        <div className="px-3 font-mono text-[#33ff00] leading-relaxed opacity-90 overflow-hidden relative h-full flex flex-col justify-center">
                            {/* 动态标题 */}
                            <div className="font-bold mb-1 text-xs text-[#33ff00]/70 uppercase tracking-wider">{currentTerm.category}: {currentTerm.term}</div>
                            <div className="relative h-20 overflow-hidden">
                                {isAiLoading ? (
                                    // AI Loading 状态
                                    <div className="flex items-center gap-2 h-20 animate-pulse">
                                        <span>Thinking...</span>
                                    </div>
                                ) : (
                                    // 滚动解释 (8s)
                                    <div className="animate-marquee">
                                        <span className="block pb-8 text-sm">{currentExplanation?.def}</span>
                                        <span className="block pb-8 text-sm">{currentExplanation?.def}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 装饰图案 (保留你的坐标参数) */}
                    <div className="h-16 relative opacity-90 ml-1">
                        <svg className="absolute top-2 left-5 w-11 h-10 text-coral -rotate-12 transform hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(1px 1px 0px rgba(255,255,255,0.4))' }}>
                            <path d="M7 8V6h10v2h2v6h-2v2h-2v2H9v-2H7v-2H5V8h2zm2 2v2h2v-2H9zm4 0v2h2v-2h-2z"/>
                        </svg>
                        <svg className="absolute top-6 left-32 w-8 h-8 text-softblue rotate-45 transform hover:rotate-90 transition-transform duration-700" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(1px 1px 0px rgba(255,255,255,0.4))' }}>
                            <path d="M11 2h2v7h-2V2zm0 13h2v7h-2v-7zm9-4v2h-7v-2h7zM4 11v2h7v-2H4zm13.657-6.343l1.414 1.414-4.95 4.95-1.414-1.414 4.95-4.95zM6.343 17.657l1.414 1.414-4.95 4.95-1.414-1.414 4.95-4.95zm12.728 0l-1.414 1.414-4.95-4.95 1.414-1.414 4.95 4.95zM7.757 6.343l-1.414 1.414 4.95 4.95 1.414-1.414-4.95-4.95z"/>
                        </svg>
                        <svg className="absolute top-0 left-44 w-10 h-10 text-sunny rotate-12 transform hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor" style={{ filter: 'drop-shadow(1px 1px 0px rgba(255,255,255,0.4))' }}>
                            <path d="M4 8h2v2H4V8zm14 0h2v2h-2V8zm-3 8h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2 0h2v2h-2v-2zm-2-2h2v2H9v-2z"/>
                        </svg>
                    </div>
                </div>

                {/* 右侧：控制面板 */}
                <div className="flex flex-col gap-4 justify-start pt-1">
                    <button onClick={() => refreshTerm(true)} disabled={isAiLoading} className="w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-600 shadow-sm hover:bg-[#eae8e1] disabled:opacity-50">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                    <button onClick={handlePrint} disabled={isPrinting || isAiLoading} className="w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-800 shadow-sm hover:bg-[#eae8e1] disabled:opacity-50">
                        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12v2H8v-4h8v2zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z"/><circle cx="18" cy="11.5" r="1"/></svg>
                    </button>
                    <button onClick={handleFavorite} disabled={isAiLoading} className={`w-14 h-14 bg-[#e0ded6] rounded-full border-b-[5px] border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center shadow-sm hover:bg-[#eae8e1] ${isFavorited ? 'text-coral' : 'text-stone-400'}`}>
                        <svg className="w-6 h-6" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    </button>
                </div>
            </div>

            {/* 状态指示灯 */}
            <div className="absolute top-8 right-8 flex gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isPrinting ? 'bg-sunny animate-pulse' : 'bg-stone-300'}`}></div>
                <div className={`w-2.5 h-2.5 rounded-full ${isAiLoading ? 'bg-coral animate-pulse' : 'bg-softblue opacity-50'}`}></div>
            </div>
        </div>
      </div>

      {/* 底部文字 */}
      <div className="mt-16 text-center">
        <h3 className="text-2xl font-black text-stone-800 mb-2">
            {isFinished ? "Decoding Complete" : (isAiLoading ? "Connecting..." : "Visual Decoding...")}
        </h3>
        {isFinished ? (
            <button 
                onClick={handleViewResult} 
                className="bg-stone-800 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 mx-auto animate-[fadeIn_0.5s]"
            >
                View Result
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
        ) : (
            <p className="text-stone-500 text-sm font-bold tracking-wider uppercase animate-pulse">
                {isAiLoading ? "Asking AI expert..." : "Learn visual terms while waiting."}
            </p>
        )}
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes marquee { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        .animate-marquee { animation: marquee 8s linear infinite; }
        @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default StylePrinter;