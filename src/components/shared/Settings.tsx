import React, { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { BackfillProgress, IndexFailureInfo, IndexHealth, UserSettings } from '../../types';
import { getTranslation } from '../../translations';
import { useTauriIPC } from '../../hooks/useTauriIPC';
import {
    ProviderType,
    PROVIDER_MODELS,
    PROVIDER_LABELS,
    STORAGE_KEYS,
    getApiKey,
    setApiKey as saveApiKey,
    getCurrentProvider,
    getCurrentModel
} from '../../services/providers';

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
    siliconflow: { url: 'https://cloud.siliconflow.cn/i/CKcgddfo', label: 'GET API KEY →' },
};

const STORED_MODULE_KEYS = ["Subject", "Environment", "Composition", "Lighting", "Mood", "Style"];
const DEFAULT_TEXT_EMBEDDING = {
    enabled: false,
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'text-embedding-3-small',
    dimensions: undefined as number | undefined,
};

const Settings: React.FC<Props> = ({ settings, onSave }) => {
    const t = getTranslation(settings.systemLanguage);
    const { getIndexHealth, startBackfill, cancelBackfill, rebuildTextIndex } = useTauriIPC();

    // --- Provider & API State ---
    const [provider, setProvider] = useState<ProviderType>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gemini-2.5-flash');
    const [indexHealth, setIndexHealth] = useState<IndexHealth | null>(null);
    const [indexHealthError, setIndexHealthError] = useState<string | null>(null);
    const [isBackfilling, setIsBackfilling] = useState(false);
    const [backfillProgress, setBackfillProgress] = useState<BackfillProgress | null>(null);
    const textEmbedding = settings.textEmbedding || DEFAULT_TEXT_EMBEDDING;

    const refreshIndexHealth = useCallback(async () => {
        try {
            const health = await getIndexHealth();
            setIndexHealth(health);
            setIndexHealthError(null);
        } catch (error) {
            setIndexHealth(null);
            setIndexHealthError(error instanceof Error ? error.message : String(error));
        }
    }, [getIndexHealth]);

    useEffect(() => {
        const loadedProvider = getCurrentProvider();
        setProvider(loadedProvider);
        setApiKey(getApiKey(loadedProvider) || '');
        setModel(getCurrentModel());
    }, []);

    useEffect(() => {
        refreshIndexHealth();
    }, [refreshIndexHealth]);

    useEffect(() => {
        let cancelled = false;
        let unlisten: (() => void) | undefined;

        listen<BackfillProgress>('backfill-progress', (event) => {
            if (!cancelled) {
                setBackfillProgress(event.payload);
                if (['done', 'cancelled', 'failed'].includes(event.payload.currentKind)) {
                    setIsBackfilling(false);
                    refreshIndexHealth();
                }
            }
        }).then((cleanup) => {
            if (cancelled) {
                cleanup();
            } else {
                unlisten = cleanup;
            }
        });

        return () => {
            cancelled = true;
            unlisten?.();
        };
    }, [refreshIndexHealth]);

    const handleProviderChange = (newProvider: ProviderType) => {
        setProvider(newProvider);
        localStorage.setItem(STORAGE_KEYS.PROVIDER, newProvider);
        setApiKey(getApiKey(newProvider) || '');
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
                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 font-bold text-stone-700 dark:text-stone-200 text-sm outline-none focus:border-stone-400 appearance-none shadow-sm cursor-pointer hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
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

    const updateTextEmbedding = (patch: Partial<typeof DEFAULT_TEXT_EMBEDDING>) => {
        onSave({
            ...settings,
            textEmbedding: {
                ...DEFAULT_TEXT_EMBEDDING,
                ...textEmbedding,
                ...patch,
            },
        });
    };

    const handleStartBackfill = async () => {
        setIsBackfilling(true);
        setBackfillProgress({
            channelId: '',
            processed: 0,
            total: 0,
            indexed: 0,
            failed: 0,
            cancelled: false,
            currentKind: 'start',
            currentFile: null,
            etaSeconds: null,
            lastError: null,
        });
        try {
            const run = await startBackfill();
            setBackfillProgress({
                channelId: run.channelId,
                processed: 0,
                total: 0,
                indexed: 0,
                failed: 0,
                cancelled: false,
                currentKind: run.alreadyRunning ? 'running' : 'queued',
                currentFile: null,
                etaSeconds: null,
                lastError: null,
            });
        } catch (error) {
            setIndexHealthError(error instanceof Error ? error.message : String(error));
            setIsBackfilling(false);
        }
    };

    const handleCancelBackfill = async () => {
        try {
            await cancelBackfill();
        } catch (error) {
            setIndexHealthError(error instanceof Error ? error.message : String(error));
        }
    };

    const handleRebuildTextIndex = async () => {
        setIndexHealthError(null);
        try {
            await rebuildTextIndex();
            await refreshIndexHealth();
            await handleStartBackfill();
        } catch (error) {
            setIndexHealthError(error instanceof Error ? error.message : String(error));
        }
    };

    const renderIndexMetric = (label: string, indexed: number, failed: number, total: number, modelVersion: string | null, lastFailure: IndexFailureInfo | null) => (
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-4">
            <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-sm text-stone-700 dark:text-stone-200">{label}</span>
                <span className="text-xs font-mono text-stone-500 dark:text-stone-400">{indexed}/{total}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                <div
                    className="h-full bg-stone-800 dark:bg-stone-200 transition-all"
                    style={{ width: `${total > 0 ? Math.min(100, Math.round((indexed / total) * 100)) : 0}%` }}
                />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-stone-500 dark:text-stone-400">
                <span>Failed: {failed}</span>
                <span className="truncate font-mono" title={modelVersion || 'Not configured'}>
                    {modelVersion || 'Not configured'}
                </span>
            </div>
            {lastFailure && (
                <div className="mt-2 truncate text-[11px] text-red-500" title={lastFailure.lastError}>
                    Last failure: {lastFailure.lastError}
                </div>
            )}
        </div>
    );

    const progressTotal = backfillProgress?.total || 0;
    const progressPercent = progressTotal > 0
        ? Math.min(100, Math.round((backfillProgress!.processed / progressTotal) * 100))
        : 0;

    return (
        <div className="min-h-screen pt-6 md:pt-8 pb-10 animate-[fadeIn_0.3s_ease-out]">
            <div className="px-6 md:px-8 max-w-4xl mx-auto">
                <div className="space-y-12">

                    {/* 1. API Configuration Section */}
                    <div className="bg-stone-100/50 dark:bg-stone-800/50 p-6 rounded-2xl border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-xl">🔌</span>
                            <h3 className="text-stone-800 dark:text-stone-100 font-bold text-lg">API Configuration</h3>
                        </div>

                        <div className="space-y-5">
                            {/* Row 1: Provider & Model */}
                            <div className="flex gap-4">
                                {/* Provider Selection */}
                                <div className="flex-1">
                                    <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">AI Provider</label>
                                    <div className="relative">
                                        <select
                                            value={provider}
                                            onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
                                            className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 font-bold text-stone-700 dark:text-stone-200 text-sm outline-none focus:border-stone-400 appearance-none shadow-sm cursor-pointer hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
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

                                {/* Model Selection */}
                                <div className="flex-1">
                                    <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">AI Model</label>
                                    <div className="relative">
                                        <select
                                            value={model}
                                            onChange={(e) => handleModelChange(e.target.value)}
                                            className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 font-bold text-stone-700 dark:text-stone-200 text-sm outline-none focus:border-softblue appearance-none shadow-sm cursor-pointer"
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

                                {/* Real API Key field */}
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
                                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 font-mono text-stone-700 dark:text-stone-200 text-sm outline-none shadow-sm transition-all focus:ring-1 focus:border-softblue focus:ring-softblue"
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

                    {/* 2. Search Indexing */}
                    <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-700">
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-stone-800 dark:text-stone-100 font-bold text-lg">Search Indexing</h3>
                                <p className="text-xs text-stone-400 mt-1">Optional semantic search via an OpenAI-compatible embeddings API.</p>
                            </div>
                            <label className="inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!textEmbedding.enabled}
                                    onChange={(e) => updateTextEmbedding({ enabled: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <span className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-5 after:content-[''] after:absolute after:mt-0.5 after:ml-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-stone-800 relative" />
                            </label>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">Embeddings Endpoint</label>
                                <input
                                    type="text"
                                    value={textEmbedding.endpoint}
                                    onChange={(e) => updateTextEmbedding({ endpoint: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 font-mono text-stone-700 dark:text-stone-200 text-sm outline-none shadow-sm focus:border-softblue"
                                />
                            </div>
                            <div>
                                <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">Embedding Model</label>
                                <input
                                    type="text"
                                    value={textEmbedding.model}
                                    onChange={(e) => updateTextEmbedding({ model: e.target.value })}
                                    placeholder="text-embedding-3-small"
                                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 font-mono text-stone-700 dark:text-stone-200 text-sm outline-none shadow-sm focus:border-softblue"
                                />
                            </div>
                            <div>
                                <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">Embeddings API Key</label>
                                <input
                                    type="text"
                                    value={textEmbedding.apiKey}
                                    onChange={(e) => updateTextEmbedding({ apiKey: e.target.value })}
                                    placeholder="sk-..."
                                    autoComplete="off"
                                    data-lpignore="true"
                                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 font-mono text-stone-700 dark:text-stone-200 text-sm outline-none shadow-sm focus:border-softblue"
                                    style={{ WebkitTextSecurity: 'disc' } as any}
                                />
                            </div>
                            <div>
                                <label className="block text-stone-400 font-bold text-[10px] uppercase tracking-wider mb-2">Dimensions</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={textEmbedding.dimensions || ''}
                                    onChange={(e) => updateTextEmbedding({ dimensions: e.target.value ? Number(e.target.value) : undefined })}
                                    placeholder="Default"
                                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 font-mono text-stone-700 dark:text-stone-200 text-sm outline-none shadow-sm focus:border-softblue"
                                />
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-stone-200 dark:border-stone-700">
                            <div className="flex items-center justify-between gap-4 mb-4">
                                <div>
                                    <h4 className="font-bold text-sm text-stone-800 dark:text-stone-100">Index Health</h4>
                                    <p className="text-xs text-stone-400 mt-1">Visual CLIP index and optional text embedding coverage.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleRebuildTextIndex}
                                        disabled={isBackfilling || !textEmbedding.enabled}
                                        className="px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Rebuild text
                                    </button>
                                    <button
                                        type="button"
                                        onClick={isBackfilling ? handleCancelBackfill : handleStartBackfill}
                                        className="px-4 py-2 rounded-lg bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isBackfilling ? 'Cancel' : 'Start backfill'}
                                    </button>
                                </div>
                            </div>

                            <label className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-3">
                                <span className="text-sm font-bold text-stone-700 dark:text-stone-200">CLIP indexing</span>
                                <input
                                    type="checkbox"
                                    checked={settings.clipIndexingEnabled ?? true}
                                    onChange={(e) => onSave({ ...settings, clipIndexingEnabled: e.target.checked })}
                                    className="h-4 w-4 accent-stone-800"
                                />
                            </label>

                            {indexHealthError && (
                                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                                    {indexHealthError}
                                </div>
                            )}

                            {indexHealth && (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {renderIndexMetric('Text', indexHealth.text.indexed, indexHealth.text.failed, indexHealth.totalImages, indexHealth.text.modelVersion, indexHealth.text.lastFailure)}
                                    {renderIndexMetric('Visual', indexHealth.visual.indexed, indexHealth.visual.failed, indexHealth.totalImages, indexHealth.visual.modelVersion, indexHealth.visual.lastFailure)}
                                </div>
                            )}

                            {indexHealth?.latestBackfill && !backfillProgress && (
                                <div className="mt-4 rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-3 text-xs text-stone-500 dark:text-stone-400">
                                    Last backfill: {indexHealth.latestBackfill.status} · {indexHealth.latestBackfill.processed}/{indexHealth.latestBackfill.total}
                                </div>
                            )}

                            {backfillProgress && (
                                <div className="mt-4 rounded-xl border border-stone-200 dark:border-stone-700 p-4">
                                    <div className="flex items-center justify-between gap-3 text-xs font-bold text-stone-600 dark:text-stone-300">
                                        <span>{backfillProgress.currentKind}</span>
                                        <span>{backfillProgress.processed}/{backfillProgress.total}</span>
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                                        <div className="h-full bg-softblue transition-all" style={{ width: `${progressPercent}%` }} />
                                    </div>
                                    <div className="mt-3 text-[11px] text-stone-500 dark:text-stone-400">
                                        Indexed: {backfillProgress.indexed} / Failed: {backfillProgress.failed}
                                        {backfillProgress.etaSeconds !== null ? ` / ETA: ${backfillProgress.etaSeconds}s` : ''}
                                    </div>
                                    {backfillProgress.currentFile && (
                                        <div className="mt-1 truncate text-[11px] text-stone-500 dark:text-stone-400" title={backfillProgress.currentFile}>
                                            Current: {backfillProgress.currentFile}
                                        </div>
                                    )}
                                    {backfillProgress.lastError && (
                                        <div className="mt-1 truncate text-[11px] text-red-500" title={backfillProgress.lastError}>
                                            Last error: {backfillProgress.lastError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Copy Config */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <h3 className="text-stone-800 dark:text-stone-100 font-bold text-lg">{t.lblCopyConfig}</h3>
                            <div className="h-px bg-stone-200 dark:bg-stone-700 flex-1 ml-4" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            {STORED_MODULE_KEYS.map(modKey => {
                                const isActive = (settings.copyIncludedModules || STORED_MODULE_KEYS).includes(modKey);
                                return (
                                    <button
                                        key={modKey}
                                        onClick={() => toggleModule(modKey)}
                                        className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${isActive ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 border-stone-800 dark:border-stone-200' : 'bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700'}`}
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
                            <h3 className="text-stone-800 dark:text-stone-100 font-bold text-lg">{t.lblLangSettings}</h3>
                            <div className="h-px bg-stone-200 dark:bg-stone-700 flex-1 ml-4" />
                        </div>
                        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-4">
                            {renderSelect(t.lblSystemLang, settings.systemLanguage || 'English', (v) => onSave({ ...settings, systemLanguage: v }), LANGUAGES)}
                            <div className="flex gap-4 md:contents">
                                {renderSelect(t.lblFrontLang, settings.cardFrontLanguage || 'English', (v) => onSave({ ...settings, cardFrontLanguage: v }), LANGUAGES)}
                                {renderSelect(t.lblBackLang, settings.cardBackLanguage || 'Chinese', (v) => onSave({ ...settings, cardBackLanguage: v }), LANGUAGES)}
                            </div>
                        </div>
                    </div>

                    {/* 4. Style Preferences */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <h3 className="text-stone-800 dark:text-stone-100 font-bold text-lg">{t.lblStylePref}</h3>
                            <div className="h-px bg-stone-200 dark:bg-stone-700 flex-1 ml-4" />
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
                            {styles.map(style => (
                                <button
                                    key={style.id}
                                    onClick={() => onSave({ ...settings, descriptionStyle: style.id })}
                                    className={`
                                        aspect-[4/3] md:aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm active:scale-95
                                        ${style.color}
                                        ${settings.descriptionStyle === style.id ? 'ring-4 ring-offset-2 ring-stone-200 dark:ring-stone-600 dark:ring-offset-stone-900 transform scale-[1.02] shadow-pop z-10' : 'opacity-90 hover:opacity-100 hover:scale-[1.02]'}
                                    `}
                                >
                                    <div className="scale-90">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={style.icon} /></svg>
                                    </div>
                                    <span className="font-bold text-[10px] md:text-xs tracking-wide">{style.label}</span>
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
