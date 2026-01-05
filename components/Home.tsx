import React, { useRef, useState, useEffect } from 'react';
import { getTranslation } from '../translations';
import BentoBox from './BentoBox';
import CrabProgressBar from './CrabProgressBar';

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
        <h2 className="text-4xl font-black text-stone-800 mb-2 tracking-tight animate-[fadeIn_0.8s_ease-out]">{t.homeTitle}</h2>
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
      <div className="hidden md:grid grid-cols-12 gap-6 px-10 py-8 pt-40 min-h-screen bg-[#FDFBF7] max-w-[1600px] mx-auto overflow-auto">

        {/* LEFT COLUMN: Header + Upload (7 columns) */}
        <div className="col-span-7 flex flex-col gap-4">
          {/* Header Text Area */}
          <div className="flex flex-col justify-center px-4 py-2 min-h-[200px]">
            <h1 className="text-6xl xl:text-7xl font-black text-stone-900 tracking-tight leading-none mb-4 animate-[fadeInUp_0.8s_ease-out]">
              {t.homeTitle}
            </h1>
            <p className={`text-3xl xl:text-4xl font-bold text-stone-400 transition-all duration-1000 transform ${showSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {t.homeTitle2}
            </p>
          </div>

          {/* Upload Box */}
          <BentoBox
            bgColor={isDragOver ? 'bg-[#FDE68A]' : 'bg-[#FCD34D]'} // lighter yellow
            className={`flex-1 border-none flex flex-col items-center justify-center cursor-pointer relative group transition-all duration-300 shadow-[8px_8px_0px_0px_#B45309] hover:shadow-[12px_12px_0px_0px_#B45309] hover:-translate-y-1 ${isDragOver ? 'scale-[1.02]' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-8"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] mb-8 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-stone-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <p className="text-2xl font-bold text-stone-900 mb-2">{isDragOver ? 'Drop it!' : 'Drop Image Here'}</p>
              <p className="text-stone-700/60 font-medium text-lg mb-8">or click to browse</p>
              <div className="flex gap-4 w-full max-w-sm px-8 justify-center">
                <button onClick={(e) => { e.stopPropagation(); startCamera(); }} className="w-36 py-4 bg-black text-white rounded-full font-bold hover:bg-stone-800 transition-colors flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </BentoBox>
        </div>


        {/* RIGHT COLUMN: Feature Boxes (5 columns) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">

          {/* 1. Deep Visual Mining */}
          <BentoBox
            bgColor="bg-[#6EE7B7]" // Emerald 300
            className="flex-1 border-none shadow-[8px_8px_0px_0px_#047857] hover:shadow-[12px_12px_0px_0px_#047857] hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col relative overflow-hidden"
          >
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black text-stone-900">{t.featureMiningTitle}</h3>
                  <p className="text-xs font-semibold text-stone-800/70 mt-1 w-full leading-relaxed">{t.featureMiningSubtitle}</p>
                </div>
                <span className="text-3xl">⌨️</span>
              </div>

              <div className="flex-1 flex flex-wrap content-start gap-2 mt-2">
                {miningTags.map((tag: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-white/40 rounded-full text-xs font-bold text-stone-800 border border-white/20 backdrop-blur-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </BentoBox>

          {/* 2. Multilanguage Support */}
          <BentoBox
            bgColor="bg-[#7DD3FC]" // Sky 300
            className="flex-1 border-none shadow-[8px_8px_0px_0px_#0369A1] hover:shadow-[12px_12px_0px_0px_#0369A1] hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-black text-stone-900">{t.featureLangTitle}</h3>
                <p className="text-xs font-semibold text-stone-800/70 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">{t.featureLangSubtitle}</p>
              </div>
              <span className="text-3xl">🌍</span>
            </div>
            <div className="flex-1 flex items-center justify-between px-1">
              {languages.map((lang, i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-1 group cursor-pointer transition-transform duration-300 ${isLangActive(lang.name) ? 'scale-110' : 'hover:scale-110'}`}
                  onClick={() => onLanguageChange && onLanguageChange(lang.name)}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isLangActive(lang.name) ? 'bg-white text-stone-900 shadow-sm' : 'bg-white/30 text-stone-900 group-hover:bg-white'}`}>
                    {lang.code.toUpperCase()}
                  </div>
                  <span className={`text-[10px] font-bold text-stone-700 transition-opacity ${isLangActive(lang.name) ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>{lang.native}</span>
                </div>
              ))}
            </div>
          </BentoBox>

          {/* 3. Semantic Search */}
          <BentoBox
            bgColor="bg-[#FCA5A5]" // Red 300
            className="flex-1 border-none shadow-[8px_8px_0px_0px_#BE123C] hover:shadow-[12px_12px_0px_0px_#BE123C] hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-black text-stone-900">{t.featureSearchTitle}</h3>
                <p className="text-xs font-semibold text-stone-800/70 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">{t.featureSearchSubtitle}</p>
              </div>
              <span className="text-3xl">🔍</span>
            </div>
            <div className="flex gap-3 overflow-hidden pb-1">
              {searchKeywords.slice(0, 3).map((kw: string, i: number) => (
                <div key={i} className="px-4 py-3 bg-white rounded-xl shadow-sm flex items-center gap-2 transform hover:-rotate-2 transition-transform cursor-default">
                  <div className="w-2 h-2 rounded-full bg-red-400/50"></div>
                  <span className="text-sm font-bold text-stone-800 whitespace-nowrap">{kw}</span>
                </div>
              ))}
            </div>
          </BentoBox>
        </div>

        {/* FOOTER (Full Width) */}
        <div className="col-span-12 flex flex-col gap-2 mt-24">
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