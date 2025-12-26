import React, { useState } from 'react';
import { AnalysisResult, UserSettings, ChatMessage, PromptSegment } from '../types';
import ChatBot from './ChatBot';
import { getTranslation } from '../translations';
import { copyToClipboard } from '../utils/clipboard'; // ✅ 1. 引入新工具

interface Props {
  image: string;
  analysis: AnalysisResult;
  onBack: () => void;
  settings: UserSettings;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  chatHistory: ChatMessage[];
  onUpdateChatHistory: (msgs: ChatMessage[]) => void;
}

const COLOR_MAP: Record<string, string> = {
    'text-coral': '#EF476F', 'text-mint': '#06D6A0', 'text-softblue': '#118AB2', 'text-sunny': '#FFD166', 'text-stone-500': '#78716c',
};

const PromptCard: React.FC<{ title: string; systemLabel: string; content: PromptSegment; color: string; isGlobalFlipped: boolean; }> = ({ title, systemLabel, content, color, isGlobalFlipped }) => {
    const [isCopied, setIsCopied] = useState(false);
    
    const handleCopy = async () => {
        const textToCopy = isGlobalFlipped ? content.translated : content.original;
        // ✅ 2. 使用强壮的复制函数
        const success = await copyToClipboard(textToCopy);
        if (success) {
            setIsCopied(true); 
            setTimeout(() => setIsCopied(false), 2000);
        }
    };
    
    const hexColor = COLOR_MAP[color] || '#78716c';
    return (
        <div className="relative mb-6 perspective-1000">
             <div className="flex justify-between items-center mb-2 px-5">
                <div className={`text-xs font-black uppercase tracking-widest ${color}`}>{systemLabel}</div>
                <button onClick={handleCopy} className="p-1.5 rounded-lg transition-colors text-stone-300 hover:bg-stone-100" style={{ color: isCopied ? hexColor : undefined }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
             </div>
            <div className={`relative z-10 bg-white rounded-2xl shadow-sm transition-all duration-500 transform style-preserve-3d ${isGlobalFlipped ? 'rotate-y-180' : ''}`}>
                <div className={`p-5 flex flex-col backface-hidden ${isGlobalFlipped ? 'hidden' : 'block'}`}>
                    <div className="leading-relaxed text-stone-700 font-medium text-lg mb-1 relative">{content.original}</div>
                </div>
                <div className={`inset-0 bg-stone-50 rounded-2xl p-5 flex flex-col rotate-y-180 backface-hidden ${isGlobalFlipped ? 'block' : 'hidden'}`}>
                    <div className="leading-relaxed text-stone-800 font-medium text-lg mb-1">{content.translated}</div>
                </div>
            </div>
        </div>
    );
};

const AnalysisView: React.FC<Props> = ({ image, analysis, onBack, settings, chatHistory, onUpdateChatHistory }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isGlobalFlipped, setIsGlobalFlipped] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const t = getTranslation(settings.systemLanguage);
  const hasStructuredPrompts = !!analysis.structuredPrompts;

  const modules = hasStructuredPrompts ? [
      { title: 'Subject', label: t.lblSubject, color: 'text-coral', content: analysis.structuredPrompts?.subject },
      { title: 'Environment', label: t.lblEnvironment, color: 'text-mint', content: analysis.structuredPrompts?.environment },
      { title: 'Composition', label: t.lblComposition, color: 'text-softblue', content: analysis.structuredPrompts?.composition },
      { title: 'Lighting', label: t.lblLighting, color: 'text-sunny', content: analysis.structuredPrompts?.lighting },
      { title: 'Mood', label: t.lblMood, color: 'text-softblue', content: analysis.structuredPrompts?.mood },
      { title: 'Style', label: t.lblStyle, color: 'text-stone-500', content: analysis.structuredPrompts?.style },  
  ] : [
      { title: 'Description', label: t.lblDescription, color: 'text-softblue', content: { original: analysis.description, translated: t.transUnavailable } }
  ];

  const handleGlobalCopy = async () => {
      const allowed = settings.copyIncludedModules || ["Subject", "Environment", "Composition", "Lighting", "Mood", "Style"];
      const text = modules.filter(m => allowed.includes(m.title)).map(m => {
          const contentToUse = isGlobalFlipped ? m.content.translated : m.content.original;
          return `[${m.title}]\n${contentToUse}`;
      }).join('\n\n');

      // ✅ 3. 使用强壮的复制函数
      const success = await copyToClipboard(text);
      if (success) {
          alert(isGlobalFlipped ? t.msgCopiedConfig : t.msgCopied);
      } else {
          // 如果真的都失败了（极少情况），给个提示
          alert("Copy failed. Please select text manually.");
      }
  };

  const handleCopyImage = async () => {
      try {
          const img = new Image(); img.crossOrigin = "anonymous"; img.src = image;
          await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
          const canvas = document.createElement("canvas"); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas context failed");
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(async (blob) => {
              if (blob) { 
                  // 图片复制比较特殊，仍然尝试使用 API，因为 execCommand 不支持图片
                  try {
                    await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]); 
                    alert(t.msgImgCopied); 
                  } catch (e) {
                    alert(t.msgImgFail);
                  }
              }
          }, 'image/png');
      } catch (e) { alert(t.msgImgFail); }
  };
  
  const handleDownloadImage = () => {
      const link = document.createElement('a'); link.href = image; link.download = `snaplex-${Date.now()}.png`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="pb-0 bg-cream min-h-screen flex flex-col">
       <style>{`.perspective-1000 { perspective: 1000px; } .style-preserve-3d { transform-style: preserve-3d; } .rotate-y-180 { transform: rotateY(180deg); } .backface-hidden { backface-visibility: hidden; }`}</style>
      {isZoomed && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 animate-[fadeIn_0.2s]" onClick={() => setIsZoomed(false)}>
              <div className="relative max-w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  <img src={image} alt="Zoomed" className="rounded-xl object-contain max-h-[85vh] shadow-2xl" />
                  <button onClick={() => setIsZoomed(false)} className="absolute -top-12 right-0 text-white hover:text-coral transition-colors"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
              </div>
          </div>
      )}
      <div className="relative group shrink-0">
        <div className="h-96 w-full bg-stone-100 overflow-hidden relative">
             <img src={image} alt="Analysis" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105 cursor-pointer" onClick={() => setIsZoomed(true)}/>
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
        </div>
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
            <button onClick={onBack} className="w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors border border-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <div className="flex gap-2">
                 <button onClick={handleCopyImage} className="w-10 h-10 bg-black/30 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/50 transition-colors border border-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                <button onClick={() => setIsZoomed(true)} className="w-10 h-10 bg-black/30 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/50 transition-colors border border-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg></button>
                <button onClick={handleDownloadImage} className="w-10 h-10 bg-black/30 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/50 transition-colors border border-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
            </div>
        </div>
      </div>
      <div className="flex-1 bg-cream rounded-t-[2.5rem] -mt-8 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col">
        <div className={`flex-1 flex flex-col h-full relative ${showChat ? 'flex' : 'hidden'}`}>
             <button onClick={() => setShowChat(false)} className="absolute top-4 right-6 z-30 text-stone-400 hover:text-stone-800 p-2 bg-white/50 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
             <ChatBot messages={chatHistory} onUpdateMessages={onUpdateChatHistory} imageContext={image} systemLanguage={settings.systemLanguage} settings={settings}/>
        </div>
        <div className={`px-6 py-8 flex-1 ${showChat ? 'hidden' : 'block'}`}>
                <div className="flex justify-center items-center gap-3 mb-10">
                    <button onClick={handleGlobalCopy} className="flex items-center gap-2 bg-stone-800 text-white px-6 py-3 rounded-full shadow-lg active:scale-95 transition-transform hover:bg-stone-700"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span className="font-bold text-sm">{t.btnCopyAll}</span></button>
                    <button onClick={() => setIsGlobalFlipped(!isGlobalFlipped)} className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm border transition-all active:scale-95 ${isGlobalFlipped ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-800 border-stone-200 hover:border-stone-400'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
                </div>
                <div className="space-y-4 pb-20">
                    {modules.map((mod, i) => (
                        <div key={i} className="animate-[fadeIn_0.5s]" style={{animationDelay: `${i * 0.1}s`}}>
                            <PromptCard title={mod.title} systemLabel={mod.label} content={mod.content} color={mod.color} isGlobalFlipped={isGlobalFlipped} />
                        </div>
                    ))}
                </div>
                <button onClick={() => setShowChat(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-stone-800 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-40 border-2 border-cream"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" /></svg></button>
            </div>
      </div>
    </div>
  );
};

export default AnalysisView;