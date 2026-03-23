/**
 * Web-only App component.
 * Uses IndexedDB-based state (useAppState) and web-only components.
 * No Tauri dependencies — runs in any browser.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useSettings, useHistory } from './hooks/useAppState';
import { AppMode, HistoryItem, ChatMessage, UserSettings } from './types';
import Header from './components/Header';
import Home from './components/Home';
import AnalysisView from './components/AnalysisView';
import History from './components/History';
import Settings from './components/Settings';
import StylePrinter from './components/StylePrinter';
import ChatBot from './components/ChatBot';
import { useTheme } from './hooks/useTheme';

const AppWeb: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('home');
  const { settings, saveSettings, isDataLoaded, setIsDataLoaded } = useSettings();
  const { historyItems, loadHistory, saveHistoryItem, deleteHistoryItems, updateHistoryItem } = useHistory();
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentItem, setCurrentItem] = useState<HistoryItem | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    loadHistory().then(() => setIsDataLoaded(true));
  }, []);

  const handleImageCapture = useCallback((imageUrl: string) => {
    setCurrentImage(imageUrl);
    setMode('analysis');
    setChatHistory([]);
  }, []);

  const handleAnalysisComplete = useCallback(async (item: HistoryItem) => {
    await saveHistoryItem(item);
    setCurrentItem(item);
  }, [saveHistoryItem]);

  const handleViewHistoryItem = useCallback((item: HistoryItem) => {
    setCurrentItem(item);
    setCurrentImage(item.imageUrl);
    setChatHistory(item.chatHistory || []);
    setMode('analysis');
  }, []);

  return (
    <div className={`min-h-screen bg-cream font-nunito text-stone-900 ${theme === 'dark' ? 'dark' : ''}`}>
      <Header currentMode={mode} setMode={setMode} />
      <main className="pt-20 md:pt-0">
        {mode === 'home' && (
          <Home
            onImageCapture={handleImageCapture}
            settings={settings}
            systemLanguage={settings.systemLanguage || 'English'}
          />
        )}
        {mode === 'analysis' && currentImage && (
          <AnalysisView
            image={currentImage}
            settings={settings}
            systemLanguage={settings.systemLanguage || 'English'}
            onBack={() => setMode('home')}
            onSaveToHistory={handleAnalysisComplete}
            chatHistory={chatHistory}
            onChatUpdate={setChatHistory}
            existingItem={currentItem}
          />
        )}
        {mode === 'history' && (
          <History
            items={historyItems}
            onItemClick={handleViewHistoryItem}
            onDeleteItems={deleteHistoryItems}
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
            image={currentImage || undefined}
            settings={settings}
            onBack={() => setMode(currentImage ? 'analysis' : 'home')}
          />
        )}
      </main>
    </div>
  );
};

export default AppWeb;
