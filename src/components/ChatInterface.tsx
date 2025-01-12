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
  isExpanded?: boolean;
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

function ChatInterface({ onClose, onAskStart, isExpanded }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hey there! I'm Frankie, your Las Vegas SEO expert. It's ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} and I'm here to help your business stand out in the vibrant Las Vegas market! Whether you're looking to improve your search rankings or attract more visitors to your site, I've got expert strategies to help you succeed. What would you like to know about marketing in Las Vegas?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini');
  const [isSearching, setIsSearching] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [showMoreSuggestions, setShowMoreSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [isInitialRender, setIsInitialRender] = useState(true);

  const randomPrompts = [
    "What are the best SEO strategies for Las Vegas businesses?",
    "How can I improve my local search rankings in Las Vegas?",
    "What are the latest digital marketing trends in Las Vegas?",
    "How can I optimize my website for Las Vegas visitors?",
    "Share your top tips for Las Vegas business marketing",
    "What makes Las Vegas SEO unique?",
    "How can I showcase Las Vegas attractions on my site?",
    "What are the best ways to reach Las Vegas tourists online?",
    "How can I highlight local Las Vegas experiences?",
    "What content works best for Las Vegas audiences?"
  ];

  const formatNumberedList = (text: string): string => {
    // Split into lines while preserving original spacing
    const lines = text.split('\n');
    let formatted = '';
    let inList = false;
    let listCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line starts with a number followed by a dot, period, or asterisk
      const numberMatch = line.match(/^\s*(\d+)[:.)\*]\s*(.*)/);
      
      if (numberMatch) {
        // If this is a numbered item
        if (!inList) {
          inList = true;
          listCounter = parseInt(numberMatch[1]);
          formatted += '\n';
        }
        
        // Keep original content after the number, preserving spaces
        formatted += `${listCounter}. ${numberMatch[2]}\n`;
        listCounter++;
      } else {
        // Not a numbered item - preserve the line as is
        formatted += `${line}\n`;
        if (line.trim() === '') {
          inList = false;
        }
      }
    }

    return formatted.trimEnd();
  };

  const seoAuditPhrases = [
    'audit',
    'inspect',
    'analyze',
    'look at',
    'check',
    'review',
    'improve',
    'optimize',
    'examine'
  ];

  const detectSEOAuditIntent = (message: string): boolean => {
    const message_lower = message.toLowerCase();
    return seoAuditPhrases.some(phrase => 
      message_lower.includes(phrase) && 
      (message_lower.includes('page') || message_lower.includes('website') || message_lower.includes('site'))
    );
  };

  const extractUrl = (text: string): string | null => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
  };

  const handleSEOAudit = async (url: string): Promise<string> => {
    try {
      const response = await fetch('/api/seo/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error('Failed to perform SEO audit');
      }

      const result = await response.json();
      return result.report;
    } catch (error) {
      console.error('SEO audit error:', error);
      return "I encountered an error while trying to analyze the page. Please make sure you've provided a valid URL and try again.";
    }
  };

  const handleMessage = async (prompt: string) => {
    if (isLoading) return;
    
    const shouldSearch = detectSearchIntent(prompt);
    const isAuditRequest = detectSEOAuditIntent(prompt);
    
    onAskStart();
    const userMessage: Message = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsSearching(shouldSearch);
    setStreamingMessage('');

    try {
      if (isAuditRequest) {
        const url = extractUrl(prompt);
        if (!url) {
          const askForUrlMessage: Message = {
            role: 'assistant',
            content: "I'll help you analyze that page for SEO. Could you please share the URL you'd like me to check? Make sure it starts with http:// or https://"
          };
          setMessages(prev => [...prev, askForUrlMessage]);
        } else {
          const auditReport = await handleSEOAudit(url);
          const responseMessage: Message = {
            role: 'assistant',
            content: auditReport
          };
          setMessages(prev => [...prev, responseMessage]);
        }
        setIsLoading(false);
        return;
      }

      const stream = await streamMessage([...messages, userMessage], selectedModel, shouldSearch);
      let fullResponse = '';
      let sources: Source[] | undefined;
      
      for await (const chunk of stream) {
        if (chunk.error) {
          throw new Error(chunk.error);
        }
        if (chunk.content) {
          fullResponse += chunk.content;
          const mainContent = fullResponse.split(/\n*## Sources/)[0];
          setStreamingMessage(formatNumberedList(mainContent));
        }
        if (chunk.sources) {
          sources = chunk.sources;
        }
      }

      let finalContent = fullResponse.split(/\n*## Sources/)[0].trim();
      finalContent = formatNumberedList(finalContent);
      
      if (sources && sources.length > 0) {
        finalContent += '\n\n' + formatSourcesForDisplay(sources);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: finalContent }]);
    } catch (error: unknown) {
      console.error('Failed to get response:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setStreamingMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await handleMessage(input.trim());
  };

  const handleSuggestionClick = async (prompt: string) => {
    await handleMessage(prompt);
  };

  const rollTheDice = async () => {
    const randomIndex = Math.floor(Math.random() * randomPrompts.length);
    const randomPrompt = randomPrompts[randomIndex];
    await handleMessage(randomPrompt);
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!isInitialRender && (streamingMessage || messages.length > 1)) {
      scrollToBottom();
    }
    setIsInitialRender(false);
  }, [streamingMessage, messages, isInitialRender]);

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

  const handleImproveRankingsClick = async () => {
    const askForWebsiteMessage: Message = {
      role: 'assistant',
      content: "Ready to boost your rankings? Sweet! Drop your website URL here, and I'll deal you a winning hand of SEO strategies tailored just for you. 🎰"
    };
    setMessages(prev => [...prev, askForWebsiteMessage]);
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">Deal Me Some SEO Magic</h2>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as ModelType)}
            className="ml-4 p-2 border rounded-lg"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">Deepseek</option>
          </select>
        </div>
        {isExpanded && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div ref={messageContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'assistant' ? 'justify-start' : 'justify-end'
            }`}
          >
            <div className="flex items-end">
              {message.role === 'assistant' && (
                <img 
                  src="http://localhost:5173/src/assets/images/seoguru-trans.png" 
                  alt="SEO Guru" 
                  className="w-16 h-16 rounded-full mr-2"
                />
              )}
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'assistant'
                    ? 'bg-gray-100'
                    : 'bg-purple-500 text-white'
                }`}
              >
                <ReactMarkdown
                  components={{
                    // Basic text formatting
                    p: ({children}) => (
                      <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
                    ),
                    
                    // Headers
                    h1: ({children}) => (
                      <h1 className="text-xl font-bold mb-4">{children}</h1>
                    ),
                    h2: ({children}) => (
                      <h2 className="text-lg font-bold mb-3">{children}</h2>
                    ),
                    h3: ({children}) => (
                      <h3 className="text-base font-bold mb-2">{children}</h3>
                    ),

                    // Lists
                    ol: ({children}) => (
                      <ol className="mb-4 last:mb-0 pl-4 list-decimal space-y-4 [counter-reset:list-counter] [&>li]:relative [&>li]:pl-2">
                        {children}
                      </ol>
                    ),
                    ul: ({children}) => (
                      <ul className="mb-4 last:mb-0 pl-4 list-disc space-y-2">
                        {children}
                      </ul>
                    ),
                    li: ({children}) => {
                      const content = React.Children.toArray(children);
                      const text = content.map(child => 
                        typeof child === 'string' ? child : ''
                      ).join('');
                      
                      // Check if this is a numbered list item with a title
                      const titleMatch = text.match(/^([^:.]+)[:.]?\s*(.+)$/);
                      
                      if (!titleMatch) {
                        return (
                          <li className="leading-relaxed">
                            {children}
                          </li>
                        );
                      }
                      
                      const [, title, description] = titleMatch;
                      return (
                        <li className="leading-relaxed">
                          <strong className="block mb-2">{title}</strong>
                          <span className="block text-gray-700">{description}</span>
                        </li>
                      );
                    },

                    // Links
                    a: ({href, children}) => (
                      <a 
                        href={href}
                        className="text-blue-500 hover:text-blue-600 underline break-words"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),

                    // Code blocks
                    code: ({className, children}) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match;
                      return !isInline ? (
                        <div className="rounded-md my-4">
                          <SyntaxHighlighter
                            style={atomDark}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-md"
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className="bg-gray-700/10 rounded px-1.5 py-0.5 text-sm">
                          {children}
                        </code>
                      );
                    },

                    // Horizontal rule
                    hr: () => <hr className="my-4 border-gray-300" />,

                    // Strong and emphasis
                    strong: ({children}) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({children}) => (
                      <em className="italic">{children}</em>
                    ),

                    // Block quote
                    blockquote: ({children}) => (
                      <blockquote className="border-l-4 border-gray-300 pl-4 my-4 italic">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && streamingMessage && (
          <div className="flex justify-start">
            <div className="flex items-end">
              <img 
                src="http://localhost:5173/src/assets/images/seoguru-trans.png" 
                alt="SEO Guru" 
                className="w-16 h-16 rounded-full mr-2"
              />
              <div className="max-w-[80%] rounded-lg p-4 bg-gray-100">
                <ReactMarkdown
                  components={{
                    // Basic text formatting
                    p: ({children}) => (
                      <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
                    ),
                    
                    // Headers
                    h1: ({children}) => (
                      <h1 className="text-xl font-bold mb-4">{children}</h1>
                    ),
                    h2: ({children}) => (
                      <h2 className="text-lg font-bold mb-3">{children}</h2>
                    ),
                    h3: ({children}) => (
                      <h3 className="text-base font-bold mb-2">{children}</h3>
                    ),

                    // Lists
                    ol: ({children}) => (
                      <ol className="mb-4 last:mb-0 pl-4 list-decimal space-y-4 [counter-reset:list-counter] [&>li]:relative [&>li]:pl-2">
                        {children}
                      </ol>
                    ),
                    ul: ({children}) => (
                      <ul className="mb-4 last:mb-0 pl-4 list-disc space-y-2">
                        {children}
                      </ul>
                    ),
                    li: ({children}) => {
                      const content = React.Children.toArray(children);
                      const text = content.map(child => 
                        typeof child === 'string' ? child : ''
                      ).join('');
                      
                      // Check if this is a numbered list item with a title
                      const titleMatch = text.match(/^([^:.]+)[:.]?\s*(.+)$/);
                      
                      if (!titleMatch) {
                        return (
                          <li className="leading-relaxed">
                            {children}
                          </li>
                        );
                      }
                      
                      const [, title, description] = titleMatch;
                      return (
                        <li className="leading-relaxed">
                          <strong className="block mb-2">{title}</strong>
                          <span className="block text-gray-700">{description}</span>
                        </li>
                      );
                    },

                    // Links
                    a: ({href, children}) => (
                      <a 
                        href={href}
                        className="text-blue-500 hover:text-blue-600 underline break-words"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),

                    // Code blocks
                    code: ({className, children}) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match;
                      return !isInline ? (
                        <div className="rounded-md my-4">
                          <SyntaxHighlighter
                            style={atomDark}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-md"
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className="bg-gray-700/10 rounded px-1.5 py-0.5 text-sm">
                          {children}
                        </code>
                      );
                    },

                    // Horizontal rule
                    hr: () => <hr className="my-4 border-gray-300" />,

                    // Strong and emphasis
                    strong: ({children}) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({children}) => (
                      <em className="italic">{children}</em>
                    ),

                    // Block quote
                    blockquote: ({children}) => (
                      <blockquote className="border-l-4 border-gray-300 pl-4 my-4 italic">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {streamingMessage}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
        {isLoading && !streamingMessage && (
          <div className="flex justify-start">
            <div className="flex items-end">
              <img 
                src="http://localhost:5173/src/assets/images/seoguru-trans.png" 
                alt="SEO Guru" 
                className="w-16 h-16 rounded-full mr-2"
              />
              <div className="max-w-[80%] rounded-lg p-4 bg-gray-100">
                <TypingIndicator action={isSearching ? 'searching' : 'thinking'} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t">
        <form onSubmit={handleSubmit} className="p-4">
          <div className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What's your SEO game plan? Let's make it a winner..."
              className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={rollTheDice}
              className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 border flex items-center justify-center"
              title="Roll the dice for a random SEO tip!"
            >
              <span className="text-2xl leading-none">🎲</span>
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>

      <div className="p-4 space-y-4 bg-gray-50 rounded-b-xl">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSuggestionClick("What are the best SEO strategies for Las Vegas businesses?")}
            className="px-4 py-2 text-sm bg-white hover:bg-gray-100 rounded-lg transition-colors text-left border"
          >
            Top Vegas Strategies
          </button>
          <button
            onClick={() => handleSuggestionClick("How can I optimize my website for Las Vegas tourists?")}
            className="px-4 py-2 text-sm bg-white hover:bg-gray-100 rounded-lg transition-colors text-left border"
          >
            Attract More Visitors
          </button>
          <button
            onClick={() => handleSuggestionClick("What makes Las Vegas SEO unique?")}
            className="px-4 py-2 text-sm bg-white hover:bg-gray-100 rounded-lg transition-colors text-left border"
          >
            Stand Out in Vegas
          </button>
          {showMoreSuggestions && (
            <>
              <button
                onClick={() => handleSuggestionClick("How can I showcase Las Vegas attractions?")}
                className="px-4 py-2 text-sm bg-white hover:bg-gray-100 rounded-lg transition-colors text-left border"
              >
                Highlight Local Attractions
              </button>
              <button
                onClick={() => handleSuggestionClick("What content works best for Las Vegas audiences?")}
                className="px-4 py-2 text-sm bg-white hover:bg-gray-100 rounded-lg transition-colors text-left border"
              >
                Create Engaging Content
              </button>
              <button
                onClick={() => handleSuggestionClick("How can I improve my local search rankings?")}
                className="px-4 py-2 text-sm bg-white hover:bg-gray-100 rounded-lg transition-colors text-left border"
              >
                Boost Local Rankings
              </button>
              <button
                onClick={() => handleSuggestionClick("What are the latest digital marketing trends?")}
                className="px-4 py-2 text-sm bg-white hover:bg-gray-100 rounded-lg transition-colors text-left border"
              >
                Latest Marketing Trends
              </button>
            </>
          )}
          <button
            onClick={() => setShowMoreSuggestions(!showMoreSuggestions)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 ml-auto"
          >
            {showMoreSuggestions ? 'play it safe' : 'raise the stakes'} {showMoreSuggestions ? '↑' : '↓'}
          </button>
        </div>
      </div>
    </>
  );
}

export default ChatInterface;