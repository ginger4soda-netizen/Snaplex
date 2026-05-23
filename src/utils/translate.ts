// ============================================
// Free Translation via Google Translate (no API key needed)
// ============================================

const LANG_MAP: Record<string, string> = {
  'English': 'en', 'Chinese': 'zh-CN', 'Spanish': 'es',
  'Japanese': 'ja', 'French': 'fr', 'German': 'de', 'Korean': 'ko',
};

/**
 * Translate text using Google's free translate endpoint.
 * No API key required. Rate limits are generous for light usage.
 */
export async function freeTranslate(text: string, targetLanguage: string): Promise<string> {
  if (!text.trim()) return '';

  const tl = LANG_MAP[targetLanguage] || targetLanguage.slice(0, 2).toLowerCase();

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) return '';

    const data = await response.json();
    // Response format: [[["translated text","original text",null,null,X],...],...]
    return (data[0] as any[])
      .map((segment: any) => segment[0])
      .join('');
  } catch (e) {
    console.warn('Translation failed:', e);
    return '';
  }
}

/**
 * Create a debounced version of a function.
 * The function will only be called after `delay` ms of inactivity.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
