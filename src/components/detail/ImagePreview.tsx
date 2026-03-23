import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface ImagePreviewProps {
  src: string;
  filename: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ src, filename }) => {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div
        className="relative aspect-video bg-stone-100 dark:bg-stone-800 overflow-hidden group cursor-pointer"
        onClick={() => setFullscreen(true)}
      >
        <img
          src={src}
          alt={filename}
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <svg className="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
        </div>
      </div>

      {/* Fullscreen overlay — rendered via portal to escape backdrop-filter containing block */}
      {fullscreen && createPortal(
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setFullscreen(false)}
        >
          <img
            src={src}
            alt={filename}
            className="max-w-[95vw] max-h-[95vh] object-contain"
          />
          <button
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setFullscreen(false)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">{filename}</p>
        </div>,
        document.body
      )}
    </>
  );
};

export default ImagePreview;
