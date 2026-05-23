import { useState, useCallback } from 'react';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

let nextId = 0;

// Global toast state — shared across components
const listeners: Set<(toasts: Toast[]) => void> = new Set();
let globalToasts: Toast[] = [];

function notify() {
  listeners.forEach(fn => fn([...globalToasts]));
}

export function showToast(message: string, type: Toast['type'] = 'info') {
  const id = nextId++;
  globalToasts.push({ id, message, type });
  notify();
  setTimeout(() => {
    globalToasts = globalToasts.filter(t => t.id !== id);
    notify();
  }, 4000);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts);

  useState(() => {
    listeners.add(setToasts);
    return () => { listeners.delete(setToasts); };
  });

  const dismiss = useCallback((id: number) => {
    globalToasts = globalToasts.filter(t => t.id !== id);
    notify();
  }, []);

  return { toasts, showToast, dismiss };
}
