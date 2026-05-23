import { describe, it, expect } from 'vitest';
import { dedupSources } from './dedupSources';
import type { ImageSource } from '@/types';

const base: Omit<ImageSource, 'id'> = {
  imageId: 'img-1',
  captureType: 'image',
  sourceUrl: 'https://cdn.example.com/photo.jpg',
  pageUrl: 'https://example.com/article',
  pageTitle: 'Article',
  sourceDomain: 'example.com',
  capturedAt: '2026-05-07T10:00:00.000Z',
  clientId: 'browser-extension',
  metadataJson: null,
};

const make = (id: number, overrides: Partial<ImageSource> = {}): ImageSource => ({
  id,
  ...base,
  ...overrides,
});

describe('dedupSources', () => {
  it('drops fully identical duplicates (same type/page_url/source_url/capturedAt)', () => {
    const list = [make(1), make(2), make(3)];
    expect(dedupSources(list)).toHaveLength(1);
    expect(dedupSources(list)[0].id).toBe(1);
  });

  it('keeps different page_url even if other fields match', () => {
    const list = [make(1), make(2, { pageUrl: 'https://example.com/article-2' })];
    expect(dedupSources(list)).toHaveLength(2);
  });

  it('keeps different source_url when page_url is missing', () => {
    const list = [
      make(1, { pageUrl: null, sourceUrl: 'https://a.example/a.jpg' }),
      make(2, { pageUrl: null, sourceUrl: 'https://a.example/b.jpg' }),
    ];
    expect(dedupSources(list)).toHaveLength(2);
  });

  it('keeps different captureType', () => {
    const list = [make(1), make(2, { captureType: 'screenshot_visible' })];
    expect(dedupSources(list)).toHaveLength(2);
  });

  it('treats trailing slash and case differences as same url', () => {
    const list = [
      make(1, { pageUrl: 'https://Example.com/Article/' }),
      make(2, { pageUrl: 'https://example.com/Article' }),
    ];
    expect(dedupSources(list)).toHaveLength(1);
  });

  it('keeps different capturedAt as separate captures', () => {
    const list = [make(1), make(2, { capturedAt: '2026-05-07T11:00:00.000Z' })];
    expect(dedupSources(list)).toHaveLength(2);
  });

  it('preserves order - first occurrence wins', () => {
    const list = [make(2), make(1)];
    const out = dedupSources(list);
    expect(out[0].id).toBe(2);
  });

  it('handles legacy import duplicates with same captured_at and same source_url', () => {
    const legacy = make(10, {
      clientId: 'desktop-import',
      captureType: 'image',
      pageUrl: null,
      sourceUrl: 'file:///legacy/x.jpg',
    });
    const list = [legacy, { ...legacy, id: 11 }, { ...legacy, id: 12 }];
    expect(dedupSources(list)).toHaveLength(1);
  });
});
