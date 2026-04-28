import { describe, it, expect } from 'vitest';
import { cardRectAtIndex, rectsIntersect, GRID_GAP, GRID_PADDING } from './gridGeometry';

describe('gridGeometry', () => {
  it('exports layout constants matching Tailwind p-6/gap-6', () => {
    expect(GRID_GAP).toBe(24);
    expect(GRID_PADDING).toBe(24);
  });

  describe('cardRectAtIndex', () => {
    it('places index 0 at top-left padding', () => {
      const r = cardRectAtIndex(0, 4, 200, GRID_GAP, GRID_PADDING, GRID_PADDING);
      expect(r).toEqual({ left: 24, top: 24, right: 224, bottom: 224 });
    });

    it('places index 1 to the right of index 0 with gap', () => {
      const r = cardRectAtIndex(1, 4, 200, GRID_GAP, GRID_PADDING, GRID_PADDING);
      expect(r.left).toBe(24 + 200 + 24); // padding + cellSize + gap
      expect(r.top).toBe(24);
    });

    it('wraps to next row when index reaches columnCount', () => {
      const r = cardRectAtIndex(4, 4, 200, GRID_GAP, GRID_PADDING, GRID_PADDING);
      expect(r.left).toBe(24);
      expect(r.top).toBe(24 + 200 + 24);
    });

    it('handles 1-column layout', () => {
      const r0 = cardRectAtIndex(0, 1, 300, GRID_GAP, GRID_PADDING, GRID_PADDING);
      const r1 = cardRectAtIndex(1, 1, 300, GRID_GAP, GRID_PADDING, GRID_PADDING);
      expect(r0.left).toBe(24);
      expect(r1.left).toBe(24);
      expect(r1.top).toBe(24 + 300 + 24);
    });

    it('handles index past first row in 3-column layout', () => {
      const r = cardRectAtIndex(7, 3, 100, GRID_GAP, GRID_PADDING, GRID_PADDING);
      // row=2, col=1
      expect(r.left).toBe(24 + 100 + 24);
      expect(r.top).toBe(24 + 2 * (100 + 24));
    });
  });

  describe('rectsIntersect', () => {
    const A = { left: 0, top: 0, right: 100, bottom: 100 };

    it('returns true for fully overlapping rects', () => {
      expect(rectsIntersect(A, { left: 10, top: 10, right: 50, bottom: 50 })).toBe(true);
    });

    it('returns true for partially overlapping rects', () => {
      expect(rectsIntersect(A, { left: 50, top: 50, right: 150, bottom: 150 })).toBe(true);
    });

    it('returns false for disjoint rects (right of A)', () => {
      expect(rectsIntersect(A, { left: 200, top: 0, right: 300, bottom: 100 })).toBe(false);
    });

    it('returns false for disjoint rects (below A)', () => {
      expect(rectsIntersect(A, { left: 0, top: 200, right: 100, bottom: 300 })).toBe(false);
    });

    it('returns false for edge-touching rects (open intervals)', () => {
      expect(rectsIntersect(A, { left: 100, top: 0, right: 200, bottom: 100 })).toBe(false);
    });
  });
});
