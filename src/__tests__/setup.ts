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

// Register all Tauri mocks before any tests load
setupTauriMocks();

// Reset state between tests to prevent leakage
beforeEach(() => {
  resetMockState();
});
