import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isTauri } from './isTauri';

describe('isTauri', () => {
  beforeEach(() => {
    delete (window as any).__TAURI__;
    delete (window as any).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    delete (window as any).__TAURI__;
    delete (window as any).__TAURI_INTERNALS__;
  });

  it('returns false in pure web mode when no Tauri global is present', () => {
    expect(isTauri()).toBe(false);
  });

  it('detects a Tauri v1 runtime via the legacy __TAURI__ global', () => {
    (window as any).__TAURI__ = {};
    expect(isTauri()).toBe(true);
  });

  it('detects a Tauri v2 runtime via __TAURI_INTERNALS__', () => {
    (window as any).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
  });
});
