'use client';

import React, { useState, FormEvent } from 'react';

interface SearchFormProps {
  onResult?: (result: any) => void;
  onError?: (error: string) => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ onResult, onError }) => {
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [aiProvider, setAiProvider] = useState<'openai' | 'vertex'>('openai');
  const [limit, setLimit] = useState<number>(5);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Example queries that work well with the backend
  const exampleQueries = [
    "What is the largest RIA in California?",
    "Show me the top 5 RIAs in Texas",
    "How many RIAs are in New York?",
    "Tell me about Fisher Investments",
    "Which RIAs specialize in sustainable investing?",
    "What is the smallest RIA in Delaware?"
  ];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!query.trim()) return;
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: query.trim(),
          limit,
          aiProvider
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      
      if (onResult) {
        onResult(data);
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  return (
    <div className="space-y-4">
      {/* Example Queries */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Try these example queries:</h3>
        <div className="flex flex-wrap gap-2">
          {exampleQueries.map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleExampleClick(example)}
              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-blue-300 text-gray-700"
              disabled={isLoading}
            >
&ldquo;{example}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Main Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg shadow-md bg-white">
        <div>
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
            Ask about RIAs
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="What is the largest RIA in California?"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Advanced Options */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-700 focus:outline-none"
          >
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </button>
          
          {showAdvanced && (
            <div className="mt-3 p-3 bg-gray-50 rounded border space-y-3">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="aiProvider" className="block text-xs font-medium text-gray-700 mb-1">
                    AI Provider
                  </label>
                  <select
                    id="aiProvider"
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as 'openai' | 'vertex')}
                    className="w-full text-sm border p-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value="openai">OpenAI (GPT-4 Turbo)</option>
                    <option value="vertex">Google Vertex AI</option>
                  </select>
                </div>
                
                <div className="flex-1">
                  <label htmlFor="limit" className="block text-xs font-medium text-gray-700 mb-1">
                    Max Results
                  </label>
                  <select
                    id="limit"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value))}
                    className="w-full text-sm border p-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value={3}>3 results</option>
                    <option value={5}>5 results</option>
                    <option value={10}>10 results</option>
                    <option value={20}>20 results</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default SearchForm;
