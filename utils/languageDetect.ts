/**
 * Language detection utility for auto-correcting AI response field mapping.
 * Uses Chinese character ratio to determine primary language.
 */

export interface LanguageDetectionResult {
    language: 'Chinese' | 'English' | 'Unknown';
    confidence: number;
}

/**
 * Detect the primary language of a text string.
 * @returns Language with confidence score (0-1)
 */
export const detectLanguage = (text: string): LanguageDetectionResult => {
    if (!text || text === 'N/A' || text.trim().length < 5) {
        return { language: 'Unknown', confidence: 0 };
    }

    // Count Chinese characters (CJK Unified Ideographs)
    const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
    const totalChars = text.replace(/\s/g, '').length;

    if (totalChars === 0) return { language: 'Unknown', confidence: 0 };

    const chineseRatio = chineseChars.length / totalChars;

    if (chineseRatio > 0.3) {
        return { language: 'Chinese', confidence: Math.min(chineseRatio * 1.5, 1) };
    }
    if (chineseRatio < 0.1) {
        return { language: 'English', confidence: Math.min((1 - chineseRatio) * 1.2, 1) };
    }

    // Mixed content - low confidence
    return { language: chineseRatio > 0.15 ? 'Chinese' : 'English', confidence: 0.5 };
};

/**
 * Determine if content fields should be swapped based on user settings.
 * Returns swapped content if needed, otherwise original content.
 */
export const getCorrectDisplayOrder = (
    original: string,
    translated: string,
    userFrontLanguage: string
): { front: string; back: string; wasSwapped: boolean } => {
    const originalLang = detectLanguage(original);

    // Only swap with high confidence
    if (originalLang.confidence < 0.7) {
        return { front: original, back: translated, wasSwapped: false };
    }

    const wantsChinese = userFrontLanguage.toLowerCase().includes('chinese') ||
        userFrontLanguage.toLowerCase().includes('中文');
    const originalIsChinese = originalLang.language === 'Chinese';

    // Swap if mismatch: user wants Chinese but original is English, or vice versa
    const shouldSwap = wantsChinese !== originalIsChinese;

    return shouldSwap
        ? { front: translated, back: original, wasSwapped: true }
        : { front: original, back: translated, wasSwapped: false };
};
