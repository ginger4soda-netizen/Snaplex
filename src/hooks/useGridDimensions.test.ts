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

function setup(columnCount: number, initialWidth = 0) {
  const { result } = renderHook(() => {
    const ref = useRef<HTMLDivElement>({ clientWidth: initialWidth } as HTMLDivElement);
    const dims = useGridDimensions(ref, columnCount);
    return { ref, dims };
  });
  return result;
}

describe('useGridDimensions', () => {
  it('exposes the requested column count after observe fires', () => {
    // Setup mock auto-fires observe with 1200x800
    const r = setup(4);
    expect(r.current.dims.columnCount).toBe(4);
    expect(r.current.dims.cellSize).toBeGreaterThan(0);
  });

  it('derives cellSize from container width and column count', () => {
    const r = setup(4);
    act(() => {
      __ResizeObserverMock.instances[0]._trigger(1024, 800);
    });
    // (1024 - 2*24 - 3*24) / 4 = (1024 - 48 - 72) / 4 = 904/4 = 226
    expect(r.current.dims.columnCount).toBe(4);
    expect(r.current.dims.cellSize).toBe(226);
    expect(r.current.dims.rowHeight).toBe(226 + 24);
  });

  it('floors columnCount at 1', () => {
    const r = setup(0);
    act(() => {
      __ResizeObserverMock.instances[0]._trigger(500, 800);
    });
    expect(r.current.dims.columnCount).toBe(1);
  });

  it('updates cellSize when columnCount changes', () => {
    let cols = 4;
    const { result, rerender } = renderHook(() => {
      const ref = useRef<HTMLDivElement>({ clientWidth: 1000 } as HTMLDivElement);
      return useGridDimensions(ref, cols);
    });
    act(() => {
      __ResizeObserverMock.instances[0]._trigger(1000, 800);
    });
    // 4 cols: (1000 - 48 - 72)/4 = 220
    expect(result.current.cellSize).toBe(220);
    cols = 5;
    rerender();
    // 5 cols: (1000 - 48 - 96)/5 = 171.2
    expect(result.current.cellSize).toBeCloseTo(171.2, 1);
  });

  it('remeasures after width transitions when ResizeObserver misses the final width', async () => {
    let width = 800;
    const element = {
      clientWidth: 800,
      getBoundingClientRect: () => ({ width }),
    } as HTMLDivElement;

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useGridDimensions(ref, 4);
    });

    act(() => {
      __ResizeObserverMock.instances[0]._trigger(800, 800);
    });
    expect(result.current.cellSize).toBe(170);

    width = 1000;
    await act(async () => {
      const event = new Event('transitionend', { bubbles: true }) as TransitionEvent;
      Object.defineProperty(event, 'propertyName', { value: 'width' });
      document.dispatchEvent(event);
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });

    expect(result.current.cellSize).toBe(220);
  });
});
