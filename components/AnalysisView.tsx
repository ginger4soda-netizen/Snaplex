import React, { useState, useEffect, useCallback } from 'react';
import { AnalysisResult, UserSettings, ChatMessage, PromptSegment, DimensionKey, DimensionHistories } from '../types';
import { get, set } from 'idb-keyval';
import ChatBot from './ChatBot';
import { getTranslation } from '../translations';
import { copyToClipboard } from '../utils/clipboard';
import { regenerateDimension, translateText } from '../services/geminiService';

interface Props {
    image: string;
    analysis: AnalysisResult;
    onBack: () => void;
    settings: UserSettings;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    chatHistory: ChatMessage[];
    onUpdateChatHistory: (messages: ChatMessage[]) => void;
    historyItemId?: string; // For IndexedDB persistence
}

const COLOR_MAP: Record<string, string> = {
    'text-coral': '#EF476F', 'text-mint': '#06D6A0', 'text-softblue': '#118AB2', 'text-sunny': '#FFD166', 'text-stone-500': '#78716c',
};

const PromptCard: React.FC<{
    title: string;
    systemLabel: string;
    content: PromptSegment;
    color: string;
    isGlobalFlipped: boolean;
    dimensionKey: DimensionKey;
    history: PromptSegment[];
    currentIndex: number;
    onRefresh: () => Promise<void>;
    onNavigate: (direction: 'prev' | 'next') => void;
}> = ({ title, systemLabel, content, color, isGlobalFlipped, dimensionKey, history, currentIndex, onRefresh, onNavigate }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleCopy = async () => {
        const textToCopy = isGlobalFlipped ? content.translated : content.original;
        const success = await copyToClipboard(textToCopy);
        if (success) {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    };

    const hexColor = COLOR_MAP[color] || '#78716c';
    const hasHistory = history.length > 1;
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < history.length - 1;

    return (
        <div className="relative mb-6 perspective-1000">
            <div className="flex justify-between items-center mb-2 px-5">
                <div className={`text-[12px] font-black uppercase tracking-widest ${color} flex items-center gap-2`}>
                    {systemLabel}
                    {hasHistory && (
                        <span className="text-[10px] text-stone-400 font-normal">
                            ({currentIndex + 1}/{history.length})
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {/* History Navigation */}
                    {hasHistory && (
                        <>
                            <button
                                onClick={() => onNavigate('prev')}
                                disabled={!canGoPrev}
                                className="p-1.5 transition-colors text-stone-300 hover:text-stone-500 disabled:opacity-20 disabled:hover:text-stone-300"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button
                                onClick={() => onNavigate('next')}
                                disabled={!canGoNext}
                                className="p-1.5 transition-colors text-stone-300 hover:text-stone-500 disabled:opacity-20 disabled:hover:text-stone-300"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </>
                    )}
                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-1.5 transition-all text-stone-300 hover:text-stone-500 disabled:opacity-30"
                    >
                        <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    {/* Copy Button */}
                    <button onClick={handleCopy} className="p-1.5 transition-colors text-stone-300 hover:text-stone-500" style={{ color: isCopied ? hexColor : undefined }}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                </div>
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

const AnalysisView: React.FC<Props> = ({ image, analysis, onBack, settings, chatHistory, onUpdateChatHistory, historyItemId }) => {
    const [isZoomed, setIsZoomed] = useState(false);
    const [isGlobalFlipped, setIsGlobalFlipped] = useState(false);
    const [showChat, setShowChat] = useState(false);

    // Dimension history management
    const [dimensionHistories, setDimensionHistories] = useState<DimensionHistories>(() => {
        // Initialize with current prompts as first version - Defensively
        const initial: DimensionHistories = {};
        if (analysis.structuredPrompts) {
            (['subject', 'environment', 'composition', 'lighting', 'mood', 'style'] as DimensionKey[]).forEach(key => {
                const prompt = analysis.structuredPrompts?.[key];
                if (prompt) { // Only add if prompt exists
                    initial[key] = {
                        versions: [prompt],
                        currentIndex: 0
                    };
                }
            });
        }
        return initial;
    });

    // ... (Hooks remain the same) ...

    // Load persisted histories from IndexedDB
    useEffect(() => {
        if (!historyItemId) return;
        const loadHistories = async () => {
            try {
                const saved = await get(`dim_history_${historyItemId}`);
                if (saved) setDimensionHistories(saved);
            } catch (e) {
                console.error('Failed to load dimension histories:', e);
            }
        };
        loadHistories();
    }, [historyItemId]);

    // Save histories to IndexedDB
    const saveHistories = useCallback(async (histories: DimensionHistories) => {
        setDimensionHistories(histories);
        if (historyItemId) {
            try {
                await set(`dim_history_${historyItemId}`, histories);
            } catch (e) {
                console.error('Failed to save dimension histories:', e);
            }
        }
    }, [historyItemId]);

    // Regenerate a dimension
    const handleRegenerateDimension = useCallback(async (dimensionKey: DimensionKey) => {
        try {
            const newPrompt = await regenerateDimension(image, dimensionKey, settings);

            // ✅ Use functional setState to avoid race conditions during concurrent refreshes
            setDimensionHistories(prev => {
                const currentHistory = prev[dimensionKey];
                const newVersions = currentHistory
                    ? [...currentHistory.versions, newPrompt]
                    : [newPrompt];

                const updated = {
                    ...prev,
                    [dimensionKey]: {
                        versions: newVersions,
                        currentIndex: newVersions.length - 1
                    }
                };

                // ✅ Persist to IndexedDB asynchronously
                if (historyItemId) {
                    set(`dim_history_${historyItemId}`, updated).catch(e =>
                        console.error('Failed to save dimension histories:', e)
                    );
                }

                return updated;
            });
        } catch (error) {
            console.error(`Failed to regenerate ${dimensionKey}:`, error);
            alert(`Failed to regenerate ${dimensionKey}`);
        }
    }, [image, settings, historyItemId]);

    // Navigate history for a dimension
    const handleNavigateHistory = useCallback((dimensionKey: DimensionKey, direction: 'prev' | 'next') => {
        const currentHistory = dimensionHistories[dimensionKey];
        if (!currentHistory) return;

        const newIndex = direction === 'prev'
            ? Math.max(0, currentHistory.currentIndex - 1)
            : Math.min(currentHistory.versions.length - 1, currentHistory.currentIndex + 1);

        if (newIndex !== currentHistory.currentIndex) {
            saveHistories({
                ...dimensionHistories,
                [dimensionKey]: { ...currentHistory, currentIndex: newIndex }
            });
        }
    }, [dimensionHistories, saveHistories]);



    const t = getTranslation(settings.systemLanguage);
    const hasStructuredPrompts = !!analysis.structuredPrompts;

    // Get current content for each dimension - SAFE ACCESS
    const getCurrentContent = (dimensionKey: DimensionKey): PromptSegment => {
        const history = dimensionHistories[dimensionKey];
        if (history && history.versions.length > 0) {
            return history.versions[history.currentIndex];
        }
        // Fallback to original if available, else empty safe object
        return analysis.structuredPrompts?.[dimensionKey] || { original: 'N/A', translated: 'N/A' };
    };

    const modules = hasStructuredPrompts ? [
        { title: 'Subject', label: t.lblSubject, color: 'text-coral', dimensionKey: 'subject' as DimensionKey, content: getCurrentContent('subject') },
        { title: 'Environment', label: t.lblEnvironment, color: 'text-mint', dimensionKey: 'environment' as DimensionKey, content: getCurrentContent('environment') },
        { title: 'Composition', label: t.lblComposition, color: 'text-softblue', dimensionKey: 'composition' as DimensionKey, content: getCurrentContent('composition') },
        { title: 'Lighting', label: t.lblLighting, color: 'text-sunny', dimensionKey: 'lighting' as DimensionKey, content: getCurrentContent('lighting') },
        { title: 'Mood', label: t.lblMood, color: 'text-softblue', dimensionKey: 'mood' as DimensionKey, content: getCurrentContent('mood') },
        { title: 'Style', label: t.lblStyle, color: 'text-stone-500', dimensionKey: 'style' as DimensionKey, content: getCurrentContent('style') },
    ] : [
        { title: 'Description', label: t.lblDescription, color: 'text-softblue', dimensionKey: 'subject' as DimensionKey, content: { original: analysis.description || 'No description available.', translated: t.transUnavailable } }
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
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        alert(t.msgImgCopied);
                    } catch (e) {
                        alert(t.msgImgFail);
                    }
                }
            }, 'image/png');
        } catch (e) { alert(t.msgImgFail); }
    };

    const handleShareImage = async () => {
        const shareElement = document.getElementById('share-long-image');
        if (!shareElement) return;
        try {
            // @ts-ignore
            const html2canvas = (await import('html2canvas')).default;
            // Temporarily make visible but hidden from user view
            shareElement.style.display = 'block';
            const canvas = await html2canvas(shareElement, { useCORS: true, backgroundColor: '#fefcf5', scale: 2 });
            shareElement.style.display = 'none';

            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `snaplex-share-${Date.now()}.png`;
            link.click();
        } catch (e) {
            console.error("Share capture failed", e);
            alert("Failed to generate share image.");
        }
    };

    const handleDownloadImage = () => {
        const link = document.createElement('a'); link.href = image; link.download = `snaplex-${Date.now()}.png`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
        <div className={`bg-cream flex flex-col md:flex-row md:h-screen md:overflow-hidden ${showChat ? 'h-[100dvh] overflow-hidden' : 'min-h-screen md:min-h-0'}`}>
            <style>{`.perspective-1000 { perspective: 1000px; } .style-preserve-3d { transform-style: preserve-3d; } .rotate-y-180 { transform: rotateY(180deg); } .backface-hidden { backface-visibility: hidden; }`}</style>

            {/* Hidden Long Image Template */}
            <div id="share-long-image" className="absolute left-[-9999px] top-0 w-[600px] bg-[#fefcf5] text-stone-800 font-sans" style={{ display: 'none' }}>
                <div className="relative">
                    {/* Full Image: No cropping */}
                    <img src={image} alt="Original" className="w-full h-auto object-contain" />
                </div>
                <div className="px-12 py-10 space-y-8">
                    {modules.map((mod, i) => (
                        <div key={i} className="py-1 text-center">
                            <div className={`text-sm font-black uppercase tracking-[0.2em] mb-3 ${mod.color}`}>{mod.label}</div>
                            {/* Slightly smaller text (text-base), more line height (leading-relaxed) */}
                            <div className="text-base font-medium leading-relaxed text-stone-700 max-w-lg mx-auto">{isGlobalFlipped ? mod.content.translated : mod.content.original}</div>
                        </div>
                    ))}
                </div>
                {/* Branding footer restored */}
                <div className="pb-10 text-center opacity-30 font-black text-xs tracking-[0.3em] uppercase">GENERATED BY SNAPLEX</div>
            </div>
            {isZoomed && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 animate-[fadeIn_0.2s]" onClick={() => setIsZoomed(false)}>
                    <div className="relative max-w-full max-h-[90vh] cursor-pointer" onClick={() => setIsZoomed(false)}>
                        <img src={image} alt="Zoomed" className="rounded-xl object-contain max-h-[85vh] shadow-2xl" />
                        <button onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }} className="absolute -top-12 right-0 text-white hover:text-coral transition-colors"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                </div>
            )}
            {/* ========== LEFT COLUMN: IMAGE (Desktop) / Top Section (Mobile) ========== */}
            <div className="relative group shrink-0 md:w-1/2 md:h-full md:sticky md:top-0">
                <div className={`${showChat ? 'h-32' : 'h-96'} md:h-full w-full bg-stone-100 overflow-hidden relative transition-all duration-300`}>
                    <img src={image} alt="Analysis" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105 cursor-pointer" onClick={() => setIsZoomed(true)} />
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
                </div>
                <div className="absolute top-20 md:top-4 left-4 right-4 md:right-auto flex justify-between md:justify-start md:gap-2 items-center z-10">
                    <button onClick={onBack} className="w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors border border-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                    <div className="flex gap-2 md:contents">
                        <button onClick={handleCopyImage} className="w-10 h-10 bg-black/30 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/50 transition-colors border border-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                        <button onClick={handleDownloadImage} className="w-10 h-10 bg-black/30 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-black/50 transition-colors border border-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                    </div>
                </div>
            </div>

            {/* ========== RIGHT COLUMN: DATA DECK (Desktop) / Content Area (Mobile) ========== */}
            <div className="flex-1 bg-cream rounded-t-[2.5rem] md:rounded-none -mt-10 md:mt-0 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] md:shadow-none overflow-hidden flex flex-col md:h-full md:overflow-y-auto">
                <div className={`flex-1 flex flex-col h-full relative ${showChat ? 'flex' : 'hidden'}`}>
                    <div className="flex justify-between items-center px-6 py-3 border-b border-stone-100 bg-white/50 backdrop-blur-md shrink-0">
                        <span className="text-xs font-black uppercase tracking-widest text-stone-400">{t.tabChat}</span>
                        <button onClick={() => setShowChat(false)} className="text-stone-400 hover:text-stone-800 p-1 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        <ChatBot messages={chatHistory} onUpdateMessages={onUpdateChatHistory} imageContext={image} systemLanguage={settings.systemLanguage} settings={settings} />
                    </div>
                </div>
                <div className={`px-6 py-8 flex-1 md:overflow-y-auto ${showChat ? 'hidden' : 'block'}`}>
                    <div className="flex justify-center items-center gap-4 mb-10 px-4">
                        <button onClick={handleShareImage} className="w-12 h-12 bg-white text-stone-800 rounded-full flex items-center justify-center shadow-sm border border-stone-200 hover:border-stone-400 transition-all active:scale-95"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></button>
                        <button onClick={handleGlobalCopy} className="flex items-center justify-center gap-2 bg-stone-800 text-white px-6 py-3 rounded-full shadow-lg active:scale-95 transition-transform hover:bg-stone-700"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span className="font-bold text-sm">{t.btnCopyAll}</span></button>
                        <button onClick={() => setIsGlobalFlipped(!isGlobalFlipped)} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm border transition-all active:scale-95 ${isGlobalFlipped ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-800 border-stone-200 hover:border-stone-400'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
                    </div>
                    <div className="space-y-4 pb-20 md:pb-8">
                        {modules.map((mod, i) => (
                            <div key={i} className="animate-[fadeIn_0.5s]" style={{ animationDelay: `${i * 0.1}s` }}>
                                <PromptCard
                                    title={mod.title}
                                    systemLabel={mod.label}
                                    content={mod.content}
                                    color={mod.color}
                                    isGlobalFlipped={isGlobalFlipped}
                                    dimensionKey={mod.dimensionKey}
                                    history={dimensionHistories[mod.dimensionKey]?.versions || [mod.content]}
                                    currentIndex={dimensionHistories[mod.dimensionKey]?.currentIndex || 0}
                                    onRefresh={() => handleRegenerateDimension(mod.dimensionKey)}
                                    onNavigate={(direction) => handleNavigateHistory(mod.dimensionKey, direction)}
                                />
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setShowChat(true)} className="fixed bottom-6 right-6 md:absolute w-14 h-14 bg-stone-800 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-40 border-2 border-cream"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" /></svg></button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;