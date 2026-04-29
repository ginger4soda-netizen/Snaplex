import { RefObject, useEffect, useState } from 'react';
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const cols = Math.max(1, columnCount);
  const cellSize = computeCellSize(width, cols);
  const rowHeight = cellSize + GRID_GAP;
  return { columnCount: cols, cellSize, rowHeight };
}
