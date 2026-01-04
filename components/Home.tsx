import React, { useRef, useState } from 'react';
import { getTranslation } from '../translations';
import BentoBox from './BentoBox';
import CrabProgressBar from './CrabProgressBar';

interface Props {
  onImageUpload: (files: File[]) => void;
  systemLanguage?: string;
  isAnalyzing?: boolean;
  analysisProgress?: number;
}

const Home: React.FC<Props> = ({ onImageUpload, systemLanguage, isAnalyzing = false, analysisProgress = 0 }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const t = getTranslation(systemLanguage);

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

  // Feature data for the Bento boxes
  const features = [
    { title: 'Deep Visual Mining', icon: '⛏️', color: 'bg-mint', desc: 'Extract hidden details' },
    { title: '7-Lang Library', icon: '🌍', color: 'bg-softblue', desc: 'Multilingual style terms' },
    { title: 'Semantic Search', icon: '🔍', color: 'bg-coral', desc: 'Find by meaning' },
  ];

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
      <div className="md:hidden p-6 flex flex-col items-center justify-center min-h-[80vh] text-center pt-20">
        {/* Logo Area */}
        <div className="w-full max-w-md animate-[float_6s_ease-in-out_infinite]">
          <div className="bg-sunny w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-pop rotate-3 transition-transform hover:rotate-6">
            <svg className="w-12 h-12 text-stone-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        <h2 className="text-4xl font-black text-stone-800 mb-3 tracking-tight">{t.homeTitle}</h2>
        <p className="text-stone-500 text-lg mb-12 max-w-xs mx-auto font-medium">{t.homeSubtitle}</p>

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

      {/* ===================== DESKTOP BENTO LAYOUT ===================== */}
      <div className="hidden md:grid grid-cols-12 gap-4 p-6 pt-20 min-h-screen overflow-auto">

        {/* LEFT COLUMN: Hero + Upload (spans 7 columns) */}
        <div className="col-span-7 flex flex-col gap-4 h-full">

          {/* Hero Title Box */}
          <BentoBox bgColor="bg-cream" className="flex-shrink-0 p-8">
            <h1 className="text-5xl lg:text-6xl font-black text-stone-800 tracking-tight leading-tight mb-2">
              Vision to Prompt.
            </h1>
            <p className="text-2xl lg:text-3xl font-bold text-stone-500">
              Gateway to knowledge.
            </p>
            <p className="text-sm text-stone-400 mt-2 font-medium">解码视觉提示，探寻知识入口</p>
          </BentoBox>

          {/* Drop Zone / Upload Box */}
          <BentoBox
            bgColor={isDragOver ? 'bg-sunny/80' : 'bg-sunny'}
            className={`flex-1 flex flex-col items-center justify-center cursor-pointer transition-all relative ${isDragOver ? 'scale-[1.01]' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-8"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {/* Mascot */}
              <div className={`w-32 h-32 bg-white rounded-[2rem] flex items-center justify-center shadow-pop mb-6 transition-transform ${isDragOver ? 'scale-110 rotate-6' : 'animate-[float_4s_ease-in-out_infinite]'}`}>
                <svg className="w-16 h-16 text-stone-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>

              <p className="text-xl font-bold text-stone-800 mb-2">
                {isDragOver ? 'Drop it!' : 'Drop Image Here'}
              </p>
              <p className="text-sm text-stone-600">or click to browse</p>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8">
                <button
                  onClick={(e) => { e.stopPropagation(); startCamera(); }}
                  className="px-6 py-3 bg-stone-800 text-white rounded-full font-bold flex items-center gap-2 hover:bg-stone-700 transition-colors shadow-pop-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Snap
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-6 py-3 bg-white text-stone-800 rounded-full font-bold flex items-center gap-2 hover:bg-stone-100 transition-colors border-2 border-stone-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Batch Upload
                </button>
              </div>
            </div>
          </BentoBox>
        </div>

        {/* RIGHT COLUMN: Feature Boxes (spans 5 columns) */}
        <div className="col-span-5 flex flex-col gap-4 h-full">
          {features.map((feature, idx) => (
            <BentoBox
              key={idx}
              bgColor={feature.color}
              className="flex-1 p-6 flex flex-col justify-center group"
            >
              <span className="text-4xl mb-3 group-hover:scale-110 transition-transform inline-block">{feature.icon}</span>
              <h3 className="text-xl font-black text-stone-900">{feature.title}</h3>
              <p className="text-sm text-stone-700/80 mt-1">{feature.desc}</p>
            </BentoBox>
          ))}
        </div>

        {/* FOOTER STATUS BAR (Full Width) */}
        <div className="col-span-12 h-14 bg-stone-800 rounded-xl flex items-center justify-between px-6 text-cream border-4 border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
          {isAnalyzing ? (
            <div className="flex-1 flex items-center gap-4">
              <span className="text-xs font-bold text-sunny animate-pulse">Analyzing...</span>
              <div className="flex-1 max-w-md">
                <CrabProgressBar progress={analysisProgress} isComplete={analysisProgress >= 100} />
              </div>
            </div>
          ) : (
            <>
              <span className="font-mono text-xs tracking-wide opacity-70">SNAPLEX v9.0</span>
              <div className="flex items-center gap-4 text-sm font-medium">
                <span>Designed by Ginger</span>
                <a href="mailto:contact@snaplex.app" className="hover:text-sunny transition-colors">contact@snaplex.app</a>
                <div className="flex gap-2">
                  <a href="#" className="hover:text-sunny transition-colors">𝕏</a>
                  <a href="#" className="hover:text-sunny transition-colors">IG</a>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
    </>
  );
};

export default Home;