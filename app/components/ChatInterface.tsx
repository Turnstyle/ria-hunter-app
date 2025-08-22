// app/components/ChatInterface.tsx
// This is the main chat component - it MUST use natural language responses

'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useCredits } from '@/app/hooks/useCredits';
import { apiClient, type AskResponse } from '@/app/lib/api/client';
import { AlertCircle, Send, Loader2, StopCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: Array<{ title?: string; url?: string; crd?: string }>;
  isStreaming?: boolean;
}

function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { session } = useAuth();
  const { credits, isSubscriber, updateFromResponse } = useCredits();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || isStreaming) {
      return;
    }
    
    // Check credits
    if (!isSubscriber && credits <= 0) {
      setError('You have no credits remaining. Please upgrade your plan.');
      return;
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setError(null);
    
    // Create placeholder for assistant message
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    streamingMessageIdRef.current = assistantMessageId;
    
    try {
      setIsStreaming(true);
      
      // Set auth token
      if (session?.access_token) {
        apiClient.setAuthToken(session.access_token);
      }
      
      // Stream the response
      abortControllerRef.current = await apiClient.askStream(
        {
          query: input,
          options: {
            includeDetails: true,
            maxResults: 10,
          },
        },
        // On token received
        (token: string) => {
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + token }
              : msg
          ));
        },
        // On complete
        (response: AskResponse) => {
          // Update credits from response
          updateFromResponse(response);
          
          // Update message with final content and sources
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: response.answer || msg.content,
                  sources: response.sources,
                  isStreaming: false,
                }
              : msg
          ));
          
          setIsStreaming(false);
          streamingMessageIdRef.current = null;
        },
        // On error
        (error: Error) => {
          console.error('Streaming error:', error);
          
          // Update message with error
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: 'I encountered an error processing your request. Please try again.',
                  isStreaming: false,
                }
              : msg
          ));
          
          setError(error instanceof Error ? error.message : String(error));
          setIsStreaming(false);
          streamingMessageIdRef.current = null;
        }
      );
    } catch (error) {
      console.error('Failed to send query:', error);
      
      // Handle specific error types
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage === 'CREDITS_EXHAUSTED') {
        setError('You have used all your credits. Please upgrade to continue.');
      } else if (errorMessage === 'AUTHENTICATION_REQUIRED') {
        setError('Please sign in to continue.');
      } else if (errorMessage === 'RATE_LIMITED') {
        setError('You are sending too many requests. Please slow down.');
      } else {
        setError('Failed to process your query. Please try again.');
      }
      
      // Remove the placeholder message
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
      setIsStreaming(false);
      streamingMessageIdRef.current = null;
    }
  };
  
  // Cancel streaming
  const handleCancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Mark streaming as complete
    if (streamingMessageIdRef.current) {
      const messageId = streamingMessageIdRef.current;
      setMessages(prev => prev.map(msg => 
        msg.id === messageId
          ? { ...msg, isStreaming: false }
          : msg
      ));
    }
    
    setIsStreaming(false);
    streamingMessageIdRef.current = null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg font-semibold mb-2">Welcome to RIA Hunter</p>
            <p>Ask me anything about registered investment advisors.</p>
            <p className="text-sm mt-4">
              Example: "Show me the top 10 RIAs in Missouri with venture capital activity"
            </p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.role === 'system'
                    ? 'bg-yellow-100 text-yellow-900'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {/* Message content */}
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Streaming indicator */}
                {message.isStreaming && (
                  <div className="mt-2 flex items-center text-sm opacity-70">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Generating response...
                  </div>
                )}
                
                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-sm font-semibold mb-1">Sources:</p>
                    <ul className="text-sm space-y-1">
                      {message.sources.map((source, idx) => (
                        <li key={idx}>
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {source.title || source.crd || 'Source'}
                            </a>
                          ) : (
                            <span>{source.title || source.crd || 'Source'}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{error}</p>
            {error.includes('credits') && (
              <button
                onClick={() => window.location.href = '/subscription'}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Upgrade Plan
              </button>
            )}
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about RIAs, venture capital activity, executives..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading || isStreaming || (!isSubscriber && credits <= 0)}
          />
          
          {isStreaming ? (
            <button
              type="button"
              onClick={handleCancelStream}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isLoading || (!isSubscriber && credits <= 0)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Credits indicator */}
        {!isSubscriber && (
          <p className="mt-2 text-sm text-gray-600">
            {credits > 0 ? `${credits} credits remaining` : 'No credits remaining'}
          </p>
        )}
      </form>
    </div>
  );
}

export default ChatInterface;
