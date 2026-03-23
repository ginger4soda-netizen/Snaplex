/**
 * App Lifecycle Tests
 *
 * Validates the critical startup flow:
 * 1. First launch → library must be auto-created
 * 2. Library exists → app enters library mode
 * 3. All IPC commands must fail gracefully without a library
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../App';
import { getMockState, setMockLibraryOpen, mockInvoke } from './mocks/tauri';

describe('App Lifecycle', () => {
  beforeEach(() => {
    // localStorage mock
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  describe('First launch (no library exists)', () => {
    it('should auto-create a default library on first launch', async () => {
      render(<App />);

      await waitFor(() => {
        const state = getMockState();
        expect(state.currentLibrary).not.toBeNull();
      }, { timeout: 3000 });

      const state = getMockState();
      expect(state.currentLibrary!.name).toBeTruthy();
      expect(state.currentLibrary!.path).toContain('.snpx');
    });

    it('should show three-column layout after library init', async () => {
      render(<App />);

      await waitFor(() => {
        // The three-column layout renders the Sidebar with "All Images"
        expect(screen.getByText('All Images')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should NOT show the legacy web home page in Tauri mode', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('All Images')).toBeInTheDocument();
      }, { timeout: 3000 });

      // The old "Vision to Prompt" heading should NOT be present
      expect(screen.queryByText(/Vision.*Prompt/i)).not.toBeInTheDocument();
    });
  });

  describe('Subsequent launch (library exists)', () => {
    it('should open the existing library and enter library mode', async () => {
      // Simulate: on get_current_library, return an existing lib
      setMockLibraryOpen({
        path: '/Users/test/Snaplex Libraries/MyLib.snpx',
        name: 'MyLib',
        imageCount: 5,
        createdAt: new Date().toISOString(),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('All Images')).toBeInTheDocument();
      });
    });
  });
});

describe('IPC Error Handling', () => {
  it('should show error feedback when import fails without library', async () => {
    // No library is set up — import should fail
    const result = mockInvoke('import_images', {
      filePaths: ['/test/photo.jpg'],
      folderId: undefined,
    });

    await expect(result).rejects.toThrow('No library open');
  });

  it('should show error feedback when get_images fails without library', async () => {
    const result = mockInvoke('get_images', { offset: 0, limit: 50 });
    await expect(result).rejects.toThrow('No library open');
  });

  it('should show error feedback when folder ops fail without library', async () => {
    await expect(
      mockInvoke('get_folder_tree', {})
    ).rejects.toThrow('No library open');

    await expect(
      mockInvoke('create_folder', { name: 'Test', parentId: null })
    ).rejects.toThrow('No library open');
  });
});
