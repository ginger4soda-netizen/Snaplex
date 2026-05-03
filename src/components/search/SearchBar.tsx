import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SearchResult } from '../../types';
import { useTauriIPC } from '../../hooks/useTauriIPC';
import { isTauri } from '../../utils/isTauri';
import { searchHistory } from '../../services/geminiService';
import { getTranslation } from '../../translations';

interface SearchBarProps {
  folderId?: string;
  onSearchResults: (imageIds: string[]) => void;
  onSearchClear: () => void;
  onSearching: (isSearching: boolean) => void;
  systemLanguage?: string;
  /** Fallback: web-mode history items for legacy search */
  historyItems?: { id: string; analysis: any }[];
}

// ─── Fusion Sorting ────────────────────────────────────────────
// Merges results from FTS5, text embedding, and CLIP visual search.
// Strategy: normalize scores per source → weighted sum → deduplicate by imageId.

const WEIGHTS = {
  fts: 0.4,
  embedding: 0.35,
  clip: 0.25,
};

function fuseSearchResults(sources: SearchResult[][]): string[] {
  // Flatten all results
  const all = sources.flat();
  if (all.length === 0) return [];

  // Group by matchType to normalize scores within each source
  const byType = new Map<string, SearchResult[]>();
  for (const r of all) {
    const list = byType.get(r.matchType) || [];
    list.push(r);
    byType.set(r.matchType, list);
  }

  // Normalize scores within each type to 0–1 range
  const normalized = new Map<string, Map<string, number>>(); // imageId → matchType → normalizedScore
  for (const [type, results] of byType) {
    const scores = results.map(r => r.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;

    for (const r of results) {
      if (!normalized.has(r.imageId)) normalized.set(r.imageId, new Map());
      const norm = (r.score - min) / range;
      normalized.get(r.imageId)!.set(type, norm);
    }
  }

  // Compute weighted fused score per imageId
  const fused: { imageId: string; score: number }[] = [];
  for (const [imageId, typeScores] of normalized) {
    let total = 0;
    for (const [type, score] of typeScores) {
      const weight = WEIGHTS[type as keyof typeof WEIGHTS] || 0.2;
      total += score * weight;
    }
    // Boost images that appear in multiple sources
    const sourceCount = typeScores.size;
    if (sourceCount > 1) total *= 1 + (sourceCount - 1) * 0.15;
    fused.push({ imageId, score: total });
  }

  // Sort descending by fused score
  fused.sort((a, b) => b.score - a.score);
  return fused.map(f => f.imageId);
}

// ─── Component ─────────────────────────────────────────────────

const SearchBar: React.FC<SearchBarProps> = ({
  folderId,
  onSearchResults,
  onSearchClear,
  onSearching,
  systemLanguage,
  historyItems,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0); // Incremented to cancel stale searches

  const { searchImages, visualSearch } = useTauriIPC();
  const t = getTranslation(systemLanguage);

  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      onSearchClear();
      return;
    }

    const searchId = ++abortRef.current;
    setIsSearching(true);
    onSearching(true);

    try {
      if (isTauri()) {
        // Tauri mode: parallel FTS + CLIP search via IPC
        const [ftsResults, clipResults] = await Promise.all([
          searchImages(trimmed, folderId),
          visualSearch(trimmed, 50),
        ]);

        // Check if this search is still current
        if (searchId !== abortRef.current) return;

        const fusedIds = fuseSearchResults([ftsResults, clipResults]);
        onSearchResults(fusedIds);
      } else {
        // Web fallback: use existing AI-powered semantic search
        if (historyItems && historyItems.length > 0) {
          const ids = await searchHistory(trimmed, historyItems as any);
          if (searchId !== abortRef.current) return;
          onSearchResults(ids);
        } else {
          onSearchResults([]);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      if (searchId === abortRef.current) {
        onSearchResults([]);
      }
    } finally {
      if (searchId === abortRef.current) {
        setIsSearching(false);
        onSearching(false);
      }
    }
  }, [folderId, historyItems, onSearchResults, onSearchClear, onSearching]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // 300ms debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      onSearchClear();
      return;
    }
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  }, [performSearch, onSearchClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      performSearch(query);
    }
    if (e.key === 'Escape') {
      setQuery('');
      onSearchClear();
    }
  }, [query, performSearch, onSearchClear]);

  const handleClear = useCallback(() => {
    setQuery('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    ++abortRef.current; // Cancel any in-flight searches
    onSearchClear();
  }, [onSearchClear]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        {/* Search icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={t.searchPlaceholder}
          className="w-full pl-9 pr-8 py-2 bg-white/80 border border-stone-200 rounded-xl text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-200/60 focus:border-red-300 transition-all"
        />

        {/* Clear / Loading indicator */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
          >
            {isSearching ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
export { fuseSearchResults };
