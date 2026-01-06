import React, { useRef, useState, useEffect } from 'react';
import { getTranslation } from '../translations';
import BentoBox from './BentoBox';
import CrabProgressBar from './CrabProgressBar';
import AnimatedText from './AnimatedText';

interface Props {
  onImageUpload: (files: File[]) => void;
  systemLanguage?: string;
  isAnalyzing?: boolean;
  analysisProgress?: number;
  onLanguageChange?: (lang: string) => void;
}

const Home: React.FC<Props> = ({ onImageUpload, systemLanguage, isAnalyzing = false, analysisProgress = 0, onLanguageChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const t = getTranslation(systemLanguage);

  useEffect(() => {
    // Reveal animation sequence
    const timer = setTimeout(() => setShowSubtitle(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Typing animation state
  const typingWords = ["close-up", "red", "horror", "two-shot"];
  const [typingText, setTypingText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = typingWords[wordIndex];
    const typeSpeed = isDeleting ? 50 : 150;
    const holdTime = 1000;

    if (!isDeleting && typingText === currentWord) {
      const timeout = setTimeout(() => setIsDeleting(true), holdTime);
      return () => clearTimeout(timeout);
    } else if (isDeleting && typingText === "") {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % typingWords.length);
      return;
    }

    const timer = setTimeout(() => {
      const nextText = currentWord.substring(0, typingText.length + (isDeleting ? -1 : 1));
      setTypingText(nextText);
    }, typeSpeed);

    return () => clearTimeout(timer);
  }, [typingText, isDeleting, wordIndex]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImageUpload(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onImageUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch (err) {
      console.error(err);
      alert(t.errCamera);
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            onImageUpload([new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" })]);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  // Tag list for Deep Visual Mining (Localized)
  const miningTags = t.miningTags || [
    "Subject", "Environment", "Composition", "Lighting", "Mood", "Style",
    "Inspiration Site", "Text & Font", "Material & Texture", "Camera & Lens"
  ];

  // Language list for Multilanguage Support
  const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'zh', name: 'Chinese', native: '中文' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'ja', name: 'Japanese', native: '日本語' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'kr', name: 'Korean', native: '한국어' },
  ];

  // Search keywords
  const searchKeywords = t.searchKeywords || ["Horror", "Close-up", "Red", "Cover Design"];

  // Helper to check if a language is active
  const isLangActive = (langName: string) => {
    // Basic check: if systemLanguage contains language name or starts with it
    const current = systemLanguage || 'English';
    return current.toLowerCase().includes(langName.toLowerCase());
  };

  // Helper for dynamic title size based on language
  const getHomeMainTitleSize = (lang: string) => {
    // English defaults
    // Chinese: Larger (User request)
    // Others (ES, DE, FR, JA, KR): Smaller to prevent wrap
    if (!lang) return "text-7xl xl:text-7xl"; // Default fallback
    if (lang.includes('Chinese')) return "text-7xl xl:text-8xl";
    if (lang.includes('English')) return "text-7xl xl:text-7xl";
    return "text-5xl xl:text-6xl";
  };

  const getHomeSubtitleSize = (lang: string) => {
    if (!lang) return "text-4xl xl:text-5xl"; // Default fallback
    if (lang.includes('Chinese')) return "text-5xl xl:text-6xl";
    if (lang.includes('English')) return "text-4xl xl:text-5xl";
    return "text-3xl xl:text-4xl";
  };

  return (
    <>
      {/* Camera Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-[fadeIn_0.3s_ease-out]">
          <div className="relative flex-1 bg-black overflow-hidden">
            <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          </div>
          <div className="h-32 bg-black/80 backdrop-blur-sm flex items-center justify-center gap-12 pb-safe">
            <button onClick={stopCamera} className="p-4 bg-stone-800/50 rounded-full text-white hover:bg-stone-700/50 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-stone-300 shadow-[0_0_0_4px_rgba(255,255,255,0.3)] active:scale-95 transition-transform" />
            <div className="w-14" />
          </div>
        </div>
      )}

      {/* ===================== MOBILE LAYOUT (Default) ===================== */}
      <div className="md:hidden p-6 flex flex-col items-center justify-center min-h-[90vh] text-center pt-32 bg-cream">
        <h2 className="text-4xl font-black text-stone-800 mb-2 tracking-tight animate-[fadeInUp_0.8s_ease-out]">{t.homeTitle}</h2>
        <p className={`text-2xl font-bold text-stone-500 mb-12 transition-opacity duration-1000 ${showSubtitle ? 'opacity-100' : 'opacity-0'}`}>
          {t.homeTitle2}
        </p>

        <div className="flex gap-5 w-full max-w-sm px-4">
          <button
            onClick={startCamera}
            className="flex-1 aspect-square bg-stone-800 text-white rounded-3xl shadow-pop-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-2 hover:bg-stone-700 hover:-translate-y-1"
            aria-label={t.btnCamera}
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 aspect-square bg-white text-stone-800 border-2 border-stone-100 rounded-3xl shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-2 hover:border-softblue hover:text-softblue hover:-translate-y-1"
            aria-label={t.btnUpload}
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </button>
        </div>

        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
      </div>

      {/* ===================== DESKTOP GRID LAYOUT ===================== */}
      <div className="hidden md:grid grid-cols-12 gap-6 px-10 py-8 pt-40 min-h-screen bg-[#FDFBF7] max-w-[1600px] mx-auto overflow-auto pb-24">

        {/* 1. TOP SECTION: Title (Left 6) + Upload (Right 6) */}
        {/* ROW 1 */}
        <div className="col-span-12 grid grid-cols-12 gap-6 min-h-[300px]">
          {/* TITLE AREA (Col 6) */}
          <div className="col-span-6 flex flex-col justify-center px-4 items-end text-right">
            <AnimatedText
              text={t.homeMainTitle || 'Vision to Prompt'}
              as="h1"
              className={`${getHomeMainTitleSize(systemLanguage)} font-black text-stone-900 tracking-tight leading-none mb-4`}
              baseDelay={0.2}
              staggerDelay={0.04}
            />
            <AnimatedText
              text={t.homeSubtitle1 || 'Turn Visual Inspiration'}
              as="h2"
              className={`${getHomeSubtitleSize(systemLanguage)} font-black text-stone-400 tracking-tight leading-snug mb-2`}
              baseDelay={0.6}
              staggerDelay={0.03}
            />
            <AnimatedText
              text={t.homeSubtitle2 || 'into Prompt Library'}
              as="h2"
              className={`${getHomeSubtitleSize(systemLanguage)} font-black text-stone-400 tracking-tight leading-snug`}
              baseDelay={1.0}
              staggerDelay={0.03}
            />
          </div>

          {/* UPLOAD BOX (Col 6) */}
          <div className="col-span-6">
            <BentoBox
              bgColor={isDragOver ? 'bg-[#FDE68A]' : 'bg-[#FCD34D]'} // lighter yellow
              className={`h-full border-none flex flex-col items-center justify-center cursor-pointer relative group transition-all duration-300 shadow-[8px_8px_0px_0px_#B45309] hover:shadow-[12px_12px_0px_0px_#B45309] hover:-translate-y-1 ${isDragOver ? 'scale-[1.02]' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div
                className="absolute inset-0 flex flex-col items-center justify-center p-8"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-10 h-10 text-stone-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </div>
                <p className="text-3xl font-bold text-stone-900 mb-2">{isDragOver ? t.uploadDropIt : t.uploadDropHere}</p>
                <p className="text-stone-700/60 font-medium text-lg mb-8">{t.uploadClickBrowse}</p>
                <div className="flex gap-4 w-full justify-center">
                  <button onClick={(e) => { e.stopPropagation(); startCamera(); }} className="px-10 py-3 bg-black text-white rounded-full font-bold hover:bg-stone-800 transition-colors flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 duration-200" aria-label={t.btnCamera}>
                    <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </BentoBox>
          </div>
        </div>

        {/* 2. FEATURE AREA - ROW 1 (3 items, 4 cols each) */}
        {/* Features: Structured, Insight, Library */}
        <div className="col-span-12 xl:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 h-full min-h-[200px]">
            <BentoBox bgColor="bg-[#3D5A3D]" className="h-full border-none shadow-[8px_8px_0px_0px_#6B8E6B] hover:shadow-[12px_12px_0px_0px_#6B8E6B] hover:-translate-y-1 p-6 relative overflow-hidden group flex flex-col">
              <div>
                <h3 className="text-2xl font-black text-white mb-3 leading-none">{t.featureStructuredTitle}</h3>
                <p className="text-sm font-bold text-white/80 mb-3 leading-tight max-w-[90%]">{t.featureStructuredSubtitle}</p>
              </div>
              <div className="flex-1 flex flex-col justify-center relative z-10">
                <div className="flex flex-wrap gap-2">
                  {[t.lblSubject, t.lblEnvironment, t.lblComposition, t.lblLighting, t.lblMood, t.lblStyle].map((tag, i) => (
                    <span key={i} className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-black text-white border border-white/30 shadow-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="absolute top-4 right-4 text-4xl opacity-70 group-hover:opacity-100 transition-opacity z-20">🏗️</div>
            </BentoBox>
          </div>

          <div className="col-span-1 h-full min-h-[200px]">
            <BentoBox bgColor="bg-[#C53030]" className="h-full border-none shadow-[8px_8px_0px_0px_#FDE68A] hover:shadow-[12px_12px_0px_0px_#FDE68A] hover:-translate-y-1 p-6 relative overflow-hidden group flex flex-col">
              <div>
                <h3 className="text-2xl font-black text-[#F6E05E] mb-3 leading-none">{t.featureInsightTitle}</h3>
                <p className="text-sm font-bold text-[#F6E05E]/80 mb-3 leading-tight max-w-[90%]">{t.featureInsightSubtitle}</p>
              </div>
              <div className="flex-1 flex flex-col justify-center relative z-10">
                <div className="flex flex-wrap gap-2">
                  {t.chatChips?.slice(0, 5).map((chip, i) => (
                    <span key={i} className="px-3 py-1.5 bg-[#F6E05E]/20 backdrop-blur-sm rounded-lg text-xs font-black text-[#F6E05E] border border-[#F6E05E]/30 shadow-sm">
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="absolute top-4 right-4 text-4xl opacity-70 group-hover:opacity-100 transition-opacity z-20">💡</div>
            </BentoBox>
          </div>

          <div className="col-span-1 h-full min-h-[200px]">
            <BentoBox bgColor="bg-[#6B5B95]" className="h-full border-none shadow-[8px_8px_0px_0px_#F5B7B1] hover:shadow-[12px_12px_0px_0px_#F5B7B1] hover:-translate-y-1 p-6 relative overflow-hidden group flex flex-col">
              <div className="flex justify-between items-start mb-3 relative z-10">
                <div>
                  <h3 className="text-2xl font-black text-[#F5B7B1] mb-3 leading-none">{t.featureLangTitle}</h3>
                  <p className="text-sm font-bold text-[#F5B7B1]/80 leading-tight">{t.featureLangSubtitle}</p>
                </div>
                <span className="text-3xl z-20 opacity-70 group-hover:opacity-100 transition-opacity">🌍</span>
              </div>

              <div className="flex-1 flex flex-col justify-center relative z-10">
                <div className="flex items-center justify-between px-1 w-full">
                  {languages.map((lang, i) => (
                    <div
                      key={i}
                      className={`flex flex-col items-center gap-1 group cursor-pointer transition-transform duration-300 ${isLangActive(lang.name) ? 'scale-110' : 'hover:scale-110'}`}
                      onClick={(e) => { e.stopPropagation(); onLanguageChange && onLanguageChange(lang.name); }}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isLangActive(lang.name) ? 'bg-[#F5B7B1] text-[#6B5B95] shadow-sm' : 'bg-[#F5B7B1]/30 text-[#F5B7B1] group-hover:bg-[#F5B7B1]'}`}>
                        {lang.code.toUpperCase()}
                      </div>
                      <span className={`text-[9px] font-bold text-[#F5B7B1] transition-opacity ${isLangActive(lang.name) ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>{lang.native}</span>
                    </div>
                  ))}
                </div>
              </div>
            </BentoBox>
          </div>
        </div>
        {/* 3. FEATURE AREA - ROW 2 (4 items, 3 cols each) - Using grid-cols-4 for this row */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="h-full min-h-[160px]">
            <BentoBox bgColor="bg-[#A4B4C4]" className="h-full border-none shadow-[8px_8px_0px_0px_#7A8A9A] hover:shadow-[12px_12px_0px_0px_#7A8A9A] hover:-translate-y-1 p-6 relative overflow-hidden group flex flex-col">
              <h3 className="text-xl font-black text-[#E8E03C] mb-1 leading-none">{t.featureBatchTitle}</h3>
              <p className="text-xs font-bold text-[#E8E03C]/80 mt-2 mb-4 leading-relaxed">{t.featureBatchSubtitle}</p>
              <div className="flex -space-x-4 mt-auto relative z-10 pl-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-10 h-10 rounded-lg bg-[#E8E03C]/20 border-2 border-[#E8E03C] shadow-sm transform hover:-translate-y-2 transition-transform duration-300"></div>
                ))}
              </div>
              <div className="absolute top-4 right-4 text-3xl opacity-70 group-hover:opacity-100 transition-opacity z-20">📦</div>
            </BentoBox>
          </div>

          <div className="h-full min-h-[160px]">
            <BentoBox bgColor="bg-[#F5CCC3]" className="h-full border-none shadow-[8px_8px_0px_0px_#E8ADA0] hover:shadow-[12px_12px_0px_0px_#E8ADA0] hover:-translate-y-1 p-6 relative overflow-hidden group flex flex-col">
              <h3 className="text-xl font-black text-[#C53030] mb-1 leading-none">{t.featurePrinterTitle}</h3>
              <p className="text-xs font-bold text-[#C53030]/80 mt-2 mb-4 leading-relaxed">{t.featurePrinterSubtitle}</p>
              <div className="mt-auto self-start bg-white border-2 border-[#C53030] rounded-lg px-3 py-2 relative z-10 w-full max-w-[120px] animate-[pulse_3s_infinite]">
                <div className="w-full h-1.5 bg-[#C53030]/30 mb-1.5 rounded-full"></div>
                <div className="w-2/3 h-1.5 bg-[#C53030]/30 rounded-full"></div>
              </div>
              <div className="absolute top-4 right-4 text-3xl opacity-70 group-hover:opacity-100 transition-opacity z-20">🖨️</div>
            </BentoBox>
          </div>

          <div className="h-full min-h-[160px]">
            <BentoBox bgColor="bg-[#FDF5E6]" className="h-full border-none shadow-[8px_8px_0px_0px_#C4A77D] hover:shadow-[12px_12px_0px_0px_#C4A77D] hover:-translate-y-1 p-6 relative overflow-hidden group flex flex-col">
              <h3 className="text-xl font-black text-[#6B4423] mb-1 leading-none">{t.featureLibraryTitle}</h3>
              <p className="text-xs font-bold text-[#6B4423]/80 mt-2 mb-4 leading-relaxed">{t.featureLibrarySubtitle}</p>
              {/* Compact Search Bar */}
              <div className="mt-auto bg-white border-2 border-[#6B4423] rounded-lg px-3 py-2 flex items-center gap-2 shadow-sm relative z-10">
                <svg className="w-3 h-3 text-[#6B4423]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <div className="h-4 flex items-center overflow-hidden">
                  <span className="font-bold text-[#6B4423]/60 font-mono text-xs whitespace-nowrap">{typingText}</span>
                  <span className="w-1 h-3 bg-[#6B4423] ml-0.5 animate-pulse"></span>
                </div>
              </div>
              <div className="absolute top-4 right-4 text-3xl opacity-70 group-hover:opacity-100 transition-opacity z-20">📚</div>
            </BentoBox>
          </div>

          <div className="h-full min-h-[160px]">
            <BentoBox bgColor="bg-[#E5E7EB]" className="h-full border-none shadow-[8px_8px_0px_0px_#6B8E23] hover:shadow-[12px_12px_0px_0px_#6B8E23] hover:-translate-y-1 p-6 relative overflow-hidden group flex flex-col">
              <h3 className="text-xl font-black text-[#556B2F] mb-1 leading-none">{t.featureHistoryTitle}</h3>
              <p className="text-xs font-bold text-[#556B2F]/80 mt-2 mb-4 leading-relaxed">{t.featureHistorySubtitle}</p>
              <div className="absolute bottom-4 right-4 text-5xl opacity-70 group-hover:opacity-100 transition-opacity z-20">💾</div>
            </BentoBox>
          </div>
        </div >


        {/* FOOTER (Full Width) */}
        <div className="col-span-12 flex flex-col gap-2 mt-6">
          <p className="text-center text-stone-500 font-medium text-sm">
            {t.homeInstruction}
          </p>
          <div className="w-full h-14 bg-stone-900 rounded-xl flex items-center justify-between px-6 text-cream shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
            {isAnalyzing ? (
              <div className="flex-1 flex items-center gap-4">
                <span className="text-xs font-bold text-sunny animate-pulse">Analyzing...</span>
                <div className="flex-1 max-w-md">
                  <CrabProgressBar progress={analysisProgress} isComplete={analysisProgress >= 100} />
                </div>
              </div>
            ) : (
              <>
                <span className="font-mono text-xs tracking-wide opacity-50">SNAPLEX v9.5</span>
                <div className="flex items-center gap-6 text-sm font-medium">
                  <div className="flex items-center gap-3">
                    <a href="mailto:ginger4soda@gmail.com" className="text-stone-400 hover:text-sunny transition-colors">ginger4soda@gmail.com</a>
                  </div>

                  <div className="h-4 w-px bg-stone-700"></div>

                  <div className="flex gap-4">
                    <a href="https://x.com/gingersoda216" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-white transition-colors" aria-label="X (Twitter)">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    </a>
                    <a href="https://www.youtube.com/@haileybean88" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-white transition-colors" aria-label="YouTube">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                    </a>
                    <a href="https://xhslink.com/m/5jT6p1mxPSG" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-white transition-colors" aria-label="RedNote">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z" /></svg>
                    </a>
                    <a href="https://github.com/ginger4soda-netizen/Snaplex" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-white transition-colors" aria-label="GitHub">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
    </>
  );
};

export default Home;