import React, { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import Header from './components/Header';
import Home from './components/Home';
import AnalysisView from './components/AnalysisView';
import History from './components/History';
import Settings from './components/Settings';
import StylePrinter from './components/StylePrinter';
import { analyzeImage } from './services/geminiService';
import { AnalysisResult, AppMode, HistoryItem, UserSettings, DEFAULT_SETTINGS, ChatMessage } from './types';
import { mineHistory, MiningResult } from './utils/historyMiner';
import { explainVisualTerm, TermExplanation } from './services/geminiService';


// Image compression utility
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Canvas context failed")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('home');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [isReadyToView, setIsReadyToView] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Pre-fetching for Printer Optimization
  const [preFetchedTerm, setPreFetchedTerm] = useState<MiningResult | null>(null);
  const [preFetchedExplanation, setPreFetchedExplanation] = useState<TermExplanation | null>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedSettings = await get('visionLearnSettings');
        if (storedSettings) setSettings(storedSettings);
        const storedHistory = await get('visionLearnHistory');
        if (storedHistory) setHistoryItems(storedHistory);
      } catch (err) { console.error("Failed to load DB", err); }
      finally { setIsDataLoaded(true); }
    };
    loadData();
  }, []);

  // background pre-fetch printer term
  useEffect(() => {
    if (!isDataLoaded) return;
    const preFetch = async () => {
      try {
        const mined = mineHistory(historyItems);
        if (mined.length > 0) {
          const first = mined[0];
          setPreFetchedTerm(first);
          const expl = await explainVisualTerm(first.term, settings.systemLanguage || 'English');
          setPreFetchedExplanation(expl);
        }
      } catch (e) { console.error("Pre-fetch failed", e); }
    };
    preFetch();
  }, [isDataLoaded, settings.systemLanguage]);

  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    set('visionLearnSettings', newSettings);
  };

  const updateHistoryItem = (id: string, updates: Partial<HistoryItem>) => {
    const updatedHistory = historyItems.map(item => item.id === id ? { ...item, ...updates } : item);
    setHistoryItems(updatedHistory);
    set('visionLearnHistory', updatedHistory);
  };

  const handleDeleteHistoryItems = (ids: string[]) => {
    const newHistory = historyItems.filter(item => !ids.includes(item.id));
    setHistoryItems(newHistory);
    set('visionLearnHistory', newHistory);
    if (currentHistoryId && ids.includes(currentHistoryId)) {
      setMode('history'); setCurrentImage(null); setAnalysis(null);
    }
  };

  const handleMarkAsExported = (ids: string[]) => {
    const now = Date.now();
    const updatedHistory = historyItems.map(item => ids.includes(item.id) ? { ...item, lastExported: now, read: true } : item);
    setHistoryItems(updatedHistory);
    set('visionLearnHistory', updatedHistory);
  };

  const handleToggleFavorite = () => {
    if (!currentHistoryId) return;
    const currentItem = historyItems.find(h => h.id === currentHistoryId);
    if (currentItem) updateHistoryItem(currentHistoryId, { isFavorite: !currentItem.isFavorite });
  };

  const handleUpdateChatHistory = (msgs: ChatMessage[]) => {
    if (!currentHistoryId) return;
    updateHistoryItem(currentHistoryId, { chatHistory: msgs });
  };

  const handleImageUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setLoading(true);
    setMode('analysis');
    setAnalysis(null);
    setIsReadyToView(false);

    try {
      const compressedImages = await Promise.all(files.map(compressImage));
      const primaryImage = compressedImages[0];
      setCurrentImage(primaryImage);

      const primaryResult = await analyzeImage(primaryImage, settings);
      setAnalysis(primaryResult);

      const primaryId = Date.now().toString();
      setCurrentHistoryId(primaryId);

      const primaryItem: HistoryItem = {
        id: primaryId, timestamp: Date.now(), imageUrl: primaryImage,
        analysis: primaryResult, isFavorite: false, chatHistory: [], read: true,
      };

      let backgroundItems: HistoryItem[] = [];
      if (compressedImages.length > 1) {
        const restImages = compressedImages.slice(1);
        const restResults = await Promise.all(restImages.map(async (img, idx) => {
          try {
            const res = await analyzeImage(img, settings);
            return {
              id: (Date.now() + idx + 1).toString(), timestamp: Date.now(),
              imageUrl: img, analysis: res, isFavorite: false, chatHistory: [], read: false,
            } as HistoryItem;
          } catch (e) { return null; }
        }));
        backgroundItems = restResults.filter((item): item is HistoryItem => item !== null);
      }

      const newHistory = [primaryItem, ...backgroundItems, ...historyItems];
      setHistoryItems(newHistory);
      await set('visionLearnHistory', newHistory);

    } catch (error) {
      console.error(error); alert("Analysis failed. Please try again."); setMode('home');
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    if (!item.read) updateHistoryItem(item.id, { read: true });
    setCurrentImage(item.imageUrl);
    setAnalysis(item.analysis);
    setCurrentHistoryId(item.id);
    setMode('analysis');
    setIsReadyToView(true);
  };

  const currentItem = historyItems.find(h => h.id === currentHistoryId);

  if (!isDataLoaded) return <div className="min-h-screen bg-cream flex items-center justify-center text-stone-400">Loading...</div>;

  return (
    <div className={`min-h-screen bg-cream font-sans text-dark max-w-screen-md mx-auto shadow-2xl ${mode === 'home' || mode === 'history' || mode === 'settings' ? 'pb-10' : ''}`}>
      <Header currentMode={mode} setMode={setMode} />
      <main className="pt-20">

        {mode === 'home' && (
          <Home onImageUpload={handleImageUpload} systemLanguage={settings.systemLanguage} />
        )}

        {mode === 'settings' && (
          <Settings settings={settings} onSave={handleSaveSettings} />
        )}

        {/* ✅ 新增：独立的打印机页面路由 */}
        {mode === 'printer' && (
          <div className="px-4">
            <StylePrinter
              mode="standalone" // 独立模式
              systemLanguage={settings.systemLanguage}
            />
          </div>
        )}

        {mode === 'analysis' && (
          (loading || (analysis && !isReadyToView)) ? (
            <div className="px-4 py-8">
              <StylePrinter
                mode="analysis" // 分析模式（尺寸已修复）
                systemLanguage={settings.systemLanguage}
                isFinished={!loading && !!analysis}
                onViewResult={() => setIsReadyToView(true)}
                preFetchedTerm={preFetchedTerm}
                preFetchedExplanation={preFetchedExplanation}
              />
            </div>
          ) : (
            analysis && currentImage && (
              <AnalysisView
                image={currentImage}
                analysis={analysis}
                onBack={() => setMode('history')}
                settings={settings}
                isFavorite={currentItem?.isFavorite || false}
                onToggleFavorite={handleToggleFavorite}
                chatHistory={currentItem?.chatHistory || []}
                onUpdateChatHistory={handleUpdateChatHistory}
                historyItemId={currentItem?.id}
              />
            )
          )
        )}

        {mode === 'history' && (
          <History
            items={historyItems}
            onSelect={handleHistorySelect}
            onDeleteItems={handleDeleteHistoryItems}
            onMarkAsExported={handleMarkAsExported}
            systemLanguage={settings.systemLanguage}
          />
        )}
      </main>
    </div>
  );
};

export default App;