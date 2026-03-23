import React, { useRef, useEffect } from 'react';

interface MemoCardProps {
  memo: string;
  onMemoChange: (memo: string) => void;
}

const MemoCard: React.FC<MemoCardProps> = ({ memo, onMemoChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(80, el.scrollHeight) + 'px';
  };

  useEffect(() => {
    autoResize();
  }, [memo]);

  return (
    <div className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-4 border border-stone-100 dark:border-stone-800 transition-colors">
      <textarea
        ref={textareaRef}
        value={memo}
        onChange={(e) => onMemoChange(e.target.value)}
        placeholder="Add your personal notes here..."
        className="w-full bg-transparent text-sm text-stone-700 dark:text-stone-300 leading-relaxed outline-none resize-none placeholder:text-stone-400 dark:placeholder:text-stone-600 font-sans min-h-[80px]"
      />
    </div>
  );
};

export default MemoCard;
