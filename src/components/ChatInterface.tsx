import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '../types';
import { ModelType, streamMessage, Source } from '../services/api';
import TypingIndicator from './TypingIndicator';

interface ChatInterfaceProps {
  onClose: () => void;
  onAskStart: () => void;
}

interface ChatResponse {
  response: string;
  sources?: Source[];
  search_performed: boolean;
}

function formatSourcesForDisplay(sources: Source[]): string {
  if (!sources || sources.length === 0) return '';
  
  let formattedSources = "\n\n## Sources\n";
  sources.forEach((source, index) => {
    formattedSources += `\n${index + 1}. [${source.title}](${source.url})`;
  });
  return formattedSources;
}

function ChatInterface({ onClose, onAskStart }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your Las Vegas SEO Guru. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Ask me anything about optimizing your website for the Las Vegas market!`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('deepseek');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current && messageContainerRef.current) {
      const container = messageContainerRef.current;
      const endElement = messagesEndRef.current;
      const containerRect = container.getBoundingClientRect();
      const endElementRect = endElement.getBoundingClientRect();
      
      // Only auto-scroll if the end element is not above the visible area
      if (endElementRect.top >= containerRect.top) {
        endElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    if (streamingMessage) {
      scrollToBottom();
    }
  }, [streamingMessage]);

  const detectSearchIntent = (message: string): boolean => {
    const message_lower = message.toLowerCase();
    
    // 1. Explicit search phrases
    const searchPhrases = [
      // Direct search requests
      'search for',
      'look up',
      'find',
      'search',
      'lookup',
      'tell me about',
      'what do you know about',
      'information about',
      'info on',
      'details about',
      'learn about',
      'show me',
      
      // Time-based queries
      'get me the latest',
      'what is the current',
      'what are the latest',
      'most recent',
      'up to date',
      'latest',
      'current',
      'newest',
      'recent',
      'today',
      'this week',
      'this month',
      'this year',
      '2024',
      'right now',
      'nowadays',
      'these days',
      'at the moment',
      'presently',
      
      // Comparative queries
      'what changed',
      'has anything changed',
      'any updates',
      'whats new',
      "what's new",
      'what has changed',
      'what are the changes',
      'how has it evolved',
      'evolution of',
      'development of',
      'progress in',
      'advancement in',
      
      // News and trends
      'news about',
      'trending',
      'trend',
      'popular',
      'whats trending',
      "what's trending",
      'in the news',
      'making headlines',
      'buzz about',
      'viral',
      'hot topic',
      'emerging',
      
      // Status queries
      'status of',
      'state of',
      'how is',
      'tell me about',
      'what is happening with',
      'whats going on with',
      'situation with',
      'condition of',
      'health of',
      
      // Data and statistics
      'statistics',
      'stats',
      'data',
      'numbers',
      'metrics',
      'analytics',
      'figures',
      'percentages',
      'rates',
      'measurements',
      'calculations',
      'averages',
      
      // Market-specific queries
      'market conditions',
      'market trends',
      'industry trends',
      'competition',
      'competitors',
      'market analysis',
      'sector overview',
      'industry outlook',
      'market forecast',
      'market prediction',
      
      // Verification queries
      'is it true',
      'verify',
      'fact check',
      'confirm',
      'validate',
      'prove',
      'evidence',
      'source',
      'citation',
      'reference',
      'according to',
      'based on',
      
      // Research-oriented
      'research',
      'analyze',
      'investigate',
      'explore',
      'study',
      'examine',
      'review',
      'assess',
      'evaluate',
      'survey'
    ];
    
    // 2. Check for explicit search phrases
    if (searchPhrases.some(phrase => message_lower.includes(phrase))) {
      return true;
    }
    
    // 3. Check for temporal indicators
    const yearPattern = /(19|20)\d{2}/;  // Matches years from 1900-2099
    const datePattern = /\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?/;  // Matches dates with - or /
    const monthPattern = /(january|february|march|april|may|june|july|august|september|october|november|december)/;
    const relativeTimePattern = /(last|next|this) (week|month|year|quarter|season)/;
    
    if (yearPattern.test(message_lower) || 
        datePattern.test(message_lower) || 
        monthPattern.test(message_lower) ||
        relativeTimePattern.test(message_lower)) {
      return true;
    }
    
    // 4. Check for questions that likely need current information
    const questionWords = ['what', 'who', 'where', 'when', 'why', 'how', 'which', 'whose', 'whom'];
    const timeWords = [
      'now', 'today', 'current', 'latest', 'recent',
      'modern', 'contemporary', 'present', 'ongoing',
      'upcoming', 'future', 'soon', 'shortly'
    ];
    if (questionWords.some(word => message_lower.startsWith(word)) &&
        timeWords.some(word => message_lower.includes(word))) {
      return true;
    }

    // 5. Implicit search needs - Topics that likely need current data
    const currentTopics = [
      // Business and Market Data
      'revenue',
      'market share',
      'stock',
      'price',
      'cost',
      'rate',
      'ranking',
      'algorithm',
      'investment',
      'funding',
      'valuation',
      'profit',
      'loss',
      'earnings',
      'forecast',
      
      // Technology and Tools
      'google',
      'algorithm',
      'update',
      'version',
      'feature',
      'tool',
      'platform',
      'software',
      'app',
      'api',
      'integration',
      'plugin',
      'extension',
      'framework',
      'library',
      'sdk',
      'technology stack',
      
      // Events and Schedules
      'event',
      'conference',
      'meeting',
      'schedule',
      'deadline',
      'release',
      'launch',
      'announcement',
      'presentation',
      'webinar',
      'workshop',
      'seminar',
      'expo',
      'summit',
      
      // Performance Metrics
      'performance',
      'ranking',
      'traffic',
      'conversion',
      'engagement',
      'roi',
      'metrics',
      'bounce rate',
      'session duration',
      'page views',
      'click-through',
      'impressions',
      'visibility',
      'domain authority',
      'page authority',
      
      // Competitive Information
      'competitor',
      'industry',
      'market',
      'leader',
      'benchmark',
      'competition',
      'rival',
      'alternative',
      'comparison',
      'market share',
      'competitive advantage',
      'usp',
      'differentiator',
      
      // Regulations and Standards
      'regulation',
      'compliance',
      'law',
      'requirement',
      'policy',
      'guideline',
      'standard',
      'rule',
      'restriction',
      'limitation',
      'permission',
      'authorization',
      'certification',
      'accreditation',
      
      // Pricing and Economic Data
      'price',
      'cost',
      'rate',
      'fee',
      'pricing',
      'budget',
      'expense',
      'investment',
      'subscription',
      'payment',
      'billing',
      'discount',
      'promotion',
      'offer',
      
      // Technical SEO Elements
      'core web vitals',
      'page speed',
      'mobile first',
      'schema',
      'structured data',
      'meta',
      'canonical',
      'index',
      'crawl',
      'sitemap',
      'robots.txt',
      'http status',
      'redirect',
      'ssl',
      'https',
      'amp',
      'responsive',
      'mobile friendly',
      
      // Social Proof and Reviews
      'review',
      'rating',
      'testimonial',
      'feedback',
      'comment',
      'opinion',
      'reputation',
      'satisfaction',
      'recommendation',
      
      // Content and Marketing
      'content',
      'blog',
      'article',
      'post',
      'publication',
      'campaign',
      'strategy',
      'tactic',
      'channel',
      'medium',
      'distribution',
      'promotion'
    ];

    if (currentTopics.some(topic => message_lower.includes(topic))) {
      return true;
    }

    // 6. Check for comparison or evaluation questions
    const comparisonWords = [
      'better', 'best', 'worse', 'worst', 'versus', 'vs', 'compare', 'difference', 'between',
      'alternative', 'option', 'choice', 'selection', 'prefer', 'recommendation', 'suggest',
      'advantage', 'disadvantage', 'pro', 'con', 'benefit', 'drawback', 'upside', 'downside',
      'similar', 'different', 'like', 'unlike', 'same as', 'other than', 'instead of'
    ];
    if (comparisonWords.some(word => message_lower.includes(word))) {
      return true;
    }

    // 7. Check for questions about specific entities or products
    const entityIndicators = [
      'is', 'does', 'can', 'will', 'should', 'would', 'could', 'has',
      'do they', 'are they', 'what about', 'tell me if', 'explain if',
      'works', 'functions', 'operates', 'performs', 'behaves'
    ];
    if (entityIndicators.some(word => message_lower.startsWith(word))) {
      return true;
    }

    // 8. Check for questions about recommendations or best practices
    const recommendationWords = [
      'recommend', 'suggest', 'advice', 'tips', 'best practice', 'how to',
      'strategy', 'guidance', 'direction', 'instruction', 'approach',
      'methodology', 'technique', 'tactic', 'way to', 'method for',
      'solution', 'fix', 'resolve', 'handle', 'deal with', 'manage',
      'optimize', 'improve', 'enhance', 'boost', 'increase', 'grow'
    ];
    if (recommendationWords.some(word => message_lower.includes(word))) {
      return true;
    }

    // 9. Check for questions about problems or issues
    const problemWords = [
      'problem', 'issue', 'error', 'bug', 'fault', 'defect', 'flaw',
      'trouble', 'difficulty', 'challenge', 'obstacle', 'barrier',
      'limitation', 'constraint', 'restriction', 'bottleneck',
      'not working', 'broken', 'failed', 'failing', 'stuck',
      'help with', 'fix', 'solve', 'resolve', 'troubleshoot'
    ];
    if (problemWords.some(word => message_lower.includes(word))) {
      return true;
    }

    // 10. Check for questions about implementation or how-to
    const implementationWords = [
      'implement', 'deploy', 'install', 'setup', 'configure', 'build',
      'create', 'develop', 'establish', 'start', 'begin', 'initiate',
      'launch', 'roll out', 'introduce', 'adopt', 'integrate',
      'step by step', 'guide', 'tutorial', 'walkthrough', 'instructions'
    ];
    if (implementationWords.some(word => message_lower.includes(word))) {
      return true;
    }

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const shouldSearch = searchEnabled || detectSearchIntent(input);
    onAskStart();
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsSearching(shouldSearch);
    setStreamingMessage('');

    try {
      let fullResponse = '';
      let sources: Source[] | undefined;
      
      for await (const chunk of streamMessage([...messages, userMessage], selectedModel, shouldSearch)) {
        if (chunk.error) {
          throw new Error(chunk.error);
        }
        if (chunk.content) {
          fullResponse += chunk.content;
          setStreamingMessage(fullResponse);
        }
        if (chunk.sources) {
          sources = chunk.sources;
        }
      }

      // Format the final message with sources if available
      let finalContent = fullResponse;
      if (sources && sources.length > 0) {
        finalContent += formatSourcesForDisplay(sources);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: finalContent }]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: shouldSearch 
          ? 'I apologize, but I encountered an error while searching for information. Please try again or disable search.'
          : 'I apologize, but I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setStreamingMessage('');
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
          <button
            onClick={() => setSearchEnabled(!searchEnabled)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
              searchEnabled 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <span className={isSearching ? 'animate-spin' : ''}>🔍</span>
            <span>{searchEnabled ? 'Search On' : 'Search Off'}</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div ref={messageContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'assistant' ? 'justify-start' : 'justify-end'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'assistant'
                  ? 'bg-gray-100'
                  : 'bg-purple-500 text-white'
              }`}
            >
              <ReactMarkdown
                components={{
                  code: ({ className, children }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <div className="rounded-md text-sm">
                        <SyntaxHighlighter
                          style={atomDark}
                          language={match[1]}
                          PreTag="div"
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className={`${className} bg-gray-700/10 rounded px-1 py-0.5`}>
                        {children}
                      </code>
                    );
                  },
                  p: ({children}) => <p className="mb-4 last:mb-0">{children}</p>,
                  ul: ({children}) => <ul className="list-disc ml-6 mb-4 last:mb-0">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal ml-6 mb-4 last:mb-0">{children}</ol>,
                  li: ({children}) => <li className="mb-1">{children}</li>,
                  a: ({href, children}) => (
                    <a 
                      href={href}
                      className="text-blue-500 hover:text-blue-600 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-4 bg-gray-100">
              <ReactMarkdown
                components={{
                  code: ({ className, children }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <div className="rounded-md text-sm">
                        <SyntaxHighlighter
                          style={atomDark}
                          language={match[1]}
                          PreTag="div"
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className={`${className} bg-gray-700/10 rounded px-1 py-0.5`}>
                        {children}
                      </code>
                    );
                  },
                  p: ({children}) => <p className="mb-4 last:mb-0">{children}</p>,
                  ul: ({children}) => <ul className="list-disc ml-6 mb-4 last:mb-0">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal ml-6 mb-4 last:mb-0">{children}</ol>,
                  li: ({children}) => <li className="mb-1">{children}</li>,
                  a: ({href, children}) => (
                    <a 
                      href={href}
                      className="text-blue-500 hover:text-blue-600 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {streamingMessage}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {isLoading && !streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-4 bg-gray-100">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me about Las Vegas SEO..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </>
  );
}

export default ChatInterface;