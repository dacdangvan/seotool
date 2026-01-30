/**
 * Manager Copilot Component
 * 
 * v0.7 - Natural language AI assistant for managers
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  Send, 
  Sparkles, 
  User, 
  Bot,
  Loader2,
  RefreshCw
} from 'lucide-react';
import type { CopilotMessage, CopilotSuggestion } from '@/types/dashboard';
import { sendCopilotMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ManagerCopilotProps {
  className?: string;
}

export function ManagerCopilot({ className }: ManagerCopilotProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsExpanded(true);

    try {
      const response = await sendCopilotMessage(messageText, messages);
      
      const assistantMessage: CopilotMessage = {
        id: `msg-${Date.now()}-response`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: CopilotMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: "I'm sorry, I couldn't process your request. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: CopilotSuggestion) => {
    handleSend(suggestion.text);
  };

  const handleReset = () => {
    setMessages([]);
    setIsExpanded(false);
  };

  // Render markdown-like content
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Bold headers
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={i} className="font-bold text-gray-900 mt-3 mb-1">
            {line.replace(/\*\*/g, '')}
          </p>
        );
      }
      // List items
      if (line.match(/^\d+\.\s/)) {
        return (
          <p key={i} className="ml-4 my-1">
            {line}
          </p>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <p key={i} className="ml-4 my-1">
            • {line.substring(2)}
          </p>
        );
      }
      // Italic emphasis
      if (line.startsWith('*') && line.endsWith('*')) {
        return (
          <p key={i} className="italic text-gray-600 text-sm mt-2">
            {line.replace(/\*/g, '')}
          </p>
        );
      }
      // Empty lines
      if (line.trim() === '') {
        return <br key={i} />;
      }
      // Regular text
      return <p key={i} className="my-1">{line}</p>;
    });
  };

  return (
    <div className={cn(
      "bg-white rounded-xl border border-gray-200 overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI SEO Copilot</h2>
              <p className="text-sm text-blue-100">Ask anything about your SEO performance</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      {isExpanded && messages.length > 0 && (
        <div className="max-h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3",
                  message.role === 'user'
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-700"
                )}
              >
                {message.role === 'user' ? (
                  <p>{message.content}</p>
                ) : (
                  <div className="text-sm leading-relaxed">
                    {renderContent(message.content)}
                  </div>
                )}
              </div>
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Suggestions */}
      {!isExpanded && (
        <div className="p-4">
          <p className="text-sm text-gray-500 mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {[].map((suggestion: CopilotSuggestion, i: number) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                {suggestion.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your SEO performance..."
            className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder:text-gray-400"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={cn(
              "p-2 rounded-lg transition-colors",
              input.trim() && !isLoading
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
