import React, { useState } from 'react';
import { Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '../types';
import { sendMessage, ModelType } from '../services/api';
import TypingIndicator from './TypingIndicator';

interface ChatInterfaceProps {
  onClose: () => void;
  onAskStart: () => void;
}

function ChatInterface({ onClose, onAskStart }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your Las Vegas SEO Guru. Ask me anything about optimizing your website for the Las Vegas market!'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('deepseek');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    onAskStart();
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendMessage([...messages, userMessage], selectedModel);
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
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">Try the AI Guru</h2>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as ModelType)}
            className="border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
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
              <ReactMarkdown
                components={{
                  code({node, inline, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        {...props}
                        style={atomDark}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-md text-sm"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code {...props} className={`${className} bg-gray-700/10 rounded px-1 py-0.5`}>
                        {children}
                      </code>
                    );
                  },
                  p: ({children}) => <p className="mb-4 last:mb-0">{children}</p>,
                  ul: ({children}) => <ul className="list-disc ml-6 mb-4 last:mb-0">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal ml-6 mb-4 last:mb-0">{children}</ol>,
                  li: ({children}) => <li className="mb-1 last:mb-0">{children}</li>,
                  a: ({children, href}) => (
                    <a 
                      href={href} 
                      className={`underline ${message.role === 'user' ? 'text-white' : 'text-purple-600'}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  h1: ({children}) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
                  h2: ({children}) => <h2 className="text-xl font-bold mb-3">{children}</h2>,
                  h3: ({children}) => <h3 className="text-lg font-bold mb-2">{children}</h3>,
                  blockquote: ({children}) => (
                    <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4">
                      {children}
                    </blockquote>
                  ),
                }}
                className={`prose ${message.role === 'user' ? 'prose-invert' : ''} max-w-none`}
              >
                {message.content}
              </ReactMarkdown>
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