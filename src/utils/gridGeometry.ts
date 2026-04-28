export const GRID_GAP = 24;       // matches Tailwind gap-6
export const GRID_PADDING = 24;   // matches Tailwind p-6 on scroll container

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function cardRectAtIndex(
  index: number,
  columnCount: number,
  cellSize: number,
  gap: number,
  paddingX: number,
  paddingY: number
): Rect {
  const row = Math.floor(index / columnCount);
  const col = index % columnCount;
  const left = paddingX + col * (cellSize + gap);
  const top = paddingY + row * (cellSize + gap);
  return {
    left,
    top,
    right: left + cellSize,
    bottom: top + cellSize,
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
