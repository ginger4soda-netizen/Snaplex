import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImageGrid from '@/components/layout/ImageGrid';
import { emitMockEvent, resetMockState, setMockLibraryOpen } from './mocks/tauri';

let getImagesCallCount = 0;
const ipcMock = {
  getImages: vi.fn(async () => {
    getImagesCallCount += 1;
    return [];
  }),
  getImagesByIds: vi.fn(async () => []),
  getImageDetail: vi.fn(async () => null),
  countImages: vi.fn(async () => 0),
  importImages: vi.fn(),
  deleteImages: vi.fn(),
  toggleFavorite: vi.fn(),
  setFavorites: vi.fn(),
  openImageInFinder: vi.fn(),
  moveImages: vi.fn(),
  removeImagesFromFolders: vi.fn(),
  linkImageToFolder: vi.fn(),
  getFolderTree: vi.fn(async () => []),
  saveAnalysis: vi.fn(),
  saveDimensionVersion: vi.fn(),
};

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measure: vi.fn(),
  }),
}));

vi.mock('@/hooks/useGridDimensions', () => ({
  useGridDimensions: () => ({
    cellSize: 160,
    rowHeight: 180,
  }),
}));

vi.mock('@/hooks/useTauriIPC', () => ({
  useTauriIPC: () => ipcMock,
}));

describe('ImageGrid capture-saved event', () => {
  it('reloads images when browser-extension ingest succeeds', async () => {
    resetMockState();
    setMockLibraryOpen({
      path: '/tmp/test.snpx',
      name: 'Test',
      imageCount: 0,
      createdAt: new Date().toISOString(),
    });
    getImagesCallCount = 0;

    render(
      <ImageGrid
        onImageSelect={() => {}}
        onToggleDetail={() => {}}
        isDetailVisible={false}
      />,
    );

    await waitFor(() => expect(getImagesCallCount).toBeGreaterThan(0));
    const before = getImagesCallCount;

    emitMockEvent('snaplex://capture-saved', {
      outcome: 'saved',
      image_id: 'img-new',
      capture_type: 'image',
    });

    await waitFor(() => expect(getImagesCallCount).toBeGreaterThan(before));
  });
});
