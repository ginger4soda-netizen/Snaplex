import React, { useRef, useState, useEffect } from 'react';
import { ChatMessage, UserSettings } from '../types';
import { sendChatMessageStream } from '../services/geminiService';
import { getTranslation } from '../translations';
import MarkdownRenderer from './MarkdownRenderer';

interface Props {
    messages: ChatMessage[];
    onUpdateMessages: (msgs: ChatMessage[]) => void;
    imageContext?: string;
    systemLanguage?: string;
    settings?: UserSettings;
}

const ChatBot: React.FC<Props> = ({ messages, onUpdateMessages, imageContext, systemLanguage, settings }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ✅ 1. 获取当前语言包 (包含 chatChips)
  const t = getTranslation(systemLanguage);
  // 直接使用 translation 中的 chips，默认为空数组防崩
  const chips = t.chatChips || [];

  useEffect(() => { 
      endRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, loading]);

  useEffect(() => {
      if (!initialized.current && messages.length === 0) {
          initialized.current = true;
          const greetingMsg: ChatMessage = {
              id: Date.now().toString(), role: 'model',
              text: t.chatGreeting,
              timestamp: Date.now()
          };
          onUpdateMessages([greetingMsg]);
      }
  }, [messages, t]);

  const processSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textToSend, timestamp: Date.now() };
    const newHistory = [...messages, userMsg];
    const modelMsgId = (Date.now() + 1).toString();
    const modelMsg: ChatMessage = { id: modelMsgId, role: 'model', text: '', timestamp: Date.now() };
    
    onUpdateMessages([...newHistory, modelMsg]); 
    setInput(''); 
    setLoading(true);

    await sendChatMessageStream(newHistory, textToSend, imageContext, (streamedText) => {
        onUpdateMessages([...newHistory, { ...modelMsg, text: streamedText }]);
    }, settings);
    setLoading(false);
  };

  const handleSendInput = () => processSend(input);
  const handleChipClick = (prompt: string) => processSend(prompt);

  const handleCopy = (text: string, id: string) => {
      if (!text) return; navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-cream overflow-hidden">
      
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth pb-4">
        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.3s_ease-out]`}>
            <div className={`relative max-w-[90%] p-4 rounded-2xl shadow-sm text-[15px] leading-relaxed group ${msg.role === 'user' ? 'bg-stone-800 text-white rounded-tr-none' : 'bg-white text-stone-800 rounded-tl-none border border-stone-100 pb-8'}`}>
               <MarkdownRenderer>{msg.text}</MarkdownRenderer>
               
               {msg.role === 'model' && loading && msg.id === messages[messages.length - 1].id && msg.text === '' && (
                   <span className="inline-flex gap-1 ml-1">
                       <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></span>
                       <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce delay-75"></span>
                       <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce delay-150"></span>
                   </span>
               )}
               
               {msg.role === 'model' && msg.text && index > 0 && (
                   <button onClick={() => handleCopy(msg.text, msg.id)} className="absolute bottom-2 right-2 p-1.5 text-stone-300 hover:text-softblue transition-colors rounded-lg hover:bg-stone-50 active:scale-95">
                       {copiedId === msg.id ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                   </button>
               )}
            </div>
          </div>
        ))}
        <div ref={endRef} className="h-2" />
      </div>

      {/* 底部固定区域 */}
      <div className="shrink-0 bg-white/90 backdrop-blur-xl border-t border-stone-100 pb-safe z-50">
        
        {/* Chips Area: 横向滚动 */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar mask-gradient-right">
            {chips.map((chip, idx) => (
                <button 
                    key={idx}
                    onClick={() => handleChipClick(chip.prompt)}
                    disabled={loading}
                    // ✅ 2. 样式修正：Hover/Active 变为系统黄 (bg-sunny)
                    className="whitespace-nowrap px-4 py-1.5 bg-stone-100 hover:bg-sunny hover:text-stone-900 active:bg-sunny text-stone-600 text-xs font-bold rounded-full transition-all active:scale-95 disabled:opacity-50 border border-stone-200 hover:border-sunny/50"
                >
                    {chip.label}
                </button>
            ))}
        </div>

        {/* Input Bar */}
        <div className="px-4 pb-4 pt-1">
            <div className="flex items-end gap-2 bg-stone-100/80 p-2 rounded-[1.5rem] border border-stone-200 focus-within:border-stone-400 focus-within:bg-white transition-all shadow-sm">
            <textarea 
                className="flex-1 bg-transparent px-4 py-3 outline-none text-stone-800 placeholder-stone-400 resize-none max-h-32 min-h-[44px] text-sm" 
                placeholder={t.chatPlaceholder} 
                rows={1}
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendInput();
                    }
                }}
            />
            {/* ✅ 3. 样式修正：按钮改回系统粉 (bg-coral) */}
            <button 
                onClick={handleSendInput} 
                disabled={loading || !input.trim()} 
                className="w-10 h-10 mb-1 mr-1 bg-coral text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none hover:bg-red-400"
            >
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-5 h-5 transform rotate-90 translate-x-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19V5m0 0l-7 7m7-7l7 7" /></svg>}
            </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;