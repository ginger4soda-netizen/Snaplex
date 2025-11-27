import React, { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { getRandomTerm, TermContent, TermTheme } from '../data/aestheticTerms';

interface Props {
  systemLanguage?: string;
}

const StylePrinter: React.FC<Props> = ({ systemLanguage }) => {
  // 状态管理
  const [currentTerm, setCurrentTerm] = useState<{term: TermContent, theme: TermTheme, id: string, visualStyle: React.CSSProperties} | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  // 初始化：随机获取一个术语
  useEffect(() => {
    refreshTerm();
  }, [systemLanguage]);

  const refreshTerm = () => {
    const newTerm = getRandomTerm(systemLanguage);
    setCurrentTerm(newTerm);
    setIsFavorited(false); // 重置收藏状态
  };

  // 打印逻辑
  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);
    // 1.5秒动画后显示大卡片
    setTimeout(() => {
      setIsPrinting(false);
      setShowCard(true);
    }, 1500);
  };

  // 收藏逻辑 (存入 IndexedDB 'favorite_terms' 表)
  const handleFavorite = async () => {
    if (!currentTerm) return;
    setIsFavorited(!isFavorited);
    
    try {
      const favs = (await get('favorite_terms')) || [];
      // 简单的去重逻辑：如果已存在则移除，否则添加
      const exists = favs.find((f: any) => f.id === currentTerm.id);
      let newFavs;
      if (exists) {
        newFavs = favs.filter((f: any) => f.id !== currentTerm.id);
      } else {
        newFavs = [...favs, { ...currentTerm, savedAt: Date.now() }];
      }
      await set('favorite_terms', newFavs);
    } catch (e) {
      console.error("Failed to save favorite", e);
    }
  };

  if (!currentTerm) return null;

  return (
    <div className="relative w-full h-[65vh] flex flex-col items-center justify-center p-4">
      
      {/* --- 1. 打印出的卡片 (Modal) --- */}
      {showCard && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-[fadeIn_0.3s]">
          <div 
            className="bg-white p-2 rounded-2xl shadow-2xl transform transition-all animate-[popIn_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)] max-w-[85%] w-80 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 卡片视觉区域 */}
            <div className="h-48 rounded-xl mb-4 relative overflow-hidden" style={currentTerm.visualStyle}>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-white/90 px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase shadow-sm">
                        {currentTerm.id}
                    </span>
                </div>
            </div>
            
            {/* 卡片文字 */}
            <div className="px-2 pb-4 text-center">
                <h3 className="text-2xl font-black text-stone-800 mb-2">{currentTerm.term.term}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{currentTerm.term.desc}</p>
            </div>

            {/* 关闭按钮 */}
            <button 
                onClick={() => setShowCard(false)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-stone-800 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* --- 2. 复古打印机主体 --- */}
      <div className="relative w-full max-w-sm bg-[#e8e4dc] rounded-[2rem] p-6 shadow-[inset_0_-8px_10px_rgba(0,0,0,0.05),0_20px_40px_rgba(0,0,0,0.1)] border border-[#d6d3cb]">
        
        {/* 顶部出纸口 */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2/3 h-4 bg-[#d1cec5] rounded-full shadow-inner overflow-visible">
            {/* 打印动画纸张 */}
            <div 
                className={`absolute top-2 left-2 right-2 bg-white shadow-sm transition-all duration-[1.5s] ease-linear flex flex-col items-center justify-center border border-stone-100 ${isPrinting ? 'h-32 -translate-y-24 opacity-100' : 'h-0 opacity-0'}`}
            >
                <div className="w-full h-full opacity-50" style={currentTerm.visualStyle}></div>
            </div>
        </div>

        {/* 浮雕 LOGO */}
        <div className="text-[#d1cec5] font-black text-xs tracking-[0.2em] mb-4 ml-1" style={{ textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.1)' }}>
            SNAPLEX
        </div>

        <div className="flex gap-4">
            {/* 左侧：像素屏幕 */}
            <div className="flex-1 bg-[#1a1c1a] rounded-xl p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] border-4 border-[#d1cec5] relative overflow-hidden h-32 flex flex-col justify-center">
                {/* 屏幕反光 */}
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-white/5 to-transparent pointer-events-none z-10 rounded-lg"></div>
                
                <div className="px-3 font-mono text-[#33ff00] text-sm leading-relaxed opacity-90 overflow-hidden relative h-full flex flex-col justify-center">
                    <div className="font-bold mb-1 text-xs text-[#33ff00]/70 uppercase tracking-wider">STYLE: {currentTerm.term.term}</div>
                    
                    {/* 滚动文字容器 */}
                    <div className="relative h-16 overflow-hidden">
                        <div className="animate-marquee">
                            <span className="block pb-2">{currentTerm.term.desc}</span>
                            {/* 重复一遍以实现无缝滚动 */}
                            <span className="block">{currentTerm.term.desc}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右侧：控制面板 */}
            <div className="flex flex-col gap-3 justify-center">
                
                {/* 刷新按钮 */}
                <button 
                    onClick={refreshTerm}
                    className="w-12 h-12 bg-[#e0ded6] rounded-full border-b-4 border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-600 shadow-sm hover:bg-[#eae8e1]"
                    title="Refresh Term"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>

                {/* 打印按钮 */}
                <button 
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className="w-12 h-12 bg-[#e0ded6] rounded-full border-b-4 border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center text-stone-800 shadow-sm hover:bg-[#eae8e1] disabled:opacity-50 disabled:active:translate-y-0"
                    title="Print Card"
                >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12v2H8v-4h8v2zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z"/><circle cx="18" cy="11.5" r="1"/></svg>
                </button>

                {/* 收藏按钮 */}
                <button 
                    onClick={handleFavorite}
                    className={`w-12 h-12 bg-[#e0ded6] rounded-full border-b-4 border-[#bgb8b0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center shadow-sm hover:bg-[#eae8e1] ${isFavorited ? 'text-coral' : 'text-stone-400'}`}
                    title="Favorite"
                >
                    <svg className="w-5 h-5" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                </button>
            </div>
        </div>

        {/* 状态指示灯 */}
        <div className="absolute top-6 right-6 flex gap-2">
            <div className={`w-2 h-2 rounded-full ${isPrinting ? 'bg-sunny animate-pulse' : 'bg-stone-300'}`}></div>
            <div className="w-2 h-2 rounded-full bg-softblue opacity-50"></div>
        </div>
      </div>

      {/* 底部文字 */}
      <div className="mt-8 text-center animate-pulse">
        <h3 className="text-xl font-black text-stone-800 mb-1">Visual decoding...</h3>
        <p className="text-stone-500 text-xs font-bold tracking-wider uppercase">Applying your style</p>
      </div>

      {/* 必要的 CSS 动画 */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .animate-marquee {
          animation: marquee 10s linear infinite;
        }
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default StylePrinter;