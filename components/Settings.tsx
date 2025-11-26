import React from 'react';
import { UserSettings } from '../types';

interface Props {
    settings: UserSettings;
    onSave: (s: UserSettings) => void;
}

const LANGUAGES = [
    { code: 'English', label: 'English' },
    { code: 'Chinese', label: 'Chinese (中文)' },
    { code: 'Spanish', label: 'Spanish (Español)' },
    { code: 'Japanese', label: 'Japanese (日本語)' },
    { code: 'French', label: 'French (Français)' },
    { code: 'German', label: 'German (Deutsch)' },
    { code: 'Korean', label: 'Korean (한국어)' },
];

const MODULES = ["Subject", "Environment", "Composition", "Lighting", "Mood", "Style"];

const Settings: React.FC<Props> = ({ settings, onSave }) => {
    const styles = [
        { id: "Standard", label: "Standard", color: "bg-stone-200 text-stone-800", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
        { id: "Artistic", label: "Artistic", color: "bg-coral text-white", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
        { id: "Cinematic", label: "Cinematic", color: "bg-stone-800 text-white", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
        { id: "Technical", label: "Technical", color: "bg-softblue text-white", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
        { id: "UI/UX", label: "UI/UX", color: "bg-sunny text-stone-800", icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" },
        { id: "Literary", label: "Literary", color: "bg-white border-2 border-stone-200 text-stone-800", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" }
    ];

    const renderSelect = (label: string, value: string, field: keyof UserSettings, options: {code: string, label: string}[]) => (
        <div className="flex-1">
            <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">{label}</label>
            <div className="relative">
                <select 
                    value={value}
                    onChange={(e) => onSave({...settings, [field]: e.target.value})}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 text-sm outline-none focus:border-stone-400 appearance-none shadow-sm cursor-pointer hover:border-stone-300 transition-colors"
                >
                    {options.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
        </div>
    );

    const toggleModule = (mod: string) => {
        const current = settings.copyIncludedModules || MODULES;
        if (current.includes(mod)) {
            onSave({ ...settings, copyIncludedModules: current.filter(m => m !== mod) });
        } else {
            onSave({ ...settings, copyIncludedModules: [...current, mod] });
        }
    };

    return (
        <div className="p-6 animate-[fadeIn_0.3s_ease-out] pb-24 max-w-3xl mx-auto">
            <h2 className="text-3xl font-extrabold text-stone-800 mb-10 tracking-tight">Personalize</h2>

            <div className="space-y-12">
                
                {/* 1. Copy Preferences */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <h3 className="text-stone-800 font-bold text-lg">"Copy All" Configuration</h3>
                        <div className="h-px bg-stone-200 flex-1 ml-4" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {MODULES.map(mod => {
                            const isActive = (settings.copyIncludedModules || MODULES).includes(mod);
                            return (
                                <button
                                    key={mod}
                                    onClick={() => toggleModule(mod)}
                                    className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${isActive ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200'}`}
                                >
                                    {mod}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Language Settings */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <h3 className="text-stone-800 font-bold text-lg">Language Settings</h3>
                        <div className="h-px bg-stone-200 flex-1 ml-4" />
                    </div>
                    <div className="space-y-4">
                        {renderSelect("App System Language", settings.systemLanguage || 'English', 'systemLanguage', LANGUAGES)}
                        <div className="flex gap-4">
                            {renderSelect("Card Front Language", settings.cardFrontLanguage || 'English', 'cardFrontLanguage', LANGUAGES)}
                            {renderSelect("Card Back Language", settings.cardBackLanguage || 'Chinese', 'cardBackLanguage', LANGUAGES)}
                        </div>
                    </div>
                </div>

                {/* 3. Style */}
                <div>
                    <div className="flex items-center gap-2 mb-6">
                         <h3 className="text-stone-800 font-bold text-lg">Style Preferences</h3>
                         <div className="h-px bg-stone-200 flex-1 ml-4" />
                    </div>
                    <div className="grid grid-cols-3 gap-3 sm:gap-4">
                        {styles.map(style => (
                            <button
                                key={style.id}
                                onClick={() => onSave({...settings, descriptionStyle: style.id})}
                                className={`
                                    aspect-[4/3] sm:aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm active:scale-95
                                    ${style.color}
                                    ${settings.descriptionStyle === style.id ? 'ring-4 ring-offset-2 ring-stone-200 transform scale-[1.02] shadow-pop z-10' : 'opacity-90 hover:opacity-100 hover:scale-[1.02]'}
                                `}
                            >
                                <div className="scale-90">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={style.icon} /></svg>
                                </div>
                                <span className="font-bold text-[10px] sm:text-xs tracking-wide">{style.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;