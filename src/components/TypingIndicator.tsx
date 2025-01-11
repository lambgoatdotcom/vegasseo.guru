import React, { useState, useEffect } from 'react';
import { getLoadingMessage, LoadingAction } from '../config/loadingMessages';

interface TypingIndicatorProps {
  action?: LoadingAction;
}

function TypingIndicator({ action = 'thinking' }: TypingIndicatorProps) {
  const [message, setMessage] = useState(getLoadingMessage(action));

  useEffect(() => {
    const interval = setInterval(() => {
      setMessage(getLoadingMessage(action));
    }, 3000);

    return () => clearInterval(interval);
  }, [action]);

  return (
    <div className="flex items-center space-x-2 p-2">
      <div className="text-gray-500">{message}</div>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export default TypingIndicator;