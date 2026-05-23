import { useState, useEffect, useCallback } from 'react';
import { get, set } from 'idb-keyval';
import { UserSettings, DEFAULT_SETTINGS, HistoryItem, ChatMessage, AnalysisResult } from '../types';
import { analyzeImage } from '../services/geminiService';
import { processWithConcurrency, withRetry } from '../utils/async';

// ============================================
// useSettings - Settings load/save with IndexedDB
// ============================================
export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await get('visionLearnSettings');
        if (stored) setSettings(stored);
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    };
    load();
  }, []);

  const saveSettings = useCallback((newSettings: UserSettings) => {
    setSettings(newSettings);
    set('visionLearnSettings', newSettings);
  }, []);

  return { settings, saveSettings, isDataLoaded, setIsDataLoaded };
};

// ============================================
// useHistory - History CRUD operations
// ============================================
export const useHistory = () => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const stored = await get('visionLearnHistory');
      if (stored) setHistoryItems(stored);
    } catch (err) {
      console.error("Failed to load history", err);
    }
  }, []);

  const updateHistoryItem = useCallback((id: string, updates: Partial<HistoryItem>) => {
    setHistoryItems(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, ...updates } : item);
      set('visionLearnHistory', updated);
      return updated;
    });
  }, []);

  const deleteHistoryItems = useCallback((ids: string[]) => {
    setHistoryItems(prev => {
      const filtered = prev.filter(item => !ids.includes(item.id));
      set('visionLearnHistory', filtered);
      return filtered;
    });
  }, []);

  const markAsExported = useCallback((ids: string[]) => {
    const now = Date.now();
    setHistoryItems(prev => {
      const updated = prev.map(item =>
        ids.includes(item.id) ? { ...item, lastExported: now, read: true } : item
      );
      set('visionLearnHistory', updated);
      return updated;
    });
  }, []);

  const addHistoryItems = useCallback((newItems: HistoryItem[]) => {
    setHistoryItems(prev => {
      const updated = [...newItems, ...prev];
      set('visionLearnHistory', updated);
      return updated;
    });
  }, []);

  return {
    historyItems,
    loadHistory,
    updateHistoryItem,
    deleteHistoryItems,
    markAsExported,
    addHistoryItems,
  };
};
