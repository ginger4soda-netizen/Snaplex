import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DetailPanel from '@/components/detail/DetailPanel';
import { mockInvoke } from './mocks/tauri';
import type { AnalysisResult, ImageDetail, PromptSegment } from '@/types';

// Capture what the copy-all button hands to the clipboard.
const copySpy = vi.fn(async (_text: string) => true);
vi.mock('@/utils/clipboard', () => ({
  copyToClipboard: (text: string) => copySpy(text),
}));

const empty: PromptSegment = { original: '', translated: '' };

function detailWithEmptySnapshot(): ImageDetail {
  // Simulates the real-world state: the analysis row exists (so the button
  // renders) but `structuredPrompts` holds an empty/stale snapshot because the
  // live content was persisted to the per-dimension version store instead.
  const analysis: AnalysisResult = {
    description: 'a fox',
    structuredPrompts: {
      subject: empty,
      environment: empty,
      composition: empty,
      lighting: empty,
      style: empty,
      mood: empty,
    },
  };
  return {
    id: 'img1',
    filename: 'fox.png',
    thumbUrl: 'file:///fox-thumb.png',
    fullUrl: 'file:///fox.png',
    width: 100,
    height: 100,
    isFavorite: false,
    hasAnalysis: true,
    createdAt: '2026-01-01T00:00:00Z',
    memo: '',
    sourceUrl: null,
    analysis,
    colorPalette: null,
    folderIds: [],
  };
}

describe('DetailPanel - Copy all prompts', () => {
  afterEach(() => {
    copySpy.mockClear();
  });

  it('copies the current persisted dimension version, not the empty analysis snapshot', async () => {
    mockInvoke.mockImplementation(async (cmd: string, args?: Record<string, any>) => {
      switch (cmd) {
        case 'get_image_detail':
          return detailWithEmptySnapshot();
        case 'get_image_sources':
          return [];
        case 'get_color_palette':
          return null;
        case 'get_dimension_history':
          if (args?.dimension === 'subject') {
            return [
              { version: 1, original: 'A red fox in snow', translated: '雪中的红狐', isCurrent: true, createdAt: '2026-01-01T00:00:00Z' },
            ];
          }
          return [];
        default:
          return null;
      }
    });

    render(<DetailPanel imageId="img1" onClose={vi.fn()} systemLanguage="English" />);

    const copyBtn = await screen.findByTitle('Copy all prompts');
    fireEvent.click(copyBtn);

    await waitFor(() => expect(copySpy).toHaveBeenCalledTimes(1));
    const copied = copySpy.mock.calls[0][0] as string;
    expect(copied).toContain('[Subject]');
    expect(copied).toContain('A red fox in snow');
  });

  it('falls back to the analysis snapshot when no dimension versions exist', async () => {
    const detail = detailWithEmptySnapshot();
    detail.analysis!.structuredPrompts.subject = { original: 'Snapshot subject text', translated: '' };

    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'get_image_detail':
          return detail;
        case 'get_image_sources':
          return [];
        case 'get_color_palette':
          return null;
        case 'get_dimension_history':
          return []; // no persisted versions yet
        default:
          return null;
      }
    });

    render(<DetailPanel imageId="img1" onClose={vi.fn()} systemLanguage="English" />);

    const copyBtn = await screen.findByTitle('Copy all prompts');
    fireEvent.click(copyBtn);

    await waitFor(() => expect(copySpy).toHaveBeenCalledTimes(1));
    expect(copySpy.mock.calls[0][0] as string).toContain('Snapshot subject text');
  });
});
