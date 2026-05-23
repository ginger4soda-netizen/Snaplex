/**
 * Image Import Tests
 *
 * Validates the full import chain:
 * 1. Library must be open before import
 * 2. Import creates image records
 * 3. Images appear in the grid after import
 * 4. Import to specific folder works
 * 5. Error states are handled visibly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { getMockState, setMockLibraryOpen, mockInvoke } from './mocks/tauri';
import ImageGrid from '../components/layout/ImageGrid';

// Helper: set up a valid library so IPC commands work
function setupLibrary() {
  setMockLibraryOpen({
    path: '/tmp/TestLib.snpx',
    name: 'TestLib',
    imageCount: 0,
    createdAt: new Date().toISOString(),
  });
}

describe('Image Import Flow', () => {
  describe('Prerequisites', () => {
    it('import_images should reject when no library is open', async () => {
      // No library set up
      await expect(
        mockInvoke('import_images', { filePaths: ['/test/a.jpg'], folderId: undefined })
      ).rejects.toThrow('No library open');
    });

    it('import_images should succeed when library is open', async () => {
      setupLibrary();

      const result = await mockInvoke('import_images', {
        filePaths: ['/test/a.jpg', '/test/b.png'],
        folderId: undefined,
      });

      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
      expect(getMockState().images).toHaveLength(2);
    });
  });

  describe('Import to folder', () => {
    it('should associate imported images with the target folder', async () => {
      setupLibrary();

      // Create a folder first
      const folder = await mockInvoke('create_folder', { name: 'Designs', parentId: null });

      // Import into that folder
      await mockInvoke('import_images', {
        filePaths: ['/test/design1.jpg'],
        folderId: folder.id,
      });

      const images = await mockInvoke('get_images', { folderId: folder.id, offset: 0, limit: 50 });
      expect(images).toHaveLength(1);
      expect(images[0].filename).toBe('design1.jpg');
    });

    it('images without folder should appear in all-images view', async () => {
      setupLibrary();

      await mockInvoke('import_images', {
        filePaths: ['/test/loose.jpg'],
        folderId: undefined,
      });

      const allImages = await mockInvoke('get_images', { offset: 0, limit: 50 });
      expect(allImages).toHaveLength(1);
    });
  });

  describe('Image details after import', () => {
    it('should return valid ImageDetail for imported image', async () => {
      setupLibrary();

      const result = await mockInvoke('import_images', {
        filePaths: ['/test/photo.jpg'],
        folderId: undefined,
      });

      const images = getMockState().images;
      const detail = await mockInvoke('get_image_detail', { id: images[0].id });

      expect(detail.filename).toBe('photo.jpg');
      expect(detail.analysis).toBeNull(); // Not yet analyzed
      expect(detail.colorPalette).toBeNull();
    });
  });

  describe('ImageGrid component', () => {
    it('should show empty state when no images exist', async () => {
      setupLibrary();

      render(
        <ImageGrid
          selectedImageId={undefined}
          onImageSelect={() => {}}
          onToggleDetail={() => {}}
          isDetailVisible={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No images found')).toBeInTheDocument();
      });
    });

    it('should render images after import', async () => {
      setupLibrary();
      await mockInvoke('import_images', {
        filePaths: ['/test/sunset.jpg', '/test/mountain.png'],
        folderId: undefined,
      });

      render(
        <ImageGrid
          selectedImageId={undefined}
          onImageSelect={() => {}}
          onToggleDetail={() => {}}
          isDetailVisible={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByAltText('sunset.jpg')).toBeInTheDocument();
        expect(screen.getByAltText('mountain.png')).toBeInTheDocument();
      });
    });
  });
});

describe('Folder Operations', () => {
  beforeEach(() => {
    setupLibrary();
  });

  it('should create, rename, and delete folders', async () => {
    const folder = await mockInvoke('create_folder', { name: 'Projects', parentId: null });
    expect(folder.name).toBe('Projects');

    await mockInvoke('rename_folder', { id: folder.id, name: 'My Projects' });
    const tree = await mockInvoke('get_folder_tree', {});
    expect(tree[0].name).toBe('My Projects');

    await mockInvoke('delete_folder', { id: folder.id });
    const tree2 = await mockInvoke('get_folder_tree', {});
    expect(tree2).toHaveLength(0);
  });

  it('should toggle image favorite', async () => {
    await mockInvoke('import_images', { filePaths: ['/test/a.jpg'], folderId: undefined });
    const img = getMockState().images[0];

    const isFav = await mockInvoke('toggle_favorite', { id: img.id });
    expect(isFav).toBe(true);

    const isFav2 = await mockInvoke('toggle_favorite', { id: img.id });
    expect(isFav2).toBe(false);
  });
});
