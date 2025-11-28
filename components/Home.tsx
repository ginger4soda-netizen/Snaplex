import React, { useRef, useState } from 'react';
import { getTranslation } from '../translations';

interface Props {
  onImageUpload: (files: File[]) => void;
  systemLanguage?: string; // 接收语言设置
}

const Home: React.FC<Props> = ({ onImageUpload, systemLanguage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ✅ 核心修复：直接使用传入的 systemLanguage，不再使用 useState 自己去读数据库
  const t = getTranslation(systemLanguage);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImageUpload(Array.from(e.target.files));
    }
    e.target.value = '';
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
      alert(t.errCamera); // 使用翻译后的错误提示
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

  return (
    <>
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

        <div className="p-6 flex flex-col items-center justify-center min-h-[80vh] text-center">
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
                {/* ✅ 修改点：移除了 <span>{t.btnCamera}</span> */}
                <button 
                    onClick={startCamera}
                    className="flex-1 aspect-square bg-stone-800 text-white rounded-3xl shadow-pop-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-2 hover:bg-stone-700 hover:-translate-y-1"
                    aria-label={t.btnCamera} // 保持可访问性
                >
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>

                {/* ✅ 修改点：移除了 <span>{t.btnUpload}</span> */}
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
    </>
  );
};

export default Home;