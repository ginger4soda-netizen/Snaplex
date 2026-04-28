import { RefObject, useEffect, useState } from 'react';
import { GRID_GAP, GRID_PADDING } from '@/utils/gridGeometry';

export interface GridDimensions {
  columnCount: number;
  rowHeight: number;
}

function computeColumnCount(containerWidth: number, cellSize: number): number {
  if (containerWidth <= 0) return 1;
  return Math.max(
    1,
    Math.floor((containerWidth - 2 * GRID_PADDING + GRID_GAP) / (cellSize + GRID_GAP))
  );
}

export function useGridDimensions(
  containerRef: RefObject<HTMLElement | null>,
  cellSize: number
): GridDimensions {
  const [dims, setDims] = useState<GridDimensions>(() => ({
    columnCount: 1,
    rowHeight: cellSize + GRID_GAP,
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = (width: number) => {
      const columnCount = computeColumnCount(width, cellSize);
      const rowHeight = cellSize + GRID_GAP;
      setDims(prev => {
        if (prev.columnCount === columnCount && prev.rowHeight === rowHeight) {
          return prev; // short-circuit identical values
        }
        return { columnCount, rowHeight };
      });
    };

    update(el.clientWidth);

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, cellSize]);

  return dims;
}
