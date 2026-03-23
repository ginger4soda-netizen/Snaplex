import React, { useState, useEffect } from 'react';
import ChatBot from '../ChatBot';
import { ChatMessage, UserSettings, DEFAULT_SETTINGS } from '@/types';
import { get, set } from 'idb-keyval'; // Will eventually move to Tauri IPC for chat too

interface ChatPanelProps {
  imageId: string;
  image: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ imageId, image }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Load chat history for this image
    const loadChat = async () => {
      const history = await get(`chat_history_${imageId}`);
      if (history) setMessages(history);
      
      const storedSettings = await get('visionLearnSettings');
      if (storedSettings) setSettings(storedSettings);
    };
    loadChat();
  }, [imageId]);

  const handleUpdateMessages = async (newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    await set(`chat_history_${imageId}`, newMessages);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ChatBot 
        messages={messages}
        onUpdateMessages={handleUpdateMessages}
        imageContext={image}
        systemLanguage={settings.systemLanguage || 'English'}
        settings={settings}
      />
    </div>
  );
};

export default ChatPanel;
