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

// Custom preset chip for chat
export interface CustomChip {
  id: string;
  label: string;
  prompt: string;
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
  lastViewedAt?: number; // Timestamp of last view
  lastExported?: number; // Timestamp of last export
  dimensionHistories?: DimensionHistories; // Track regeneration history per dimension
}

// Dimension types
export type DimensionKey = 'subject' | 'environment' | 'composition' | 'lighting' | 'mood' | 'style';

// History tracking for each dimension
export interface DimensionHistory {
  versions: PromptSegment[]; // Array of historical versions
  currentIndex: number; // Which version is currently displayed
}

export type DimensionHistories = {
  [K in DimensionKey]?: DimensionHistory;
};

export const DEFAULT_SETTINGS: UserSettings = {
  persona: "",
  descriptionStyle: "Standard",
  cardFrontLanguage: "English",
  cardBackLanguage: "Chinese",
  systemLanguage: "English",
  copyIncludedModules: ["Subject", "Environment", "Composition", "Lighting", "Mood", "Style"]
};