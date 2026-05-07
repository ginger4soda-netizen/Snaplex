import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { setupTauriMocks, resetMockState } from './mocks/tauri';

// Mock browser APIs not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver (not available in jsdom)
class ResizeObserverMock {
  callback: ResizeObserverCallback;
  static instances: ResizeObserverMock[] = [];
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    ResizeObserverMock.instances.push(this);
  }
  observe = (target: Element) => {
    // Immediately fire with a default viewport size so virtualizers get non-zero dimensions
    this._trigger(1200, 800);
  };
  unobserve = () => {};
  disconnect = () => {};
  // helper for tests to drive resize events
  _trigger(width: number, height: number) {
    const entry = {
      contentRect: { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) },
      target: {} as Element,
      borderBoxSize: [{ inlineSize: width, blockSize: height }],
      contentBoxSize: [{ inlineSize: width, blockSize: height }],
      devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
}
(globalThis as any).ResizeObserver = ResizeObserverMock;
(globalThis as any).__ResizeObserverMock = ResizeObserverMock;

// Register all Tauri mocks before any tests load
setupTauriMocks();

// Reset state between tests to prevent leakage
beforeEach(() => {
  resetMockState();
});
