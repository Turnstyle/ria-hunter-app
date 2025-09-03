// app/components/ChatInterface.tsx
// This is the main chat component - it MUST use natural language responses

'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useSessionDemo } from '@/app/hooks/useSessionDemo';
import { apiClient, type AskResponse } from '@/app/lib/api/client';
import { AlertCircle, Send, Loader2, StopCircle } from 'lucide-react';
import { errorManager } from '@/app/components/ErrorBanner';
import MarkdownResponse from '@/app/components/MarkdownResponse';
import Link from 'next/link';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { session } = useAuth();
  const { searchesRemaining, isSubscriber, canSearch, updateFromResponse, isLoading: isLoadingSession } = useSessionDemo();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive, but only when there's already content
  useEffect(() => {
    // Only auto-scroll if we have more than 1 message (prevents initial scroll on page load)
    if (messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Handle keyboard shortcut for submitting (Ctrl+Enter or Cmd+Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isSubmitting && !isStreaming) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };
  
  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isSubmitting || isStreaming) {
      return;
    }
    
    // Check if user can perform search
    if (!canSearch) {
      setError("You've used your 5 free demo searches. Create a free account to continue exploring RIA Hunter with unlimited searches for 7 days.");
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
    
    // Keep focus on input field for better UX
    inputRef.current?.focus();
    
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
      setIsSubmitting(true);
      
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
          // Check if we're in debug mode
          const urlParams = new URLSearchParams(window.location.search);
          const isDebugMode = urlParams.get('debug') === '1';
          
          // Process token if needed for gobbledygook text
          let processedToken = token;
          if (isDebugMode && token.length > 50) {
            // Check if this looks like raw context (long runs of text without spaces)
            const noSpaceRuns = token.match(/[A-Za-z]{20,}/g);
            if (noSpaceRuns && noSpaceRuns.length > 2) {
              console.log('[ChatInterface] Detected possible gobbledygook, applying normalizer');
              // Simple normalizer: add spaces between capital letters that seem to start new words
              processedToken = token.replace(/([a-z])([A-Z])/g, '$1 $2')
                                   .replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2');
            }
          }
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + processedToken }
              : msg
          ));
        },
        // On complete
        (response: AskResponse) => {
          try {
            // Update credits from response
            updateFromResponse(response);
            
            // Debug: Log the complete response to understand source structure
            console.log('[ChatInterface] Complete response:', response);
            console.log('[ChatInterface] Response sources:', response.sources);
            
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
          } catch (innerError) {
            console.error("Error in completion handler:", innerError);
          } finally {
            setIsStreaming(false);
            setIsSubmitting(false);
            streamingMessageIdRef.current = null;
          }
        },
        // On error
        (error: Error) => {
          try {
            console.error('[ChatInterface] Streaming error:', error);
            
            // Parse error message for specific handling
            const errorMessage = error.message;
            
            // Update message with appropriate user-friendly error
            let displayMessage = 'I apologize, but I\'m having trouble processing your request right now. Please try again in a moment.';
            
            if (errorMessage.includes('METHOD_NOT_ALLOWED')) {
              displayMessage = 'I\'m experiencing a temporary issue. Please refresh the page and try your question again.';
              errorManager.showError('Unable to process request', 'Please refresh the page and try again.', 'warning', 5000);
            } else if (errorMessage.includes('5 free demo searches') || errorMessage === 'DEMO_LIMIT_REACHED') {
              displayMessage = "You've reached your 5 free searches. Sign up for a free account to continue exploring RIA Hunter with unlimited searches for 7 days!";
              errorManager.showDemoLimitError();
            } else if (errorMessage === 'AUTHENTICATION_REQUIRED') {
              displayMessage = 'Please sign in to access this feature.';
              errorManager.showAuthenticationError();
            } else if (errorMessage === 'RATE_LIMITED') {
              displayMessage = 'Please wait a moment before sending another request.';
              errorManager.showRateLimitError();
            } else if (errorMessage.includes('Stream request failed: 405')) {
              displayMessage = 'I\'m having trouble connecting right now. Please try again shortly.';
              errorManager.showError('Connection issue', 'Please try again in a few moments.', 'warning', 7000);
            } else if (errorMessage.includes('Stream request failed: 500') || errorMessage.includes('status 500')) {
              displayMessage = 'I\'m temporarily unavailable. Our team is working on it - please try again soon.';
              errorManager.showBackendError();
            } else {
              displayMessage = 'I couldn\'t complete your request. Please try again.';
              errorManager.showError('Request failed', 'Please try your question again.', 'warning', 5000);
            }
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: displayMessage,
                    isStreaming: false,
                  }
                : msg
            ));
          } catch (innerError) {
            console.error("Error in error handler:", innerError);
          } finally {
            setIsStreaming(false);
            setIsSubmitting(false);
            streamingMessageIdRef.current = null;
          }
        }
      );
    } catch (error) {
      console.error('Failed to send query:', error);
      
      try {
        // Handle specific error types with user-friendly messages
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('5 free demo searches') || errorMessage === 'DEMO_LIMIT_REACHED') {
          errorManager.showDemoLimitError();
          setError("You've reached your 5 free searches. Sign up for a free account to continue!");
        } else if (errorMessage === 'AUTHENTICATION_REQUIRED') {
          errorManager.showAuthenticationError();
          setError('Please sign in to continue.');
        } else if (errorMessage === 'RATE_LIMITED') {
          errorManager.showRateLimitError();
          setError('Please wait a moment before trying again.');
        } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
          errorManager.showBackendError();
          setError('Service temporarily unavailable. Please try again soon.');
        } else {
          errorManager.showError('Unable to process request', 'Please try again in a moment.', 'warning', 5000);
          setError('Unable to process your request. Please try again.');
        }
        
        // Remove the placeholder message
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
      } catch (innerError) {
        console.error("Error in catch handler:", innerError);
      } finally {
        setIsStreaming(false);
        setIsSubmitting(false);
        streamingMessageIdRef.current = null;
      }
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
            <div className="flex items-center justify-center mb-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              <p className="font-medium">AI-Powered RIA Assistant</p>
            </div>
            <p>Ask me anything about registered investment advisors.</p>
            <div className="mt-6 bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
              <h4 className="font-medium text-gray-700 mb-2">Try these queries:</h4>
              <ul className="text-sm text-gray-600 space-y-1 text-left">
                <li>• "Show me the largest RIAs in St. Louis"</li>
                <li>• "Find investment advisors specializing in biotech"</li>
                <li>• "Which RIAs have venture capital activity?"</li>
                <li>• "Search for Edward Jones details"</li>
              </ul>
            </div>
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
                {message.role === 'assistant' ? (
                  <MarkdownResponse content={message.content} sources={message.sources} />
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
                
                {/* Streaming indicator */}
                {message.isStreaming && (
                  <div className="mt-2 flex items-center text-sm opacity-70">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    <div className="flex flex-col">
                      <span>AI is analyzing your query...</span>
                      <span className="text-xs mt-1">Processing semantic search and generating response</span>
                    </div>
                  </div>
                )}
                
                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-sm font-semibold mb-1">Sources:</p>
                    <ul className="text-sm space-y-1">
                      {message.sources.map((source, idx) => (
                        <li key={idx}>
                          {source.crd ? (
                            <Link 
                              href={`/profile/${source.crd}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              {source.title || `RIA Profile (CRD: ${source.crd})`}
                            </Link>
                          ) : source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {source.title || source.url}
                            </a>
                          ) : (
                            <span>{source.title || 'Source'}</span>
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
      
      {/* Error Display - Inline non-blocking error */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{error}</p>
            {(error.includes('demo') || error.includes('searches')) && (
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
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about RIAs, venture capital activity, executives... (Ctrl+Enter to send)"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isStreaming || isSubmitting}
            aria-label="Chat input"
          />
          
          {isStreaming ? (
            <button
              type="button"
              onClick={handleCancelStream}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Stop streaming"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isStreaming || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
              title="Send message (Ctrl+Enter)"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Search limit indicator */}
        {!isSubscriber && searchesRemaining !== null && (
          <p className="mt-2 text-sm text-gray-600">
            {searchesRemaining > 0 
              ? `${searchesRemaining} free searches remaining` 
              : 'Demo limit reached - Sign up for unlimited searches'}
          </p>
        )}
      </form>
    </div>
  );
}

export default ChatInterface;
