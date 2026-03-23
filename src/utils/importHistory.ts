// ============================================
// Import previously exported Snaplex XLS/HTML files
// ============================================
import { HistoryItem, AnalysisResult, PromptSegment } from '../types';

/**
 * Parse an exported Snaplex .xls file (HTML table format) back into HistoryItem[].
 * The export format has 3 columns: Image | Front Prompt | Back Prompt
 */
export async function parseExportedFile(file: File): Promise<HistoryItem[]> {
  const html = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('tbody tr');

  const items: HistoryItem[] = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) return;

    // Extract image
    const img = cells[0].querySelector('img');
    const imageUrl = img?.getAttribute('src') || '';
    if (!imageUrl) return; // Skip rows without images

    // Extract front and back prompts
    const frontHtml = cells[1].innerHTML;
    const backHtml = cells[2].innerHTML;

    // Parse structured prompts from the [DIMENSION]: format
    const structuredPrompts = parseDimensionsFromHtml(frontHtml, backHtml);

    const item: HistoryItem = {
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      imageUrl,
      analysis: {
        description: '',
        structuredPrompts,
      },
      isFavorite: false,
      chatHistory: [],
      read: true,
      lastExported: Date.now(), // Mark as already exported since it came from export
    };

    items.push(item);
  });

  return items;
}

const DIMENSION_KEYS = ['SUBJECT', 'ENVIRONMENT', 'COMPOSITION', 'LIGHTING', 'MOOD', 'STYLE'] as const;
const DIMENSION_MAP: Record<string, keyof AnalysisResult['structuredPrompts']> = {
  'SUBJECT': 'subject',
  'ENVIRONMENT': 'environment',
  'COMPOSITION': 'composition',
  'LIGHTING': 'lighting',
  'MOOD': 'mood',
  'STYLE': 'style',
};

function parseDimensionsFromHtml(
  frontHtml: string,
  backHtml: string
): AnalysisResult['structuredPrompts'] {
  const emptySegment = (): PromptSegment => ({ original: '', translated: '' });
  const result: AnalysisResult['structuredPrompts'] = {
    subject: emptySegment(),
    environment: emptySegment(),
    composition: emptySegment(),
    lighting: emptySegment(),
    mood: emptySegment(),
    style: emptySegment(),
  };

  const extractDimensions = (html: string): Record<string, string> => {
    // Convert <br> to newlines for easier parsing
    const text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '') // strip remaining HTML tags
      .trim();

    const sections: Record<string, string> = {};
    const regex = /\[(\w+)\]:\s*([\s\S]*?)(?=\[\w+\]:|$)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      sections[match[1].toUpperCase()] = match[2].trim();
    }
    return sections;
  };

  const frontDims = extractDimensions(frontHtml);
  const backDims = extractDimensions(backHtml);

  for (const key of DIMENSION_KEYS) {
    const dimKey = DIMENSION_MAP[key];
    if (dimKey) {
      result[dimKey] = {
        original: frontDims[key] || '',
        translated: backDims[key] || '',
      };
    }
  }

  return result;
}
