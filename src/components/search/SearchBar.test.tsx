import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// Mock the IPC hook + Tauri detection so we control them and avoid real IPC.
const searchImages = vi.fn(async (): Promise<any[]> => []);
const visualSearch = vi.fn(async (): Promise<any[]> => []);

vi.mock('../../hooks/useTauriIPC', () => ({
  useTauriIPC: () => ({ searchImages, visualSearch }),
}));

vi.mock('../../utils/isTauri', () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock('../../services/geminiService', () => ({
  searchHistory: vi.fn(async () => []),
}));

import SearchBar from './SearchBar';
import { isTauri } from '../../utils/isTauri';

function renderBar(overrides: Partial<React.ComponentProps<typeof SearchBar>> = {}) {
  const props = {
    onSearchResults: vi.fn(),
    onSearchClear: vi.fn(),
    onSearching: vi.fn(),
    ...overrides,
  };
  render(<SearchBar {...props} />);
  return props;
}

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isTauri as any).mockReturnValue(true);
  });

  it('clears the query and notifies parent when Escape is pressed', () => {
    const props = renderBar();
    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'sunset' } });
    expect(input.value).toBe('sunset');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input.value).toBe('');
    expect(props.onSearchClear).toHaveBeenCalled();
  });

  it('does not call the search backend when the query is whitespace-only', async () => {
    vi.useFakeTimers();
    const props = renderBar();
    const input = screen.getByPlaceholderText(/search/i);

    fireEvent.change(input, { target: { value: '   ' } });
    // Even after the 300ms debounce window elapses, no IPC should fire.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(searchImages).not.toHaveBeenCalled();
    expect(visualSearch).not.toHaveBeenCalled();
    expect(props.onSearchClear).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('discards results from a superseded in-flight search', async () => {
    // Two deferred promises, one per query, that we resolve in reverse order.
    let resolveStale!: (v: any[]) => void;
    let resolveFresh!: (v: any[]) => void;
    const stalePromise = new Promise<any[]>((r) => { resolveStale = r; });
    const freshPromise = new Promise<any[]>((r) => { resolveFresh = r; });

    (searchImages as any)
      .mockReturnValueOnce(stalePromise)
      .mockReturnValueOnce(freshPromise);
    (visualSearch as any).mockResolvedValue([]);

    vi.useFakeTimers();
    const props = renderBar();
    const input = screen.getByPlaceholderText(/search/i);

    // First query: type "a" and let debounce fire → stale IPC starts.
    fireEvent.change(input, { target: { value: 'a' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    // Second query supersedes the first before stale resolves.
    fireEvent.change(input, { target: { value: 'ab' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    // Resolve in reverse: stale comes back AFTER fresh has been initiated.
    await act(async () => {
      resolveFresh([{ imageId: 'fresh', score: 1, matchType: 'fts' }]);
      resolveStale([{ imageId: 'stale', score: 1, matchType: 'fts' }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    const calls = (props.onSearchResults as any).mock.calls.map((c: any[]) => c[0]);
    expect(calls.flat()).toContain('fresh');
    expect(calls.flat()).not.toContain('stale');
    vi.useRealTimers();
  });

  it('clear button empties the query and cancels any in-flight search', async () => {
    let resolveInflight!: (v: any[]) => void;
    (searchImages as any).mockReturnValueOnce(
      new Promise<any[]>((r) => { resolveInflight = r; })
    );
    (visualSearch as any).mockResolvedValue([]);

    vi.useFakeTimers();
    const props = renderBar();
    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'beach' } });
    await act(async () => { vi.advanceTimersByTime(300); });

    // Clear button is the only <button> rendered while query is non-empty.
    const clearBtn = screen.getByRole('button');
    fireEvent.click(clearBtn);

    expect(input.value).toBe('');
    expect(props.onSearchClear).toHaveBeenCalled();

    // Now resolve the abandoned IPC — its results must not reach the parent.
    await act(async () => {
      resolveInflight([{ imageId: 'abandoned', score: 1, matchType: 'fts' }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    const calls = (props.onSearchResults as any).mock.calls.map((c: any[]) => c[0]);
    expect(calls.flat()).not.toContain('abandoned');
    vi.useRealTimers();
  });
});
