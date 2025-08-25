// app/search/page.tsx
// Search page with proper city/state separation and natural language answers

'use client';

import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useCredits } from '@/app/hooks/useCredits';
import { apiClient, type AskResponse } from '@/app/lib/api/client';
import { Search, MapPin, DollarSign, Users, Loader2 } from 'lucide-react';

// State abbreviations for dropdown
const STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' }
];

export default function SearchPage() {
  // Form state
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [minAum, setMinAum] = useState('');
  const [useHybridSearch, setUseHybridSearch] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(false);
  
  // Results state
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { session } = useAuth();
  const { credits, isSubscriber, updateFromResponse } = useCredits();

  // Handle search submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }
    
    // Check credits
    if (!isSubscriber && (credits === 0 || credits === null)) {
      setError('You have no credits remaining. Please upgrade your plan.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      // Set auth token
      if (session?.access_token) {
        apiClient.setAuthToken(session.access_token);
      }
      
      // Build search request
      const searchRequest = {
        query: query.trim(),
        options: {
          // CRITICAL: Send city and state as separate fields
          ...(city && { city: city.trim() }),
          ...(state && { state }),
          ...(minAum && { minAum: parseFloat(minAum) * 1000000 }), // Convert millions to dollars
          includeDetails,
          maxResults: 20,
          useHybridSearch,
        },
      };
      
      // Make API call
      const result = await apiClient.ask(searchRequest);
      
      // Update credits
      updateFromResponse(result);
      
      // Store response
      setResponse(result);
      
      // Check if no results
      if (!result.answer && (!result.results || result.results.length === 0)) {
        setError('No results found. Try adjusting your search criteria.');
      }
    } catch (error) {
      console.error('Search failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage === 'CREDITS_EXHAUSTED') {
        setError('You have used all your credits. Please upgrade to continue.');
      } else if (errorMessage === 'AUTHENTICATION_REQUIRED') {
        setError('Please sign in to search.');
      } else if (errorMessage === 'RATE_LIMITED') {
        setError('Too many searches. Please wait a moment and try again.');
      } else {
        setError('Search failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format AUM for display
  const formatAUM = (aum: number): string => {
    if (aum >= 1e9) return `$${(aum / 1e9).toFixed(2)}B`;
    if (aum >= 1e6) return `$${(aum / 1e6).toFixed(2)}M`;
    if (aum >= 1e3) return `$${(aum / 1e3).toFixed(2)}K`;
    return `$${aum.toFixed(2)}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Search RIA Database</h1>
      
      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Query Input */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Query
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., RIAs with venture capital activity"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
          
          {/* City Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City (Optional)
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., Saint Louis"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
          
          {/* State Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State (Optional)
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="">All States</option>
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Minimum AUM */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum AUM (Millions)
            </label>
            <input
              type="number"
              value={minAum}
              onChange={(e) => setMinAum(e.target.value)}
              placeholder="e.g., 100"
              min="0"
              step="10"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
          
          {/* Options */}
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useHybridSearch}
                onChange={(e) => setUseHybridSearch(e.target.checked)}
                className="mr-2"
                disabled={isLoading}
              />
              <span className="text-sm">Hybrid Search</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeDetails}
                onChange={(e) => setIncludeDetails(e.target.checked)}
                className="mr-2"
                disabled={isLoading}
              />
              <span className="text-sm">Include Details</span>
            </label>
          </div>
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-between items-center">
          <button
            type="submit"
            disabled={isLoading || !query.trim() || (!isSubscriber && (credits === 0 || credits === null))}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Search
              </>
            )}
          </button>
          
          {/* Credits Display */}
          {!isSubscriber && (
            <span className="text-sm text-gray-600">
              {credits === null ? '— credits' : credits > 0 ? `${credits} credits remaining` : 'No credits remaining'}
            </span>
          )}
        </div>
      </form>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          {error.includes('credits') && (
            <a href="/subscription" className="underline font-semibold">
              Upgrade your plan
            </a>
          )}
        </div>
      )}
      
      {/* Results Display */}
      {response && (
        <div>
          {/* Natural Language Answer */}
          {response.answer && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-3">Answer</h2>
              <div className="prose max-w-none">
                {response.answer.split('\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-2">
                    {paragraph}
                  </p>
                ))}
              </div>
              
              {/* Sources */}
              {response.sources && response.sources.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-semibold mb-2">Sources:</h3>
                  <ul className="text-sm space-y-1">
                    {response.sources.map((source, idx) => (
                      <li key={idx}>
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {source.title || source.crd || `Source ${idx + 1}`}
                          </a>
                        ) : (
                          <span>{source.title || source.crd || `Source ${idx + 1}`}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* Structured Results */}
          {response.results && response.results.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Results ({response.results.length})
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {response.results.map((result) => (
                  <div
                    key={result.id}
                    className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
                  >
                    <h3 className="font-semibold text-lg mb-2">
                      {result.firm_name}
                    </h3>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      {result.city && result.state && (
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {result.city}, {result.state}
                        </div>
                      )}
                      
                      {result.aum && (
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1" />
                          AUM: {formatAUM(result.aum)}
                        </div>
                      )}
                      
                      {result.similarity !== undefined && (
                        <div className="text-xs text-gray-500">
                          Match: {(result.similarity * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    
                    {/* View Profile Link */}
                    <a
                      href={`/profile/${result.crd_number}`}
                      className="mt-3 inline-block text-blue-600 hover:underline text-sm"
                    >
                      View Profile →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
