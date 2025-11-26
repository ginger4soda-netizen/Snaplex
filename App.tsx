import React, { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval'; // 引入 IndexedDB 库
import Header from './components/Header';
import Home from './components/Home';
import AnalysisView from './components/AnalysisView';
import History from './components/History';
import Settings from './components/Settings';
import { analyzeImage } from './services/geminiService';
import { AnalysisResult, AppMode, HistoryItem, UserSettings, DEFAULT_SETTINGS, ChatMessage } from './types';

// Utility: Compress Image to Max 1024px width & Quality 0.6 JPEG
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
      if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Canvas context failed"));
          return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Clean up memory
      URL.revokeObjectURL(url);
      
      // Return Base64 JPEG at 0.6 quality
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };

    img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
    };

    img.src = url;
  });
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('home');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false); // 新增：数据加载状态

  // Load persisted data (from IndexedDB)
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedSettings = await get('visionLearnSettings');
        if (storedSettings) setSettings(storedSettings);

        const storedHistory = await get('visionLearnHistory');
        if (storedHistory) setHistoryItems(storedHistory);
      } catch (err) {
        console.error("Failed to load data from DB", err);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  const handleSaveSettings = (newSettings: UserSettings) => {
      setSettings(newSettings);
      set('visionLearnSettings', newSettings); // Async save
  };

  const updateHistoryItem = (id: string, updates: Partial<HistoryItem>) => {
      const updatedHistory = historyItems.map(item => {
          if (item.id === id) {
              return { ...item, ...updates };
          }
          return item;
      });
      setHistoryItems(updatedHistory);
      set('visionLearnHistory', updatedHistory); // Async save
  };

  const handleDeleteHistoryItems = (ids: string[]) => {
      const newHistory = historyItems.filter(item => !ids.includes(item.id));
      setHistoryItems(newHistory);
      set('visionLearnHistory', newHistory); // Async save
      
      if (currentHistoryId && ids.includes(currentHistoryId)) {
          setMode('history');
          setCurrentImage(null);
          setAnalysis(null);
      }
  };

  const handleMarkAsExported = (ids: string[]) => {
      const now = Date.now();
      const updatedHistory = historyItems.map(item => {
          if (ids.includes(item.id)) {
              return { ...item, lastExported: now, read: true };
          }
          return item;
      });
      setHistoryItems(updatedHistory);
      set('visionLearnHistory', updatedHistory);
  };

  const handleToggleFavorite = () => {
      if (!currentHistoryId) return;
      const currentItem = historyItems.find(h => h.id === currentHistoryId);
      if (currentItem) {
          updateHistoryItem(currentHistoryId, { isFavorite: !currentItem.isFavorite });
      }
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

    try {
      const compressedImages = await Promise.all(files.map(compressImage));
      
      const primaryImage = compressedImages[0];
      setCurrentImage(primaryImage);

      const primaryResult = await analyzeImage(primaryImage, settings);
      setAnalysis(primaryResult);
      
      const primaryId = Date.now().toString();
      setCurrentHistoryId(primaryId);

      const primaryItem: HistoryItem = {
          id: primaryId,
          timestamp: Date.now(),
          imageUrl: primaryImage,
          analysis: primaryResult,
          isFavorite: false,
          chatHistory: [],
          read: true,
      };

      let backgroundItems: HistoryItem[] = [];
      
      if (compressedImages.length > 1) {
          const restImages = compressedImages.slice(1);
          const restResults = await Promise.all(
              restImages.map(async (img, idx) => {
                  try {
                      const res = await analyzeImage(img, settings);
                      return {
                          id: (Date.now() + idx + 1).toString(),
                          timestamp: Date.now(),
                          imageUrl: img,
                          analysis: res,
                          isFavorite: false,
                          chatHistory: [],
                          read: false,
                      } as HistoryItem;
                  } catch (e) {
                      console.error("Background analysis failed", e);
                      return null;
                  }
              })
          );
          backgroundItems = restResults.filter((item): item is HistoryItem => item !== null);
      }
      
      const newHistory = [primaryItem, ...backgroundItems, ...historyItems];
      setHistoryItems(newHistory);
      
      // Critical: Save to IndexedDB
      await set('visionLearnHistory', newHistory);
      
      if (backgroundItems.length > 0) {
          console.log(`Batch complete. ${backgroundItems.length} added.`);
      }

    } catch (error) {
      console.error(error);
      alert("Analysis failed. Please try again.");
      setMode('home');
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    if (!item.read) {
        updateHistoryItem(item.id, { read: true });
    }
    setCurrentImage(item.imageUrl);
    setAnalysis(item.analysis);
    setCurrentHistoryId(item.id);
    setMode('analysis');
  };
  
  const currentItem = historyItems.find(h => h.id === currentHistoryId);
  const isFavorite = currentItem?.isFavorite || false;
  const currentChatHistory = currentItem?.chatHistory || [];

  // 防止数据还没加载完页面就渲染，导致显示“无记录”
  if (!isDataLoaded) {
      return <div className="min-h-screen bg-cream flex items-center justify-center text-stone-400">Loading library...</div>;
  }

  return (
    <div className="min-h-screen bg-cream font-sans text-dark pb-10 max-w-screen-md mx-auto shadow-2xl">
      <Header 
        currentMode={mode} 
        setMode={setMode} 
      />

      <main className="pt-24">
        {mode === 'home' && (
          <Home onImageUpload={handleImageUpload} />
        )}

        {mode === 'settings' && (
            <Settings settings={settings} onSave={handleSaveSettings} />
        )}

        {mode === 'analysis' && (
          loading ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-10">
                <div className="flex gap-2 mb-8">
                    <div className="w-6 h-6 bg-coral rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-6 h-6 bg-sunny rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-6 h-6 bg-softblue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <h3 className="text-2xl font-bold text-stone-800 animate-pulse">Visual decoding...</h3>
                <p className="text-stone-500 mt-2">Applying your {settings.descriptionStyle.split(' ')[0]} style.</p>
            </div>
          ) : (
            analysis && currentImage && (
              <AnalysisView 
                image={currentImage} 
                analysis={analysis} 
                onBack={() => setMode('history')}
                settings={settings}
                isFavorite={isFavorite}
                onToggleFavorite={handleToggleFavorite}
                chatHistory={currentChatHistory}
                onUpdateChatHistory={handleUpdateChatHistory}
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
            />
        )}
      </main>
    </div>
  );
};

export default App;