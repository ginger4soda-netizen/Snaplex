// ============================================
// Unified AI Service - Multi-Provider Support
// ============================================
// This file now delegates to pluggable providers.
// The actual implementations are in ./providers/

import { AnalysisResult, UserSettings, ChatMessage, HistoryItem, DimensionKey, PromptSegment } from "../types";
import { getProvider, TermExplanation, getCurrentProvider, getCurrentModel } from "./providers";
import { trackError, trackApiStatus, trackPerformance } from "../observability";

// Re-export types for backward compatibility
export type { TermExplanation } from "./providers";

// --- API Functions (Delegating to Providers) ---

export const analyzeImage = async (
  base64Image: string,
  settings: UserSettings
): Promise<AnalysisResult> => {
  const providerName = getCurrentProvider();
  const modelName = getCurrentModel();

  // 🔭 Start performance tracking
  trackPerformance.analysisStart();

  try {
    const provider = getProvider();
    const result = await provider.analyzeImage(base64Image, settings);

    // 🔭 Track success
    trackApiStatus(providerName, modelName, 'success');
    trackPerformance.analysisEnd(modelName, providerName);

    return result;
  } catch (error) {
    // 🔭 Track failure
    const err = error as Error;
    const httpStatus = (err as any).status || (err as any).statusCode;

    trackApiStatus(providerName, modelName, 'error', httpStatus);
    trackPerformance.analysisEnd(modelName, providerName);

    trackError(err, {
      provider: providerName,
      model_name: modelName,
      api_status: 'error',
      error_type: err.name || 'AnalysisError',
      http_status: httpStatus,
      image_count: 1,
    });

    console.error("Analysis failed:", error);
    throw error;
  }
};

export const searchHistory = async (query: string, history: HistoryItem[]): Promise<string[]> => {
  if (!query.trim() || !history.length) return [];

  // ✅ Safe helper function to extract searchable text from item
  const extractItemText = (item: HistoryItem): string => {
    const sp = item.analysis.structuredPrompts;
    const dimensions = [
      sp?.subject?.original || '',
      sp?.subject?.translated || '',
      sp?.environment?.original || '',
      sp?.environment?.translated || '',
      sp?.composition?.original || '',
      sp?.composition?.translated || '',
      sp?.lighting?.original || '',
      sp?.lighting?.translated || '',
      sp?.mood?.original || '',
      sp?.mood?.translated || '',
      sp?.style?.original || '',
      sp?.style?.translated || '',
    ].filter(Boolean); // Remove empty strings

    return (
      (item.analysis.description || "") + " " + dimensions.join(" ")
    ).toLowerCase();
  };

  try {
    const provider = getProvider();
    const conceptGroups = await provider.expandSearchQuery(query);

    if (conceptGroups.length === 0) throw new Error("No concepts found");

    // Local Filtering with Expanded Logic
    return history.filter(item => {
      const itemText = extractItemText(item);

      // Logic: Match ALL concept groups (AND), within each group match ANY synonym (OR)
      return conceptGroups.every(group => {
        return group.some(word => itemText.includes(word.toLowerCase()));
      });
    }).map(h => h.id);

  } catch (e) {
    console.warn("Semantic search expansion failed, falling back to strict matching.", e);

    // Fallback: Strict local keyword matching
    const terms = query.toLowerCase().split(/\s+/).filter(t => t);
    return history.filter(item => {
      const itemText = extractItemText(item);
      return terms.every(term => itemText.includes(term));
    }).map(h => h.id);
  }
};

export const sendChatMessageStream = async (
  history: ChatMessage[],
  message: string,
  image: string | undefined,
  onUpdate: (text: string) => void,
  settings?: UserSettings
): Promise<void> => {
  const providerName = getCurrentProvider();
  const modelName = getCurrentModel();
  let firstToken = true;

  // 🔭 Start chat performance tracking
  trackPerformance.chatMessageStart();

  try {
    const provider = getProvider();
    await provider.chatStream(history, message, image, (text) => {
      // 🔭 Track time to first token
      if (firstToken && text.length > 0) {
        trackPerformance.chatFirstToken();
        firstToken = false;
      }
      onUpdate(text);
    }, settings);

    // 🔭 Track chat completion
    trackPerformance.chatMessageEnd();
    trackApiStatus(providerName, modelName, 'success');

  } catch (e: any) {
    trackPerformance.chatMessageEnd();
    trackApiStatus(providerName, modelName, 'error', e.status);

    trackError(e, {
      provider: providerName,
      model_name: modelName,
      api_status: 'error',
      error_type: 'ChatStreamError',
      prompt_length: message.length,
    });

    console.error("Chat Stream Error:", e);
    if (e.message === "MISSING_API_KEY") {
      onUpdate("Please set your API Key in Settings.");
    } else {
      onUpdate("Connection error or invalid API Key.");
    }
  }
};

// Regenerate a single dimension
export const regenerateDimension = async (
  base64Image: string,
  dimension: DimensionKey,
  settings: UserSettings
): Promise<PromptSegment> => {
  const providerName = getCurrentProvider();
  const modelName = getCurrentModel();

  // 🔭 Track dimension refresh performance
  trackPerformance.dimensionRefreshStart(dimension);

  try {
    const provider = getProvider();
    const result = await provider.regenerateDimension(base64Image, dimension, settings);

    trackPerformance.dimensionRefreshEnd(dimension, modelName);
    trackApiStatus(providerName, modelName, 'success');

    return result;
  } catch (error) {
    const err = error as Error;
    trackPerformance.dimensionRefreshEnd(dimension, modelName);
    trackApiStatus(providerName, modelName, 'error');

    trackError(err, {
      provider: providerName,
      model_name: modelName,
      api_status: 'error',
      error_type: 'DimensionRefreshError',
      dimension: dimension,
    });

    console.error(`Regeneration failed for ${dimension}:`, error);
    throw error;
  }
};

export const explainVisualTerm = async (term: string, language: string): Promise<TermExplanation> => {
  const providerName = getCurrentProvider();
  const modelName = getCurrentModel();

  // 🔭 Track term explanation performance
  trackPerformance.termExplainStart();

  try {
    const provider = getProvider();
    const result = await provider.explainTerm(term, language);

    trackPerformance.termExplainEnd(term);
    trackApiStatus(providerName, modelName, 'success');

    return result;
  } catch (error) {
    trackPerformance.termExplainEnd(term);
    trackApiStatus(providerName, modelName, 'error');

    const err = error as Error;
    trackError(err, {
      provider: providerName,
      model_name: modelName,
      api_status: 'error',
      error_type: 'TermExplainError',
    });

    console.error("Explain term failed:", error);
    const errorMessage = (error as any).message || String(error);

    return {
      def: errorMessage.includes("MISSING_API_KEY")
        ? (language.startsWith("Chinese") ? "API Key 缺失" : "Missing API Key")
        : `Error: ${errorMessage.slice(0, 15)}...`,
      app: errorMessage.includes("MISSING_API_KEY")
        ? (language.startsWith("Chinese") ? "请在设置中配置" : "Check settings")
        : "Check Console (F12)"
    };
  }
};

export const translateText = async (text: string, language: string): Promise<string> => {
  try {
    const provider = getProvider();
    return await provider.translateText(text, language);
  } catch (error) {
    console.error("Translation failed:", error);
    return "";
  }
};