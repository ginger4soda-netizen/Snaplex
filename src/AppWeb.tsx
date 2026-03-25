/**
 * Web-only App component.
 * Uses IndexedDB-based state (useAppState) and web-only components.
 * No Tauri dependencies — runs in any browser.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useSettings, useHistory } from './hooks/useAppState';
import { AppMode, HistoryItem, ChatMessage } from './types';
import Header from './components/web/Header';
import Home from './components/web/Home';
import AnalysisView from './components/web/AnalysisView';
import History from './components/web/History';
import Settings from './components/shared/Settings';
import StylePrinter from './components/shared/StylePrinter';
import ChatBot from './components/shared/ChatBot';
import { useTheme } from './hooks/useTheme';
import { analyzeImage } from './services/geminiService';

const AppWeb: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('home');
  const { settings, saveSettings, isDataLoaded, setIsDataLoaded } = useSettings();
  const { historyItems, loadHistory, addHistoryItems, deleteHistoryItems, updateHistoryItem, markAsExported } = useHistory();
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentItem, setCurrentItem] = useState<HistoryItem | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const { theme } = useTheme();

  useEffect(() => {
    loadHistory().then(() => setIsDataLoaded(true));
  }, []);

  // Convert File[] to base64, trigger analysis, then show AnalysisView
  const handleImageUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];

    const readFileAsBase64 = (f: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });

    try {
      const base64 = await readFileAsBase64(file);
      setCurrentImage(base64);
      setCurrentItem(null);
      setChatHistory([]);
      setIsAnalyzing(true);
      setAnalysisProgress(10);

      // Run AI analysis
      setAnalysisProgress(30);
      const analysis = await analyzeImage(base64, settings);
      setAnalysisProgress(90);

      // Create history item and save
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        imageUrl: base64,
        analysis,
        isFavorite: false,
      };
      addHistoryItems([item]);
      setCurrentItem(item);
      setAnalysisProgress(100);

      // Switch to analysis view
      setMode('analysis');
    } catch (err) {
      console.error('Image upload/analysis failed:', err);
      alert('Analysis failed. Please check your API settings and try again.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [settings, addHistoryItems]);

  // View an existing history item
  const handleViewHistoryItem = useCallback((item: HistoryItem) => {
    setCurrentItem(item);
    setCurrentImage(item.imageUrl);
    setChatHistory(item.chatHistory || []);
    setMode('analysis');
  }, []);

  // Toggle favorite on current item
  const handleToggleFavorite = useCallback(() => {
    if (!currentItem) return;
    const updated = !currentItem.isFavorite;
    updateHistoryItem(currentItem.id, { isFavorite: updated });
    setCurrentItem(prev => prev ? { ...prev, isFavorite: updated } : null);
  }, [currentItem, updateHistoryItem]);

  // Update memo on current item
  const handleMemoChange = useCallback((memo: string) => {
    if (!currentItem) return;
    updateHistoryItem(currentItem.id, { memo });
    setCurrentItem(prev => prev ? { ...prev, memo } : null);
  }, [currentItem, updateHistoryItem]);

  // Update chat history and persist
  const handleUpdateChatHistory = useCallback((messages: ChatMessage[]) => {
    setChatHistory(messages);
    if (currentItem) {
      updateHistoryItem(currentItem.id, { chatHistory: messages });
    }
  }, [currentItem, updateHistoryItem]);

  // Import items from file
  const handleImportItems = useCallback((items: HistoryItem[]) => {
    addHistoryItems(items);
  }, [addHistoryItems]);

  return (
    <div className={`min-h-screen bg-cream font-nunito text-stone-900 ${theme === 'dark' ? 'dark' : ''}`}>
      <Header currentMode={mode} setMode={setMode} />
      <main className="pt-20 md:pt-0">
        {mode === 'home' && (
          <Home
            onImageUpload={handleImageUpload}
            systemLanguage={settings.systemLanguage || 'English'}
            isAnalyzing={isAnalyzing}
            analysisProgress={analysisProgress}
            onOpenSettings={() => setMode('settings')}
          />
        )}
        {mode === 'analysis' && currentImage && currentItem && (
          <AnalysisView
            image={currentImage}
            analysis={currentItem.analysis}
            onBack={() => setMode('home')}
            settings={settings}
            isFavorite={currentItem.isFavorite || false}
            onToggleFavorite={handleToggleFavorite}
            chatHistory={chatHistory}
            onUpdateChatHistory={handleUpdateChatHistory}
            historyItemId={currentItem.id}
            memo={currentItem.memo || ''}
            onMemoChange={handleMemoChange}
          />
        )}
        {mode === 'history' && (
          <History
            items={historyItems}
            onSelect={handleViewHistoryItem}
            onDeleteItems={deleteHistoryItems}
            onMarkAsExported={markAsExported}
            onImportItems={handleImportItems}
            systemLanguage={settings.systemLanguage || 'English'}
          />
        )}
        {mode === 'settings' && (
          <Settings settings={settings} onSave={saveSettings} />
        )}
        {mode === 'printer' && (
          <StylePrinter mode="standalone" systemLanguage={settings.systemLanguage} />
        )}
        {mode === 'chat' && (
          <ChatBot
            messages={chatHistory}
            onUpdateMessages={handleUpdateChatHistory}
            imageContext={currentImage || undefined}
            systemLanguage={settings.systemLanguage || 'English'}
            settings={settings}
          />
        )}
      </main>
    </div>
  );
};

export default AppWeb;
