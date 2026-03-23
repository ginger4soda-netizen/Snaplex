import React from 'react';
import { useToast } from '@/hooks/useToast';

const ToastContainer: React.FC = () => {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={`px-4 py-3 rounded-xl shadow-lg cursor-pointer text-sm font-medium backdrop-blur-md animate-in slide-in-from-right transition-all ${
            toast.type === 'error'
              ? 'bg-red-500/90 text-white'
              : toast.type === 'success'
              ? 'bg-emerald-500/90 text-white'
              : 'bg-stone-800/90 text-white'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
