import React from 'react';
import { getTranslation } from '../../translations';

interface SearchResultsProps {
  resultCount: number;
  query: string;
  isSearching: boolean;
  systemLanguage?: string;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  resultCount,
  query,
  isSearching,
  systemLanguage,
}) => {
  const t = getTranslation(systemLanguage);

  if (!query.trim()) return null;

  return (
    <div className="flex items-center gap-2 px-1 py-1.5 text-xs text-stone-500">
      {isSearching ? (
        <span className="flex items-center gap-1.5">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Searching...
        </span>
      ) : (
        <span>
          {resultCount === 0
            ? `No results for "${query}"`
            : `${resultCount} result${resultCount !== 1 ? 's' : ''} for "${query}"`
          }
        </span>
      )}
    </div>
  );
};

export default SearchResults;
