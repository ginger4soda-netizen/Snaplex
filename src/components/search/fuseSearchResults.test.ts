import { describe, it, expect } from 'vitest';
import { fuseSearchResults } from './SearchBar';
import type { SearchResult } from '../../types';

describe('fuseSearchResults', () => {
  it('returns an empty list when given no sources', () => {
    expect(fuseSearchResults([])).toEqual([]);
  });

  it('returns an empty list when all sources are empty', () => {
    expect(fuseSearchResults([[], [], []])).toEqual([]);
  });

  it('orders results within a single source by descending score', () => {
    const fts: SearchResult[] = [
      { imageId: 'low', score: 1, matchType: 'fts' },
      { imageId: 'high', score: 10, matchType: 'fts' },
      { imageId: 'mid', score: 5, matchType: 'fts' },
    ];
    expect(fuseSearchResults([fts])).toEqual(['high', 'mid', 'low']);
  });

  it('boosts an image that appears in multiple sources above a single-source peer with the same normalized score', () => {
    // 'multi' tops both fts and clip groups; 'solo' tops embedding alone.
    const fts: SearchResult[] = [
      { imageId: 'multi', score: 10, matchType: 'fts' },
      { imageId: 'fts-tail', score: 0, matchType: 'fts' },
    ];
    const clip: SearchResult[] = [
      { imageId: 'multi', score: 10, matchType: 'clip' },
      { imageId: 'clip-tail', score: 0, matchType: 'clip' },
    ];
    const embedding: SearchResult[] = [
      { imageId: 'solo', score: 10, matchType: 'embedding' },
      { imageId: 'emb-tail', score: 0, matchType: 'embedding' },
    ];

    const order = fuseSearchResults([fts, clip, embedding]);
    expect(order.indexOf('multi')).toBeLessThan(order.indexOf('solo'));
  });

  it('weights FTS above embedding above CLIP when each tops its own source alone', () => {
    // Each top result is alone-best in its source group → all normalize to 1.0.
    // Only the per-source weight differentiates them.
    const fts: SearchResult[] = [
      { imageId: 'fts-top', score: 10, matchType: 'fts' },
      { imageId: 'fts-tail', score: 0, matchType: 'fts' },
    ];
    const embedding: SearchResult[] = [
      { imageId: 'emb-top', score: 10, matchType: 'embedding' },
      { imageId: 'emb-tail', score: 0, matchType: 'embedding' },
    ];
    const clip: SearchResult[] = [
      { imageId: 'clip-top', score: 10, matchType: 'clip' },
      { imageId: 'clip-tail', score: 0, matchType: 'clip' },
    ];

    const order = fuseSearchResults([fts, embedding, clip]);
    expect(order.slice(0, 3)).toEqual(['fts-top', 'emb-top', 'clip-top']);
  });

  it('returns each imageId at most once when present in multiple sources', () => {
    const fts: SearchResult[] = [{ imageId: 'shared', score: 5, matchType: 'fts' }];
    const embedding: SearchResult[] = [{ imageId: 'shared', score: 9, matchType: 'embedding' }];
    const clip: SearchResult[] = [{ imageId: 'shared', score: 3, matchType: 'clip' }];

    const order = fuseSearchResults([fts, embedding, clip]);
    expect(order).toEqual(['shared']);
  });
});
