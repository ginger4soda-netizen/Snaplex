import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatBot from '../shared/ChatBot';
import { ChatMessage, UserSettings, DEFAULT_SETTINGS } from '@/types';
import { get } from 'idb-keyval';
import { getImageBase64 } from '@/utils/imageToBase64';
import { useTauriIPC } from '@/hooks/useTauriIPC';

interface ChatPanelProps {
  imageId: string;
  image: string; // asset:// URL
}

const ChatPanel: React.FC<ChatPanelProps> = ({ imageId, image }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { getChatMessages, saveChatMessage } = useTauriIPC();
  const savedMessageIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Reset for new image
    setMessages([]);
    setHistoryLoaded(false);
    savedMessageIds.current.clear();

    const loadChat = async () => {
      try {
        const history = await getChatMessages(imageId);
        if (history && history.length > 0) {
          setMessages(history);
          history.forEach(m => savedMessageIds.current.add(m.id));
        }
      } catch {
        // Fallback for existing data in IndexedDB
        const history = await get(`chat_history_${imageId}`);
        if (history) {
          const msgs = history as ChatMessage[];
          setMessages(msgs);
          msgs.forEach(m => savedMessageIds.current.add(m.id));
        }
      }

      const storedSettings = await get('visionLearnSettings');
      if (storedSettings) setSettings(storedSettings);
      setHistoryLoaded(true);
    };
    loadChat();
  }, [imageId]);

  // Convert asset:// URL to base64 for API calls
  useEffect(() => {
    setImageBase64(null);
    getImageBase64(imageId, image)
      .then(b64 => setImageBase64(b64))
      .catch(err => console.error('Failed to load image base64 for chat:', err));
  }, [imageId, image]);

  const handleUpdateMessages = useCallback(async (newMessages: ChatMessage[]) => {
    setMessages(newMessages);

    // Save all NEW messages that haven't been persisted yet (except the last, handled below)
    for (let i = 0; i < newMessages.length - 1; i++) {
      const msg = newMessages[i];
      if (!savedMessageIds.current.has(msg.id) && msg.text) {
        try {
          await saveChatMessage(msg.id, imageId, msg.role, msg.text);
          savedMessageIds.current.add(msg.id);
        } catch (err) {
          console.error('Failed to save chat message:', err);
        }
      }
    }

    // Always save/update the last message (handles streaming model responses via INSERT OR REPLACE)
    if (newMessages.length > 0) {
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg.text) {
        try {
          await saveChatMessage(lastMsg.id, imageId, lastMsg.role, lastMsg.text);
          savedMessageIds.current.add(lastMsg.id);
        } catch (err) {
          console.error('Failed to save chat message:', err);
        }
      }
    }
  }, [imageId, saveChatMessage]);

  if (!historyLoaded) {
    return (
      <div className="h-full flex items-center justify-center text-stone-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ChatBot
        messages={messages}
        onUpdateMessages={handleUpdateMessages}
        imageContext={imageBase64 || undefined}
        systemLanguage={settings.systemLanguage || 'English'}
        settings={settings}
      />
    </div>
  );
};

export default ChatPanel;
