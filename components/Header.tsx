import React from 'react';
import { AppMode } from '../types';

interface HeaderProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, setMode }) => {
  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
      {/* Box Navigation Container */}
      <div className="pointer-events-auto flex items-center bg-white border-2 border-softblue rounded-lg shadow-[3px_3px_0px_0px_rgba(17,138,178,0.3)] overflow-hidden">

        {/* Left Section: WORDBANK */}
        <button
          onClick={() => setMode(currentMode === 'printer' ? 'home' : 'printer')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-r border-softblue/30 bg-white ${currentMode === 'printer' ? 'text-coral' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Wordbank
        </button>

        {/* Center: Logo */}
        <button
          onClick={() => setMode('home')}
          className="px-6 py-2.5 bg-white hover:bg-cream transition-colors"
        >
          <span className="font-black text-lg text-softblue tracking-tight" style={{ fontFamily: "'Nunito', sans-serif" }}>
            Snaplex
          </span>
        </button>

        {/* Right Section: LIBRARY */}
        <button
          onClick={() => setMode(currentMode === 'history' ? 'home' : 'history')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-l border-softblue/30 bg-white ${currentMode === 'history' ? 'text-sunny' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Library
        </button>
      </div>

      {/* Settings: Floating Icon */}
      <button
        onClick={() => setMode(currentMode === 'settings' ? 'home' : 'settings')}
        className={`pointer-events-auto ml-3 p-2.5 rounded-full border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-0.5 active:shadow-none ${currentMode === 'settings' ? 'bg-stone-800 text-white' : 'bg-white text-stone-700 hover:bg-stone-100'}`}
        title="Settings"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </header>
  );
};

export default Header;