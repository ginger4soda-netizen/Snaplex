import React, { useState, useEffect } from 'react';
import ChatBot from '../shared/ChatBot';
import { ChatMessage, UserSettings, DEFAULT_SETTINGS } from '@/types';
import { get, set } from 'idb-keyval';
import { getImageBase64 } from '@/utils/imageToBase64';

interface ChatPanelProps {
  imageId: string;
  image: string; // asset:// URL
}

const ChatPanel: React.FC<ChatPanelProps> = ({ imageId, image }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  useEffect(() => {
    const loadChat = async () => {
      const history = await get(`chat_history_${imageId}`);
      if (history) setMessages(history);

      const storedSettings = await get('visionLearnSettings');
      if (storedSettings) setSettings(storedSettings);
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

  const handleUpdateMessages = async (newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    await set(`chat_history_${imageId}`, newMessages);
  };

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
