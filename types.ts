export interface UserSettings {
  persona: string;
  descriptionStyle: string; // e.g., "Standard", "Artistic", "Cinematic"
  cardFrontLanguage?: string; // Default 'EN'
  cardBackLanguage?: string; // Default 'CN'
  systemLanguage?: string; // Default 'EN'
  copyIncludedModules?: string[]; // E.g., ['Subject', 'Style']
}

export interface PromptSegment {
  original: string;
  translated: string;
}

export interface AnalysisResult {
  description: string; 
  structuredPrompts: {
    subject: PromptSegment;
    environment: PromptSegment;
    composition: PromptSegment;
    lighting: PromptSegment;
    style: PromptSegment;
    mood: PromptSegment;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// ✅ 修改点：新增 'printer' 模式
export type AppMode = 'home' | 'analysis' | 'chat' | 'history' | 'settings' | 'printer';

export interface HistoryItem {
  id: string;
  timestamp: number;
  imageUrl: string;
  analysis: AnalysisResult;
  isFavorite?: boolean;
  chatHistory?: ChatMessage[];
  read?: boolean; 
  lastExported?: number; // Timestamp of last export
}

export const DEFAULT_SETTINGS: UserSettings = {
  persona: "",
  descriptionStyle: "Standard",
  cardFrontLanguage: "English",
  cardBackLanguage: "Chinese",
  systemLanguage: "English",
  copyIncludedModules: ["Subject", "Environment", "Composition", "Lighting", "Mood", "Style"]
};