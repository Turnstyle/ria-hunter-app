'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@/lib/types';
import { useAskApi } from '@/hooks/useApi';
import { useCredits } from '@/hooks/useCredits';
import type { QueryResultItem, QueryResponse } from '@/services/ria';
import AssistantMessage from './AssistantMessage';
import QuerySuggestions from './QuerySuggestions';

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const { isLoading, error, askQuestion } = useAskApi();
  const { credits, isSubscriber, updateFromQueryResponse } = useCredits();

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

    try {
      const apiResponse = await askQuestion(query);
      if (apiResponse) {
        updateFromQueryResponse(apiResponse);

        const answerText = generateAnswerFromResults(apiResponse.items);

        const finalMessage: ChatMessage = {
          id: assistantPlaceholder.id,
          role: 'assistant',
          content: answerText,
          sources: apiResponse.items.map((item: QueryResultItem) => ({
            crd_number: parseInt(item.crdNumbers?.[0] || '0'),
            legal_name: item.name,
            city: item.city,
            state: item.state,
            executives: [],
            vc_fund_count: item.vcFunds || 0,
            vc_total_aum: item.vcAum || 0,
            activity_score: 0,
          })),
          isLoading: false,
        };

        setMessages((prev) => prev.map((msg) => (msg.id === finalMessage.id ? finalMessage : msg)));

        if (apiResponse.relaxed) {
          showRelaxationBanner(apiResponse);
        }
      }
    } catch (err: any) {
      let errorContent = '';
      if (err.code === 'PAYMENT_REQUIRED') {
        errorContent = isSubscriber
          ? 'Your subscription may have expired. Please check your billing status.'
          : "You've used all your free queries. Upgrade to Pro for unlimited access to continue exploring RIA data.";
      } else {
        errorContent = 'I encountered an error processing your request. Please try again or rephrase your question.';
      }

      const errorMessage: ChatMessage = {
        id: assistantPlaceholder.id,
        role: 'assistant',
        content: errorContent,
        sources: [],
        isLoading: false,
      };

      setMessages((prev) => prev.map((msg) => (msg.id === errorMessage.id ? errorMessage : msg)));
    }
  };

  const generateAnswerFromResults = (items: QueryResultItem[]) => {
    if (items.length === 0) {
      return "I couldn't find any RIAs matching your specific criteria. Try broadening your search terms or exploring different geographic regions.";
    }
    const topFirms = items.slice(0, 5);
    let answer = `I found ${items.length} RIA${items.length > 1 ? 's' : ''} matching your criteria. `;
    if (topFirms.length > 0) {
      answer += 'Here are the top results:\n\n';
      topFirms.forEach((firm, index) => {
        answer += `${index + 1}. **${firm.name}** (${firm.city}, ${firm.state})`;
        if (firm.aum) answer += ` - $${(firm.aum / 1000000).toFixed(1)}M AUM`;
        if (firm.vcFunds) answer += ` - ${firm.vcFunds} private funds`;
        answer += '\n';
      });
    }
    return answer;
  };

  const showRelaxationBanner = (response: QueryResponse) => {
    const message = response.relaxationLevel === 'vector-only'
      ? 'No exact geographic match found; showing semantically similar results.'
      : `No exact matches in ${response.resolvedRegion?.city || 'specified city'}; expanded to ${response.resolvedRegion?.state || 'state'} results.`;
    console.log('Search relaxation:', message);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await sendQuery(input.trim());
  };

  return (
    <div className="w-full">
      {!isSubscriber && credits <= 1 && credits > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-orange-800">
              {credits === 1 ? 'Last free query remaining' : 'Running low on credits'}
            </div>
            <button className="text-xs text-orange-600 hover:text-orange-800 font-medium">
              Upgrade to Pro
            </button>
          </div>
        </div>
      )}

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
          disabled={!isSubscriber && credits <= 0}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || (!isSubscriber && credits <= 0)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {isLoading ? 'Asking…' : 'Ask'}
        </button>
      </form>
      {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
    </div>
  );
}
