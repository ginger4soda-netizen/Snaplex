import React from 'react';
import { AppMode } from '../types';

interface HeaderProps {
    currentMode: AppMode;
    setMode: (mode: AppMode) => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, setMode }) => {
    const getAccentStyles = () => {
        switch (currentMode) {
            case 'home': return 'border-softblue shadow-[4px_4px_0px_0px_rgba(17,138,178,0.4)]';
            case 'printer': return 'border-coral shadow-[4px_4px_0px_0px_rgba(239,71,111,0.4)]';
            case 'history': return 'border-sunny shadow-[4px_4px_0px_0px_rgba(255,191,105,0.4)]';
            default: return 'border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
        }
    };

    const getTextColor = (mode: AppMode, activeColor: string) => {
        if (currentMode === mode) return activeColor;
        return 'text-stone-900 hover:text-stone-600';
    };

    return (
        <>
            {/* Mobile Header - Restored Version */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
                <div className="w-full max-w-screen-md bg-cream/95 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-stone-100 pointer-events-auto shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                    {/* Logo */}
                    <div
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => setMode('home')}
                    >
                        <div className="px-3 py-1 border-2 border-softblue rounded-lg flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(17,138,178,1)] bg-white group-active:translate-y-0.5 group-active:shadow-none transition-all">
                            <h1 className="font-extrabold text-xl text-softblue tracking-tight">Snaplex</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Printer / Collection Gallery Button */}
                        <button
                            onClick={() => setMode(currentMode === 'printer' ? 'home' : 'printer')}
                            className={`p-2 rounded-full transition-all shadow-pop-sm active:translate-y-1 active:shadow-none ${currentMode === 'printer' ? 'bg-coral text-white' : 'bg-white text-stone-600 hover:text-coral'}`}
                            title="Style Printer & Collection"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </button>

                        {/* Settings Button */}
                        <button
                            onClick={() => setMode(currentMode === 'settings' ? 'home' : 'settings')}
                            className={`p-2 rounded-full transition-all shadow-pop-sm active:translate-y-1 active:shadow-none ${currentMode === 'settings' ? 'bg-stone-800 text-white' : 'bg-white text-stone-600'}`}
                            title="Settings"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>

                        {/* History Button */}
                        <button
                            onClick={() => setMode(currentMode === 'history' ? 'home' : 'history')}
                            className={`p-2 rounded-full transition-all shadow-pop-sm active:translate-y-1 active:shadow-none ${currentMode === 'history' ? 'bg-softblue text-white' : 'bg-white text-stone-600'}`}
                            title="History"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Desktop Header - Original Hidden on Mobile */}
            <header className="hidden md:flex fixed top-10 left-0 right-0 z-50 justify-center pointer-events-none transition-all duration-500">
                {/* Box Navigation Container - Horizontal Capsule */}
                <div className={`pointer-events-auto flex items-center bg-white border-2 rounded-full overflow-hidden transition-all duration-300 ${getAccentStyles()}`}>

                    {/* Left Section: WORDBANK */}
                    <button
                        onClick={() => setMode('printer')}
                        className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-colors border-r border-stone-100 bg-white ${getTextColor('printer', 'text-coral')}`}
                    >
                        Wordbank
                    </button>

                    {/* Center: Logo / SNAPLEX */}
                    <button
                        onClick={() => setMode('home')}
                        className={`px-10 py-2.5 bg-white hover:bg-cream transition-colors border-x border-transparent`}
                    >
                        <span className={`text-xl font-normal transition-colors ${getTextColor('home', 'text-softblue')}`} style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                            Snaplex
                        </span>
                    </button>

                    {/* Right Section: LIBRARY */}
                    <button
                        onClick={() => setMode('history')}
                        className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-colors border-l border-stone-100 bg-white ${getTextColor('history', 'text-sunny')}`}
                    >
                        Library
                    </button>
                </div>

                {/* Settings: Floating Icon - Vertical Capsule */}
                <button
                    onClick={() => setMode(currentMode === 'settings' ? 'home' : 'settings')}
                    className={`pointer-events-auto ml-4 px-3 py-4 rounded-full border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-0.5 active:shadow-none ${currentMode === 'settings' ? 'bg-stone-900 text-white' : 'bg-white text-stone-900 hover:bg-stone-50'}`}
                    title="Settings"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </header>
        </>
    );
};

export default Header;