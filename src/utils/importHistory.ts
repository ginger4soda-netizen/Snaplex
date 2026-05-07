// ============================================
// Import previously exported Snaplex XLS/HTML files
// ============================================
import { HistoryItem, AnalysisResult, PromptSegment } from '../types';

/**
 * Parse an exported Snaplex .xls file (HTML table format) back into HistoryItem[].
 * The export format has 3 columns: Image | Front Prompt | Back Prompt.
 *
 * Older Snaplex exports often use Excel-compatible HTML with one image cell
 * spanning six prompt rows. Newer/simple exports may keep all six dimensions
 * in one row separated by <br>. This parser supports both forms.
 */
export async function parseExportedFile(file: File): Promise<HistoryItem[]> {
  const html = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('tr'));

  const items: HistoryItem[] = [];
  let current: ImportDraft | null = null;

  const flush = () => {
    if (!current || (!current.imageUrl && !hasAnyPromptText(current.structuredPrompts))) {
      current = null;
      return;
    }

    items.push({
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      imageUrl: current.imageUrl,
      analysis: {
        description: descriptionFromPrompts(current.structuredPrompts),
        structuredPrompts: current.structuredPrompts,
      },
      isFavorite: false,
      chatHistory: [],
      read: true,
      lastExported: Date.now(),
    });
    current = null;
  };

  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('th,td'));
    if (cells.length === 0 || isHeaderRow(cells)) return;

    const imageCellIndex = cells.findIndex(cell => !!cell.querySelector('img'));
    const imageUrl = imageCellIndex >= 0
      ? cells[imageCellIndex].querySelector('img')?.getAttribute('src') || ''
      : '';

    if (imageUrl) {
      flush();
      current = {
        imageUrl,
        structuredPrompts: emptyStructuredPrompts(),
      };
    } else if (!current) {
      current = {
        imageUrl: '',
        structuredPrompts: emptyStructuredPrompts(),
      };
    }

    const promptCells = imageCellIndex >= 0
      ? cells.filter((_, index) => index !== imageCellIndex)
      : cells;
    const frontHtml = promptCells[0]?.innerHTML || '';
    const backHtml = promptCells[1]?.innerHTML || '';

    mergeStructuredPrompts(
      current.structuredPrompts,
      parseDimensionsFromHtml(frontHtml, backHtml)
    );
  });

  flush();
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

type StructuredPrompts = AnalysisResult['structuredPrompts'];

type ImportDraft = {
  imageUrl: string;
  structuredPrompts: StructuredPrompts;
};

function emptyStructuredPrompts(): StructuredPrompts {
  const emptySegment = (): PromptSegment => ({ original: '', translated: '' });
  return {
    subject: emptySegment(),
    environment: emptySegment(),
    composition: emptySegment(),
    lighting: emptySegment(),
    mood: emptySegment(),
    style: emptySegment(),
  };
}

function parseDimensionsFromHtml(
  frontHtml: string,
  backHtml: string
): StructuredPrompts {
  const result = emptyStructuredPrompts();

  const extractDimensions = (html: string): Record<string, string> => {
    const text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim();

    const sections: Record<string, string> = {};
    const dimensionAlternation = DIMENSION_KEYS.join('|');
    const regex = new RegExp(`\\[(${dimensionAlternation})\\]\\s*:?\\s*([\\s\\S]*?)(?=\\[(${dimensionAlternation})\\]\\s*:?|$)`, 'gi');
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
    result[dimKey] = {
      original: frontDims[key] || '',
      translated: backDims[key] || '',
    };
  }

  return result;
}

function mergeStructuredPrompts(target: StructuredPrompts, patch: StructuredPrompts) {
  for (const key of Object.values(DIMENSION_MAP)) {
    if (patch[key].original) {
      target[key].original = appendPromptText(target[key].original, patch[key].original);
    }
    if (patch[key].translated) {
      target[key].translated = appendPromptText(target[key].translated, patch[key].translated);
    }
  }
}

function appendPromptText(existing: string, next: string): string {
  if (!existing) return next;
  if (!next) return existing;
  return `${existing}\n${next}`;
}

function hasAnyPromptText(prompts: StructuredPrompts): boolean {
  return Object.values(prompts).some(segment => segment.original || segment.translated);
}

function descriptionFromPrompts(prompts: StructuredPrompts): string {
  return [
    prompts.subject.original,
    prompts.environment.original,
    prompts.composition.original,
    prompts.lighting.original,
    prompts.mood.original,
    prompts.style.original,
  ].filter(Boolean).join(' ').slice(0, 500);
}

function isHeaderRow(cells: Element[]): boolean {
  const text = cells.map(cell => (cell.textContent || '').trim().toLowerCase()).join('|');
  return text.includes('image') && text.includes('front prompt') && text.includes('back prompt');
}
