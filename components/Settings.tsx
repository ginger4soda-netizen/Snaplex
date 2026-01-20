import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { getTranslation } from '../translations';
import {
    ProviderType,
    PROVIDER_MODELS,
    PROVIDER_LABELS,
    STORAGE_KEYS,
    getApiKey,
    setApiKey as saveApiKey,
    getCurrentProvider,
    getCurrentModel
} from '../services/providers';

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

// Provider key help links
const PROVIDER_KEY_LINKS: Record<ProviderType, { url: string; label: string }> = {
    gemini: { url: 'https://aistudio.google.com/app/apikey', label: 'GET FREE KEY →' },
    openai: { url: 'https://platform.openai.com/api-keys', label: 'GET API KEY →' },
    claude: { url: 'https://console.anthropic.com/settings/keys', label: 'GET API KEY →' },
    siliconflow: { url: 'https://cloud.siliconflow.cn/account/ak', label: 'GET API KEY →' },
};

const STORED_MODULE_KEYS = ["Subject", "Environment", "Composition", "Lighting", "Mood", "Style"];

const Settings: React.FC<Props> = ({ settings, onSave }) => {
    const t = getTranslation(settings.systemLanguage);

    // --- Provider & API State ---
    const [provider, setProvider] = useState<ProviderType>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gemini-2.5-flash');

    useEffect(() => {
        // Load from LocalStorage
        const loadedProvider = getCurrentProvider();
        setProvider(loadedProvider);
        setApiKey(getApiKey(loadedProvider) || '');
        setModel(getCurrentModel());
    }, []);

    const handleProviderChange = (newProvider: ProviderType) => {
        setProvider(newProvider);
        localStorage.setItem(STORAGE_KEYS.PROVIDER, newProvider);
        // Load the API key for this provider
        setApiKey(getApiKey(newProvider) || '');
        // Set default model for new provider
        const defaultModel = PROVIDER_MODELS[newProvider][0]?.id || '';
        setModel(defaultModel);
        localStorage.setItem(STORAGE_KEYS.MODEL, defaultModel);
    };

    const handleApiKeyChange = (val: string) => {
        setApiKey(val);
        saveApiKey(provider, val);
    };

    const handleModelChange = (val: string) => {
        setModel(val);
        localStorage.setItem(STORAGE_KEYS.MODEL, val);
    };

    // --- Translations Map ---
    const MODULE_LABEL_MAP: Record<string, string> = {
        "Subject": t.lblSubject,
        "Environment": t.lblEnvironment,
        "Composition": t.lblComposition,
        "Lighting": t.lblLighting,
        "Mood": t.lblMood,
        "Style": t.lblStyle
    };

    const styles = [
        { id: "Standard", label: t.styleStandard, color: "bg-stone-200 text-stone-800", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
        { id: "Artistic", label: t.styleArtistic, color: "bg-coral text-white", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
        { id: "Cinematic", label: t.styleCinematic, color: "bg-stone-800 text-white", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
        { id: "Technical", label: t.styleTechnical, color: "bg-softblue text-white", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
        { id: "UI/UX", label: t.styleUIUX, color: "bg-sunny text-stone-800", icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" },
        { id: "Literary", label: t.styleLiterary, color: "bg-white border-2 border-stone-200 text-stone-800", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" }
    ];

    const renderSelect = (label: string, value: string, onChange: (val: string) => void, options: { code: string, label: string }[]) => (
        <div className="flex-1">
            <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
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

    const toggleModule = (modKey: string) => {
        const current = settings.copyIncludedModules || STORED_MODULE_KEYS;
        if (current.includes(modKey)) {
            onSave({ ...settings, copyIncludedModules: current.filter(m => m !== modKey) });
        } else {
            onSave({ ...settings, copyIncludedModules: [...current, modKey] });
        }
    };

    return (
        <div className="min-h-screen md:pt-40 pb-10 animate-[fadeIn_0.3s_ease-out]">
            {/* Desktop: Full-screen with max-width constraint */}
            <div className="hidden md:block px-8">
                <div className="max-w-4xl mx-auto">


                    <div className="space-y-12">

                        {/* 1. API Configuration Section */}
                        {/* 1. API Configuration Section */}
                        <div className="bg-stone-100/50 p-6 rounded-2xl border border-stone-200">
                            <div className="flex items-center gap-2 mb-6">
                                <span className="text-xl">🔌</span>
                                <h3 className="text-stone-800 font-bold text-lg">API Configuration</h3>
                            </div>

                            <div className="space-y-5">
                                {/* Row 1: Provider & Model on the same line */}
                                <div className="flex gap-4">
                                    {/* Provider Selection (Master) */}
                                    <div className="flex-1">
                                        <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">AI Provider</label>
                                        <div className="relative">
                                            <select
                                                value={provider}
                                                onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
                                                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 text-sm outline-none focus:border-stone-400 appearance-none shadow-sm cursor-pointer hover:border-stone-300 transition-colors"
                                            >
                                                {(Object.keys(PROVIDER_LABELS) as ProviderType[]).map(p => (
                                                    <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Model Selection (Dependent) */}
                                    <div className="flex-1">
                                        <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">AI Model</label>
                                        <div className="relative">
                                            <select
                                                value={model}
                                                onChange={(e) => handleModelChange(e.target.value)}
                                                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 text-sm outline-none focus:border-softblue appearance-none shadow-sm cursor-pointer"
                                            >
                                                {PROVIDER_MODELS[provider].map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: API Key */}
                                <div>
                                    <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">
                                        {PROVIDER_LABELS[provider].split(' ')[0]} API Key
                                    </label>

                                    {/* Honeypot fields (hidden) to prevent browser password save prompts */}
                                    <input
                                        type="text"
                                        name="username"
                                        autoComplete="username"
                                        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                                        tabIndex={-1}
                                        aria-hidden="true"
                                    />
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                                        tabIndex={-1}
                                        aria-hidden="true"
                                    />

                                    {/* Real API Key field (styled as password but type=text) */}
                                    <input
                                        type="text"
                                        id={`api-key-${provider}`}
                                        name={`snaplex-api-key-${provider}`}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        data-form-type="other"
                                        value={apiKey}
                                        onChange={(e) => handleApiKeyChange(e.target.value)}
                                        placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                                        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-mono text-stone-700 text-sm outline-none shadow-sm transition-all focus:ring-1 focus:border-softblue focus:ring-softblue"
                                        style={{ WebkitTextSecurity: 'disc' } as any}
                                    />

                                    <div className="mt-2 text-right">
                                        <a href={PROVIDER_KEY_LINKS[provider].url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-softblue hover:underline">
                                            {PROVIDER_KEY_LINKS[provider].label}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Copy Config */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2">
                                <h3 className="text-stone-800 font-bold text-lg">{t.lblCopyConfig}</h3>
                                <div className="h-px bg-stone-200 flex-1 ml-4" />
                            </div>
                            <div className="grid grid-cols-6 gap-3">
                                {STORED_MODULE_KEYS.map(modKey => {
                                    const isActive = (settings.copyIncludedModules || STORED_MODULE_KEYS).includes(modKey);
                                    return (
                                        <button
                                            key={modKey}
                                            onClick={() => toggleModule(modKey)}
                                            className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${isActive ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200'}`}
                                        >
                                            {MODULE_LABEL_MAP[modKey] || modKey}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Language Settings */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2">
                                <h3 className="text-stone-800 font-bold text-lg">{t.lblLangSettings}</h3>
                                <div className="h-px bg-stone-200 flex-1 ml-4" />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {renderSelect(t.lblSystemLang, settings.systemLanguage || 'English', (v) => onSave({ ...settings, systemLanguage: v }), LANGUAGES)}
                                {renderSelect(t.lblFrontLang, settings.cardFrontLanguage || 'English', (v) => onSave({ ...settings, cardFrontLanguage: v }), LANGUAGES)}
                                {renderSelect(t.lblBackLang, settings.cardBackLanguage || 'Chinese', (v) => onSave({ ...settings, cardBackLanguage: v }), LANGUAGES)}
                            </div>
                        </div>

                        {/* 4. Style Preferences */}
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <h3 className="text-stone-800 font-bold text-lg">{t.lblStylePref}</h3>
                                <div className="h-px bg-stone-200 flex-1 ml-4" />
                            </div>
                            <div className="grid grid-cols-6 gap-4">
                                {styles.map(style => (
                                    <button
                                        key={style.id}
                                        onClick={() => onSave({ ...settings, descriptionStyle: style.id })}
                                        className={`
                                            aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm active:scale-95
                                            ${style.color}
                                            ${settings.descriptionStyle === style.id ? 'ring-4 ring-offset-2 ring-stone-200 transform scale-[1.02] shadow-pop z-10' : 'opacity-90 hover:opacity-100 hover:scale-[1.02]'}
                                        `}
                                    >
                                        <div className="scale-90">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={style.icon} /></svg>
                                        </div>
                                        <span className="font-bold text-xs tracking-wide">{style.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile: Original layout */}
            <div className="md:hidden px-6 pt-24 pb-6 max-w-screen-md mx-auto">


                <div className="space-y-12">

                    {/* 1. API Configuration Section */}
                    <div className="bg-stone-100/50 p-6 rounded-2xl border border-stone-200">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-xl">🔌</span>
                            <h3 className="text-stone-800 font-bold text-lg">API Configuration</h3>
                        </div>

                        <div className="space-y-5">
                            {/* Row 1: Provider & Model on the same line */}
                            <div className="flex gap-4">
                                {/* Provider Selection (Master) */}
                                <div className="flex-1">
                                    <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">AI Provider</label>
                                    <div className="relative">
                                        <select
                                            value={provider}
                                            onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
                                            className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 text-sm outline-none focus:border-stone-400 appearance-none shadow-sm cursor-pointer hover:border-stone-300 transition-colors"
                                        >
                                            {(Object.keys(PROVIDER_LABELS) as ProviderType[]).map(p => (
                                                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Model Selection (Dependent) */}
                                <div className="flex-1">
                                    <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">AI Model</label>
                                    <div className="relative">
                                        <select
                                            value={model}
                                            onChange={(e) => handleModelChange(e.target.value)}
                                            className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-bold text-stone-700 text-sm outline-none focus:border-softblue appearance-none shadow-sm cursor-pointer"
                                        >
                                            {PROVIDER_MODELS[provider].map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: API Key */}
                            <div>
                                <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">
                                    {PROVIDER_LABELS[provider].split(' ')[0]} API Key
                                </label>

                                {/* Honeypot fields (hidden) to prevent browser password save prompts */}
                                <input
                                    type="text"
                                    name="username"
                                    autoComplete="username"
                                    style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                                    tabIndex={-1}
                                    aria-hidden="true"
                                />
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                                    tabIndex={-1}
                                    aria-hidden="true"
                                />

                                {/* Real API Key field (styled as password but type=text) */}
                                <input
                                    type="text"
                                    id={`api-key-mobile-${provider}`}
                                    name={`snaplex-api-key-mobile-${provider}`}
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-form-type="other"
                                    value={apiKey}
                                    onChange={(e) => handleApiKeyChange(e.target.value)}
                                    placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-mono text-stone-700 text-sm outline-none shadow-sm transition-all focus:ring-1 focus:border-softblue focus:ring-softblue"
                                    style={{ WebkitTextSecurity: 'disc' } as any}
                                />

                                <div className="mt-2 text-right">
                                    <a href={PROVIDER_KEY_LINKS[provider].url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-softblue hover:underline">
                                        {PROVIDER_KEY_LINKS[provider].label}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Copy Config */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <h3 className="text-stone-800 font-bold text-lg">{t.lblCopyConfig}</h3>
                            <div className="h-px bg-stone-200 flex-1 ml-4" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {STORED_MODULE_KEYS.map(modKey => {
                                const isActive = (settings.copyIncludedModules || STORED_MODULE_KEYS).includes(modKey);
                                return (
                                    <button
                                        key={modKey}
                                        onClick={() => toggleModule(modKey)}
                                        className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${isActive ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200'}`}
                                    >
                                        {MODULE_LABEL_MAP[modKey] || modKey}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. Language Settings */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <h3 className="text-stone-800 font-bold text-lg">{t.lblLangSettings}</h3>
                            <div className="h-px bg-stone-200 flex-1 ml-4" />
                        </div>
                        <div className="space-y-4">
                            {renderSelect(t.lblSystemLang, settings.systemLanguage || 'English', (v) => onSave({ ...settings, systemLanguage: v }), LANGUAGES)}
                            <div className="flex gap-4">
                                {renderSelect(t.lblFrontLang, settings.cardFrontLanguage || 'English', (v) => onSave({ ...settings, cardFrontLanguage: v }), LANGUAGES)}
                                {renderSelect(t.lblBackLang, settings.cardBackLanguage || 'Chinese', (v) => onSave({ ...settings, cardBackLanguage: v }), LANGUAGES)}
                            </div>
                        </div>
                    </div>

                    {/* 4. Style Preferences */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <h3 className="text-stone-800 font-bold text-lg">{t.lblStylePref}</h3>
                            <div className="h-px bg-stone-200 flex-1 ml-4" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {styles.map(style => (
                                <button
                                    key={style.id}
                                    onClick={() => onSave({ ...settings, descriptionStyle: style.id })}
                                    className={`
                                        aspect-[4/3] rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm active:scale-95
                                        ${style.color}
                                        ${settings.descriptionStyle === style.id ? 'ring-4 ring-offset-2 ring-stone-200 transform scale-[1.02] shadow-pop z-10' : 'opacity-90 hover:opacity-100 hover:scale-[1.02]'}
                                    `}
                                >
                                    <div className="scale-90">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={style.icon} /></svg>
                                    </div>
                                    <span className="font-bold text-[10px] tracking-wide">{style.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;