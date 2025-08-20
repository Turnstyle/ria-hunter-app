'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCredits } from '../hooks/useCredits';
import { HeaderCredits } from '../components/credits/HeaderCredits';

// Search types
interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata?: {
    riaId: string;
    riaName: string;
    state?: string;
    city?: string;
    aum?: number;
  };
}

interface AnswerResult {
  answer: string;
  citations: string[];
}

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [useHybridSearch, setUseHybridSearch] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const { credits, decrementCredits, isLoadingCredits } = useCredits();
  const router = useRouter();

  // Handle search submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }
    
    if (credits <= 0) {
      setError('You have no credits remaining. Please upgrade your plan.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    setAnswerResult(null);
    setStreamingAnswer('');
    
    try {
      // Process query - convert to lowercase and trim whitespace
      const processedQuery = query.toLowerCase().trim();
      
      // Call search API
      const searchResponse = await fetch('/api/ria/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: processedQuery,
          hybrid: useHybridSearch,
          efSearch: 64, // Default parameter for HNSW search
        }),
      });
      
      if (!searchResponse.ok) {
        throw new Error('Search failed. Please try again.');
      }
      
      const searchData = await searchResponse.json();
      setSearchResults(searchData.results || []);
      
      // Decrement credits after successful search
      decrementCredits(1);
      
      // If we got search results, now request an answer
      if (searchData.results && searchData.results.length > 0) {
        // Option 1: Streaming response
        if (window.ReadableStream && 'getReader' in ReadableStream.prototype) {
          setIsStreaming(true);
          const answerResponse = await fetch('/api/ria/answer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: processedQuery,
              searchResults: searchData.results.slice(0, 10), // Use top 10 results as context
            }),
          });
          
          if (!answerResponse.ok) {
            throw new Error('Failed to generate answer. Please try again.');
          }
          
          const reader = answerResponse.body!.getReader();
          const decoder = new TextDecoder();
          let answer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            answer += chunk;
            setStreamingAnswer(answer);
          }
          
          // When stream is complete, parse the citations from the full response
          try {
            const finalAnswer = JSON.parse(answer);
            setAnswerResult({
              answer: finalAnswer.answer,
              citations: finalAnswer.citations || [],
            });
          } catch (e) {
            // If not JSON, just use the raw text
            setAnswerResult({
              answer,
              citations: [],
            });
          }
          setIsStreaming(false);
        } 
        // Option 2: Non-streaming response
        else {
          const answerResponse = await fetch('/api/ria/answer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: processedQuery,
              searchResults: searchData.results.slice(0, 10),
            }),
          });
          
          if (!answerResponse.ok) {
            throw new Error('Failed to generate answer. Please try again.');
          }
          
          const answerData = await answerResponse.json();
          setAnswerResult({
            answer: answerData.answer,
            citations: answerData.citations || [],
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-secondary-800">
          RIA Hunter Search
        </h1>
        <HeaderCredits />
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="query" className="block text-sm font-medium text-secondary-700 mb-1">
              Ask a question about RIAs
            </label>
            <input
              type="text"
              id="query"
              placeholder="e.g., What are the 10 most active RIAs in Missouri with VC activity and who are their executives?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-4 py-2 border border-secondary-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="hybrid"
              checked={useHybridSearch}
              onChange={(e) => setUseHybridSearch(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
            />
            <label htmlFor="hybrid" className="ml-2 block text-sm text-secondary-700">
              Use hybrid search (better for queries with specific names or phrases)
            </label>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={isLoading || isLoadingCredits || !query.trim() || credits <= 0}
              className={`px-4 py-2 rounded-md text-white ${
                isLoading || isLoadingCredits || !query.trim() || credits <= 0
                  ? 'bg-secondary-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
            
            {credits <= 3 && (
              <p className="mt-2 text-sm text-secondary-600">
                You have {credits} credit{credits === 1 ? '' : 's'} remaining.
                <button
                  type="button"
                  onClick={() => router.push('/subscription')}
                  className="ml-2 text-primary-600 hover:text-primary-800 underline"
                >
                  Upgrade
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      )}
      
      {!isLoading && (streamingAnswer || answerResult) && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-secondary-800 mb-4">Answer</h2>
          <div className="prose max-w-none">
            {isStreaming ? (
              <p>{streamingAnswer || 'Generating answer...'}</p>
            ) : (
              <p>{answerResult?.answer}</p>
            )}
          </div>
          
          {answerResult?.citations && answerResult.citations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-secondary-700 mb-2">Sources</h3>
              <ul className="list-disc pl-5 space-y-1">
                {answerResult.citations.map((citation, index) => (
                  <li key={index} className="text-sm text-secondary-600">
                    {citation}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {!isLoading && searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-secondary-800 mb-4">
            Search Results ({searchResults.length})
          </h2>
          <div className="space-y-6">
            {searchResults.map((result) => (
              <div key={result.id} className="border-b border-secondary-200 pb-4 last:border-0">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium text-secondary-700">
                    {result.metadata?.riaName || 'RIA Profile'}
                  </h3>
                  <span className="text-xs text-secondary-500 bg-secondary-100 px-2 py-1 rounded-full">
                    Score: {Math.round(result.similarity * 100)}%
                  </span>
                </div>
                
                <div className="mt-2 text-sm text-secondary-600">
                  {result.metadata?.city && result.metadata?.state && (
                    <span className="mr-3">
                      Location: {result.metadata.city}, {result.metadata.state}
                    </span>
                  )}
                  
                  {result.metadata?.aum && (
                    <span>
                      AUM: ${(result.metadata.aum / 1000000).toFixed(1)}M
                    </span>
                  )}
                </div>
                
                <p className="mt-2 text-secondary-800 text-sm line-clamp-3">
                  {result.content}
                </p>
                
                <button
                  onClick={() => router.push(`/profile/${result.metadata?.riaId}`)}
                  className="mt-2 text-sm text-primary-600 hover:text-primary-800"
                >
                  View Profile →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
