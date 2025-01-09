import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Message } from '../types';
import { sendMessage } from '../services/api';
import TypingIndicator from './TypingIndicator';

interface ChatInterfaceProps {
  onClose: () => void;
}

function ChatInterface({ onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your Las Vegas SEO Guru. Ask me anything about optimizing your website for the Las Vegas market!'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendMessage([...messages, userMessage]);
      const aiMessage: Message = {
        role: 'assistant',
        content: response
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold">Try the AI Guru</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Las Vegas SEO..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:border-purple-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'
            }`}
            disabled={isLoading}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </>
  );
}

export default ChatInterface;