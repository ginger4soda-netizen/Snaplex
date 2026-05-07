import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { GRID_GAP, GRID_PADDING } from '@/utils/gridGeometry';

export interface GridDimensions {
  columnCount: number;
  cellSize: number;
  rowHeight: number;
}

function computeCellSize(containerWidth: number, columnCount: number): number {
  const cols = Math.max(1, columnCount);
  const usable = containerWidth - 2 * GRID_PADDING - (cols - 1) * GRID_GAP;
  if (usable <= 0) return 0;
  return usable / cols;
}

/**
 * Column-driven grid sizing. Caller picks how many columns to show; we derive
 * the per-cell size from the container width so cards fill the row with
 * uniform spacing and equal left/right padding.
 */
export function useGridDimensions(
  containerRef: RefObject<HTMLElement | null>,
  columnCount: number
): GridDimensions {
  const [width, setWidth] = useState(0);
  const rafRef = useRef<number | null>(null);
  const nestedRafRef = useRef<number | null>(null);
  const lastWidthRef = useRef(0);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rectWidth = typeof el.getBoundingClientRect === 'function'
      ? el.getBoundingClientRect().width
      : 0;
    const nextWidth = rectWidth || el.clientWidth;
    if (nextWidth !== lastWidthRef.current) {
      lastWidthRef.current = nextWidth;
      setWidth(nextWidth);
    }
  }, [containerRef]);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    if (nestedRafRef.current !== null) {
      cancelAnimationFrame(nestedRafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      nestedRafRef.current = requestAnimationFrame(() => {
        nestedRafRef.current = null;
        measure();
      });
    });
  }, [measure]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const nextWidth = entry.contentRect.width;
        if (nextWidth !== lastWidthRef.current) {
          lastWidthRef.current = nextWidth;
          setWidth(nextWidth);
        }
      }
      scheduleMeasure();
    });
    ro.observe(el);

    const handleWindowResize = () => scheduleMeasure();
    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === 'width' || event.propertyName === 'flex-basis' || event.propertyName === 'all') {
        scheduleMeasure();
      }
    };

    window.addEventListener('resize', handleWindowResize);
    document.addEventListener('transitionend', handleTransitionEnd, true);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('transitionend', handleTransitionEnd, true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (nestedRafRef.current !== null) cancelAnimationFrame(nestedRafRef.current);
      rafRef.current = null;
      nestedRafRef.current = null;
    };
  }, [containerRef, measure, scheduleMeasure]);

  const cols = Math.max(1, columnCount);
  const cellSize = computeCellSize(width, cols);
  const rowHeight = cellSize + GRID_GAP;
  return { columnCount: cols, cellSize, rowHeight };
}
