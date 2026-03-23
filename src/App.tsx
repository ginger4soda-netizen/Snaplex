import React, { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import Settings from './components/Settings';
import StylePrinter from './components/StylePrinter';
import ThreeColumnLayout from './components/layout/ThreeColumnLayout';
import { UserSettings, DEFAULT_SETTINGS } from './types';
import { useTheme } from './hooks/useTheme';
import { useTauriIPC } from './hooks/useTauriIPC';
import ToastContainer from './components/common/ToastContainer';
import { showToast } from './hooks/useToast';

type DesktopMode = 'library' | 'settings' | 'printer';

const DEFAULT_LIBRARY_NAME = 'Default';

const App: React.FC = () => {
  const [mode, setMode] = useState<DesktopMode>('library');
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(undefined);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [initState, setInitState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [initError, setInitError] = useState<string>('');
  const { theme } = useTheme();
  const { getCurrentLibrary, createLibrary } = useTauriIPC();

  // Initialize: load settings + ensure library exists
  useEffect(() => {
    const init = async () => {
      // Load user settings + always apply system language detection on desktop
      try {
        const stored = await get('visionLearnSettings');
        const detected = detectSystemLanguage();
        console.log('[Snaplex] Detected system language:', detected, 'from navigator.language:', navigator.language);
        if (stored) {
          // Always enforce system language on desktop launch
          const updated = {
            ...stored,
            systemLanguage: detected,
            cardBackLanguage: stored.cardBackLanguage || detected,
          };
          setSettings(updated);
          await set('visionLearnSettings', updated);
        } else {
          // First launch — use defaults + detected language
          const autoSettings = { ...DEFAULT_SETTINGS, systemLanguage: detected, cardBackLanguage: detected };
          setSettings(autoSettings);
          await set('visionLearnSettings', autoSettings);
        }
      } catch {
        // idb-keyval may fail in Tauri, non-critical
      }

      // Ensure a library is open
      try {
        let lib = await getCurrentLibrary();
        if (!lib) {
          // First launch — create default library
          const homePath = await getHomeDir();
          const libPath = `${homePath}/Snaplex Libraries/${DEFAULT_LIBRARY_NAME}.snpx`;
          lib = await createLibrary(libPath, DEFAULT_LIBRARY_NAME);
        }
        setInitState('ready');
      } catch (e) {
        const msg = String(e);
        console.error('Library init failed:', msg);
        setInitError(msg);
        setInitState('error');
      }
    };
    init();
  }, []);

  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    set('visionLearnSettings', newSettings);
  };

  const handleRetryInit = () => {
    setInitState('loading');
    setInitError('');
    // Re-trigger the effect by reloading
    window.location.reload();
  };

  // Loading state
  if (initState === 'loading') {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center text-stone-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium animate-pulse">Initializing Snaplex...</p>
        </div>
      </div>
    );
  }

  // Error state (library init failed)
  if (initState === 'error') {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center text-stone-500">
        <div className="flex flex-col items-center gap-6 max-w-md text-center px-8">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-800 dark:text-stone-200 mb-2">Failed to Initialize Library</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">Snaplex needs a local library folder to store your images.</p>
            <p className="text-xs text-stone-400 dark:text-stone-500 font-mono bg-stone-100 dark:bg-stone-800 rounded-lg p-3 mt-3 break-all">{initError}</p>
          </div>
          <button
            onClick={handleRetryInit}
            className="px-6 py-2.5 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Sub-views (Settings, Printer) — rendered inside desktop layout, no web home page
  if (mode === 'settings' || mode === 'printer') {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 font-sans text-stone-800 dark:text-stone-200 transition-colors">
        <div className="sticky top-0 z-50 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
            <button
              onClick={() => setMode('library')}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Back to Library
            </button>
            <span className="text-sm font-bold capitalize">{mode}</span>
          </div>
        </div>
        <main>
          {mode === 'settings' && (
            <Settings settings={settings} onSave={handleSaveSettings} />
          )}
          {mode === 'printer' && (
            <StylePrinter mode="standalone" systemLanguage={settings.systemLanguage} />
          )}
        </main>
        <ToastContainer />
      </div>
    );
  }

  // Main library view
  return (
    <>
      <ThreeColumnLayout
        currentFolderId={currentFolderId}
        onFolderSelect={setCurrentFolderId}
        selectedImageId={selectedImageId}
        onImageSelect={setSelectedImageId}
        onNavigate={(m) => setMode(m as DesktopMode)}
      />
      <ToastContainer />
    </>
  );
};

/** Detect system language from navigator.language and map to our language names */
function detectSystemLanguage(): string {
  try {
    const lang = navigator.language || navigator.languages?.[0] || '';
    const code = lang.toLowerCase().split('-')[0];
    const map: Record<string, string> = {
      en: 'English',
      zh: 'Chinese',
      es: 'Spanish',
      ja: 'Japanese',
      fr: 'French',
      de: 'German',
      ko: 'Korean',
    };
    return map[code] || 'English';
  } catch {
    return 'English';
  }
}

/** Get user home directory — works in Tauri and falls back for tests */
async function getHomeDir(): Promise<string> {
  try {
    const { homeDir } = await import('@tauri-apps/api/path');
    return await homeDir();
  } catch {
    // Fallback for non-Tauri environments
    return '/tmp';
  }
}

export default App;
