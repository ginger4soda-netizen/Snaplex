import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useGridDimensions } from './useGridDimensions';

declare const __ResizeObserverMock: {
  instances: Array<{ _trigger: (w: number, h: number) => void }>;
};

beforeEach(() => {
  __ResizeObserverMock.instances.length = 0;
});

function setup(cellSize: number, initialWidth = 0) {
  const { result } = renderHook(() => {
    const ref = useRef<HTMLDivElement>({ clientWidth: initialWidth } as HTMLDivElement);
    const dims = useGridDimensions(ref, cellSize);
    return { ref, dims };
  });
  return result;
}

describe('useGridDimensions', () => {
  it('returns sensible defaults before any resize fires', () => {
    const r = setup(200);
    expect(r.current.dims.columnCount).toBeGreaterThanOrEqual(1);
    expect(r.current.dims.rowHeight).toBe(200 + 24); // cellSize + GRID_GAP
  });

  it('computes columnCount from container width', () => {
    const r = setup(200);
    act(() => {
      __ResizeObserverMock.instances[0]._trigger(1024, 800);
    });
    // (1024 - 2*24 + 24) / (200 + 24) = 1000/224 = 4.46 → floor = 4
    expect(r.current.dims.columnCount).toBe(4);
    expect(r.current.dims.rowHeight).toBe(224);
  });

  it('computes 1 column when container too narrow', () => {
    const r = setup(300);
    act(() => {
      __ResizeObserverMock.instances[0]._trigger(200, 800);
    });
    // (200 - 48 + 24) / (300 + 24) = 176/324 = 0.54 → floor → max(1) = 1
    expect(r.current.dims.columnCount).toBe(1);
  });

  it('updates rowHeight when cellSize changes', () => {
    let cellSize = 200;
    const { result, rerender } = renderHook(() => {
      const ref = useRef<HTMLDivElement>({ clientWidth: 1000 } as HTMLDivElement);
      return useGridDimensions(ref, cellSize);
    });
    act(() => {
      __ResizeObserverMock.instances[0]._trigger(1000, 800);
    });
    expect(result.current.rowHeight).toBe(224);
    cellSize = 300;
    rerender();
    expect(result.current.rowHeight).toBe(324);
  });
});
