import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getTranslation } from '@/translations';

interface MemoCardProps {
  memo: string;
  onMemoChange: (memo: string) => void;
  systemLanguage?: string;
}

const MemoCard: React.FC<MemoCardProps> = ({ memo, onMemoChange, systemLanguage }) => {
  const t = getTranslation(systemLanguage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localMemo, setLocalMemo] = useState(memo);

  // Sync from parent when memo prop changes (e.g. switching images)
  useEffect(() => {
    setLocalMemo(memo);
  }, [memo]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(80, el.scrollHeight) + 'px';
  };

  useEffect(() => {
    autoResize();
  }, [localMemo]);

  // Debounced save — only fires after composition ends and typing pauses
  const debouncedSave = useCallback((value: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onMemoChange(value);
    }, 500);
  }, [onMemoChange]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalMemo(value);
    // Don't trigger save during IME composition
    if (!composingRef.current) {
      debouncedSave(value);
    }
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = false;
    // After composition ends, save the final value
    const value = (e.target as HTMLTextAreaElement).value;
    setLocalMemo(value);
    debouncedSave(value);
  };

  return (
    <div className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-4 border border-stone-100 dark:border-stone-800 transition-colors">
      <textarea
        ref={textareaRef}
        value={localMemo}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        placeholder={t['notes.placeholder']}
        className="w-full bg-transparent text-sm text-stone-700 dark:text-stone-300 leading-relaxed outline-none resize-none placeholder:text-stone-400 dark:placeholder:text-stone-600 font-sans min-h-[80px]"
      />
    </div>
  );
};

export default MemoCard;
