import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // 读取本地存储
      const storedKey = localStorage.getItem('SNAPLEX_API_KEY');
      const storedModel = localStorage.getItem('SNAPLEX_MODEL_ID');
      
      setApiKey(storedKey || '');
      // 如果没有设置过模型，默认使用 gemini-2.5-flash
      setModel(storedModel || 'gemini-2.5-flash');
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!apiKey.trim()) {
      alert("Please enter a valid API Key.");
      return;
    }
    // 保存到本地
    localStorage.setItem('SNAPLEX_API_KEY', apiKey.trim());
    localStorage.setItem('SNAPLEX_MODEL_ID', model);
    
    onClose();
    // 强制刷新页面以确保所有服务重新初始化（对于修改 Key 很重要）
    window.location.reload(); 
  };

  if (!isVisible && !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md p-6 relative">
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🔌</span> API Settings
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        
        <p className="text-zinc-400 text-xs mb-6 bg-zinc-800/50 p-3 rounded border border-zinc-700/50">
          <strong>Privacy Note:</strong> Your API Key is stored locally on your device (LocalStorage). It is never sent to any server other than Google's API.
        </p>

        <div className="space-y-5">
          {/* API Key Input */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Google Gemini API Key
            </label>
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your AIzaSy... key here"
              className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm placeholder-zinc-600"
            />
            <div className="mt-2 text-right">
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline hover:no-underline"
              >
                Get a free API Key →
              </a>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Select Model
            </label>
            <div className="relative">
              <select 
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none cursor-pointer"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                <option value="gemini-3.0-flash">Gemini 3.0 Flash (Experimental)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (High Intelligence)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
              </select>
              {/* Custom Arrow Icon */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                ▼
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-zinc-800">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-lg text-sm transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            Save & Reload
          </button>
        </div>

      </div>
    </div>
  );
};