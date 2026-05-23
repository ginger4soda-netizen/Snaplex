import { useReducer, useCallback, useEffect } from 'react';

export interface NavEntry {
  type: 'folder' | 'settings' | 'stylePrinter' | 'about';
  id?: string; // folderId or undefined for "All Images", '__favorites__' for Favorites
}

const MAX_HISTORY = 50;

interface NavState {
  history: NavEntry[];
  index: number;
}

type NavAction =
  | { type: 'push'; entry: NavEntry }
  | { type: 'back' }
  | { type: 'forward' };

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'push': {
      const cur = state.history[state.index];
      // Don't push if identical to current
      if (cur && cur.type === action.entry.type && cur.id === action.entry.id) return state;
      // Truncate forward history, append new entry
      const newHistory = [...state.history.slice(0, state.index + 1), action.entry];
      // Trim to max from the front
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return { history: newHistory, index: newHistory.length - 1 };
      }
      return { history: newHistory, index: newHistory.length - 1 };
    }
    case 'back':
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;
    case 'forward':
      return state.index < state.history.length - 1 ? { ...state, index: state.index + 1 } : state;
    default:
      return state;
  }
}

export function useNavigationHistory(initialEntry?: NavEntry) {
  const [state, dispatch] = useReducer(navReducer, {
    history: [initialEntry || { type: 'folder', id: undefined }],
    index: 0,
  });

  const current = state.history[state.index];
  const canGoBack = state.index > 0;
  const canGoForward = state.index < state.history.length - 1;

  const push = useCallback((entry: NavEntry) => dispatch({ type: 'push', entry }), []);
  const goBack = useCallback(() => dispatch({ type: 'back' }), []);
  const goForward = useCallback(() => dispatch({ type: 'forward' }), []);

  // Keyboard shortcuts: Cmd+[ and Cmd+]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '[') {
        e.preventDefault();
        dispatch({ type: 'back' });
      }
      if (e.metaKey && e.key === ']') {
        e.preventDefault();
        dispatch({ type: 'forward' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { current, push, goBack, goForward, canGoBack, canGoForward };
}
