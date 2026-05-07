import type { ImageSource } from '@/types';

const normalizeUrl = (raw: string | null | undefined): string => {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}${url.hash}`;
  } catch {
    return raw.trim();
  }
};

const dedupKey = (source: ImageSource): string => {
  const page = normalizeUrl(source.pageUrl);
  const src = normalizeUrl(source.sourceUrl);
  const urlKey = page || src;
  return [source.captureType, urlKey, source.capturedAt].join('|');
};

export const dedupSources = (sources: ImageSource[]): ImageSource[] => {
  const seen = new Set<string>();
  const deduped: ImageSource[] = [];

  for (const source of sources) {
    const key = dedupKey(source);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }

  return deduped;
};
