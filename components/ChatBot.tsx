import React, { useRef, useState, useEffect } from 'react';
import { ChatMessage, UserSettings } from '../types';
import { sendChatMessageStream } from '../services/geminiService';
import { getTranslation } from '../translations'; // 引入字典

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

  const t = getTranslation(systemLanguage); // 获取当前语言包

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
      if (!initialized.current && messages.length === 0) {
          initialized.current = true;
          const greetingMsg: ChatMessage = {
              id: Date.now().toString(), role: 'model',
              text: t.chatGreeting, // ✅ 使用翻译后的问候语
              timestamp: Date.now()
          };
          onUpdateMessages([greetingMsg]);
      }
  }, [messages, onUpdateMessages, t]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: Date.now() };
    const newHistory = [...messages, userMsg];
    const modelMsgId = (Date.now() + 1).toString();
    const modelMsg: ChatMessage = { id: modelMsgId, role: 'model', text: '', timestamp: Date.now() };
    
    onUpdateMessages([...newHistory, modelMsg]); setInput(''); setLoading(true);
    await sendChatMessageStream(newHistory, input, imageContext, (streamedText) => {
        onUpdateMessages([...newHistory, { ...modelMsg, text: streamedText }]);
    }, settings);
    setLoading(false);
  };

  const handleCopy = (text: string, id: string) => {
      if (!text) return; navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-cream animate-[fadeIn_0.3s_ease-out] rounded-t-[2.5rem] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-20">
        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[85%] p-4 rounded-2xl shadow-sm text-lg leading-relaxed group ${msg.role === 'user' ? 'bg-stone-800 text-white rounded-tr-none' : 'bg-white text-stone-800 rounded-tl-none border border-stone-100 pb-9'}`}>
               {msg.text}
               {msg.role === 'model' && loading && msg.id === messages[messages.length - 1].id && msg.text === '' && <span className="inline-flex gap-1 ml-1"><span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce delay-75"></span><span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce delay-150"></span></span>}
               {msg.role === 'model' && msg.text && index > 0 && (
                   <button onClick={() => handleCopy(msg.text, msg.id)} className="absolute bottom-2 right-2 p-1.5 text-coral/70 hover:text-coral transition-colors rounded-lg hover:bg-coral/10 active:scale-95">
                       {copiedId === msg.id ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                   </button>
               )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-4 bg-white/80 backdrop-blur border-t border-stone-100 absolute bottom-0 left-0 right-0">
        <div className="flex items-center gap-2 bg-white p-2 rounded-full shadow-lg border border-stone-100">
          <input type="text" className="flex-1 bg-transparent px-4 py-2 outline-none text-stone-800 placeholder-stone-400" placeholder={t.chatPlaceholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
          <button onClick={handleSend} disabled={loading} className="w-10 h-10 bg-coral text-white rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform disabled:opacity-50">
             {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19V5m0 0l-7 7m7-7l7 7" /></svg>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;