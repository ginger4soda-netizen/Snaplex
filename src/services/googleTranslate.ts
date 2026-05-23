// ============================================
// Google Translate Service
// ============================================
// Dedicated service for prompt card back-face translation.
// Uses Google's free translate endpoint (no API key needed).
// Replaces expensive AI translation for prompt cards.

const LANG_MAP: Record<string, string> = {
  'English': 'en',
  'Chinese': 'zh-CN',
  'Spanish': 'es',
  'Japanese': 'ja',
  'French': 'fr',
  'German': 'de',
  'Korean': 'ko',
};

// Simple in-memory cache to avoid re-translating identical text
const cache = new Map<string, string>();
const MAX_CACHE = 500;

function cacheKey(text: string, target: string): string {
  return `${target}::${text}`;
}

/**
 * Translate text using Google's free translate endpoint.
 * Optimized for prompt card translation with caching.
 */
export async function googleTranslate(
  text: string,
  targetLanguage: string,
  sourceLanguage: string = 'auto'
): Promise<string> {
  if (!text.trim()) return '';

  const tl = LANG_MAP[targetLanguage] || targetLanguage.slice(0, 2).toLowerCase();
  const sl = LANG_MAP[sourceLanguage] || (sourceLanguage === 'auto' ? 'auto' : sourceLanguage.slice(0, 2).toLowerCase());

  // Check cache
  const key = cacheKey(text, tl);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) return '';

    const data = await response.json();
    // Response format: [[["translated text","original text",null,null,X],...],...]
    const result = (data[0] as any[])
      .map((segment: any) => segment[0])
      .join('');

    // Store in cache (evict oldest if full)
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
    cache.set(key, result);

    return result;
  } catch (e) {
    console.warn('Google Translate failed:', e);
    return '';
  }
}

/**
 * Batch translate multiple texts in sequence (rate-limit friendly).
 * Uses a small delay between requests to avoid Google rate limits.
 */
export async function googleTranslateBatch(
  texts: string[],
  targetLanguage: string,
  delayMs: number = 100
): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const result = await googleTranslate(texts[i], targetLanguage);
    results.push(result);
    // Small delay between requests to avoid rate limiting
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

/**
 * Translate all 6 dimensions of a prompt analysis.
 * More efficient than translating each dimension individually.
 */
export async function translatePromptDimensions(
  dimensions: Record<string, string>,
  targetLanguage: string
): Promise<Record<string, string>> {
  const entries = Object.entries(dimensions).filter(([_, v]) => v.trim());
  if (entries.length === 0) return {};

  const translations = await googleTranslateBatch(
    entries.map(([_, v]) => v),
    targetLanguage,
    50 // Smaller delay for dimension batch
  );

  const result: Record<string, string> = {};
  entries.forEach(([key], i) => {
    result[key] = translations[i];
  });
  return result;
}

/** Clear the translation cache */
export function clearTranslateCache(): void {
  cache.clear();
}
