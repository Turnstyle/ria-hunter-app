'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ApiError, ApiResponse } from '@/lib/types';
import { useAskApi } from '@/hooks/useApi';
import AssistantMessage from './AssistantMessage';
import QuerySuggestions from './QuerySuggestions';

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const { isLoading, error, askQuestion } = useAskApi();

  const sendQuery = async (query: string) => {
    if (!query || isLoading) return;

    const userMessage: ChatMessage = { id: uuidv4(), role: 'user', content: query };
    const assistantPlaceholder: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      isLoading: true,
    };
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput('');

    const apiResponse = (await askQuestion(query)) as (ApiResponse & Partial<ApiError>) | null;
    let content = apiResponse?.answer || (error ? `Error: ${error}` : 'Sorry, I encountered an error.');
    if (apiResponse && 'error' in apiResponse) {
      const status = (apiResponse as any).status as number | undefined;
      let userMessage = 'I encountered an issue processing your request.';
      let suggestion = '';
      if (status === 401 || status === 402) {
        userMessage = 'This query requires authentication.';
        suggestion = 'Please sign in to access this information.';
      } else if (status === 429) {
        userMessage = "You've made too many requests.";
        suggestion = 'Please wait a moment before trying again.';
      } else if (typeof status === 'number' && status >= 500) {
        userMessage = 'Our system is having temporary difficulties.';
        suggestion = 'Please try again in a few moments, or try rephrasing your question.';
      }
      const ref = (apiResponse as any).errorId ? ` If this persists, reference error ID: ${(apiResponse as any).errorId}` : '';
      content = `${userMessage} ${suggestion}${ref ? `\n\n${ref}` : ''}`.trim();
    }
    const finalMessage: ChatMessage = {
      id: assistantPlaceholder.id,
      role: 'assistant',
      content,
      sources: (apiResponse as any)?.sources || [],
      isLoading: false,
    };
    setMessages((prev) => prev.map((msg) => (msg.id === finalMessage.id ? finalMessage : msg)));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await sendQuery(input.trim());
  };

  return (
    <div className="w-full">
      <div className="space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">Try one of these:</div>
            <QuerySuggestions onSelect={sendQuery} />
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={message.role === 'user' ? 'text-right' : 'text-left'}>
            {message.role === 'user' ? (
              <div className="inline-block bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[85%]">
                <p className="text-sm font-medium break-words">{message.content}</p>
              </div>
            ) : (
              <div className="inline-block bg-white rounded-2xl rounded-bl-md px-4 py-4 max-w-[95%] shadow-lg border border-gray-100">
                <AssistantMessage message={message} />
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about RIAs…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {isLoading ? 'Asking…' : 'Ask'}
        </button>
      </form>
      {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
    </div>
  );
}
