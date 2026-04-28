import '@testing-library/jest-dom';
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
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  // helper for tests to drive resize events
  _trigger(width: number, height: number) {
    const entry = {
      contentRect: { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) },
      target: {} as Element,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
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
