// app/search/page.tsx
// Search page with proper city/state separation and natural language answers

'use client';

import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useSessionDemo } from '@/app/hooks/useSessionDemo';
import { apiClient, type AskResponse } from '@/app/lib/api/client';
import { Search, MapPin, DollarSign, Users, Loader2, HelpCircle, Download } from 'lucide-react';

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
  const { searchesRemaining, isSubscriber, updateFromResponse, canSearch } = useSessionDemo();

  // Handle search submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }
    
    // Check if user can search
    if (!canSearch) {
      setError("You've used your 5 free demo searches. Create a free account to continue exploring RIA Hunter.");
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
      
      // Build search request for new hybrid-comprehensive endpoint
      const searchRequest = {
        query: query.trim(),
        filters: {
          // CRITICAL: Send city and state as separate fields
          ...(city && { city: city.trim() }),
          ...(state && { state }),
          ...(minAum && { minAum: parseFloat(minAum) * 1000000 }), // Convert millions to dollars
        },
        limit: 50, // Increased from 20 to get more comprehensive results
        semanticWeight: 0.7, // Default semantic weight
        databaseWeight: 0.3, // Default database weight
      };
      
      // Make API call using new hybrid comprehensive search
      const hybridResult = await apiClient.askHybridComprehensive(searchRequest);
      
      // Transform hybrid response to match expected AskResponse format
      const result: AskResponse = {
        // The new API doesn't return a natural language answer, so we'll create a summary
        answer: hybridResult.summary ? 
          `Found ${hybridResult.summary.total_database_results} matching RIAs` +
          (hybridResult.summary.total_with_semantic_match ? 
            ` (${hybridResult.summary.total_with_semantic_match} with semantic relevance)` : '') +
          '. Results are ranked by combined relevance score.' : 
          undefined,
        
        // Transform results to match expected format
        results: hybridResult.results?.map(r => ({
          id: r.id,
          firm_name: r.firm_name,
          crd_number: r.crd_number,
          city: r.city,
          state: r.state,
          aum: r.aum,
          similarity: r.relevance_scores?.combined_score,
          description: r.description,
          website: r.website,
          phone: r.phone,
          services: r.services,
          executives: r.executives,
          private_funds: r.private_funds,
        })),
        
        // No sources in hybrid response
        sources: [],
        
        // Transform metadata
        metadata: {
          searchesRemaining: hybridResult.metadata?.searchesRemaining,
          searchesUsed: hybridResult.metadata?.searchesUsed,
          isSubscriber: hybridResult.metadata?.isSubscriber,
          remaining: hybridResult.metadata?.remaining,
          queryType: 'hybrid-comprehensive',
          searchStrategy: 'hybrid' as any,
          confidence: hybridResult.results?.[0]?.relevance_scores?.combined_score,
          tokensUsed: hybridResult.metadata?.tokensUsed,
          totalCount: hybridResult.summary?.total_database_results,
        },
        
        error: hybridResult.error,
        success: hybridResult.success,
      };
      
      // Update session status
      updateFromResponse(result);
      
      // Store response
      setResponse(result);
      
      // Don't set error for empty results, let the UI handle it gracefully
    } catch (error) {
      console.error('Search failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('5 free demo searches') || errorMessage === 'DEMO_LIMIT_REACHED') {
        setError("You've used your 5 free demo searches. Create a free account to continue exploring RIA Hunter.");
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
      <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-8">
        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 mb-4">
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
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>
          
          {/* Options */}
          <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={useHybridSearch}
                  onChange={(e) => setUseHybridSearch(e.target.checked)}
                  className="mr-1"
                  disabled={isLoading}
                />
                <span className="text-sm">AI-Enhanced Search</span>
              </label>
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                  Uses AI to understand query intent and find relevant firms
                </div>
              </div>
            </div>
            
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
          <button
            type="submit"
            disabled={isLoading || !query.trim() || !canSearch}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <div className="flex flex-col">
                  <span>AI Processing...</span>
                  <span className="text-xs opacity-75">This may take a few seconds</span>
                </div>
              </div>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                {useHybridSearch ? 'AI Search' : 'Search'}
              </>
            )}
          </button>
          
          {/* Searches Display */}
          {!isSubscriber && (
            <div className="text-center sm:text-left">
              <span className="text-sm text-gray-600">
                {searchesRemaining === null ? '—' : searchesRemaining > 0 ? `${searchesRemaining} free searches remaining` : 'Demo limit reached'}
              </span>
            </div>
          )}
        </div>
      </form>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          {(error.includes('demo') || error.includes('searches')) && (
            <a href="/subscription" className="underline font-semibold">
              Upgrade your plan
            </a>
          )}
        </div>
      )}
      
      {/* AI Search Status Indicator */}
      {response?.metadata?.searchStrategy && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-900">
              {response.metadata.searchStrategy === 'ai_semantic' ? 'AI-Powered Search Results' : 'Database Search Results'}
            </span>
            {response.metadata.confidence && (
              <span className="text-xs text-blue-700">
                • Avg Confidence: {(response.metadata.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
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
          {response.results && response.results.length > 0 ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Results ({response.results.length})
                </h2>
                <ExportResults results={response.results} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {response.results.map((result) => (
                  <div
                    key={result.id}
                    className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
                  >
                    {/* Header with AI confidence indicator */}
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">
                        {result.firm_name}
                      </h3>
                      {result.similarity && result.similarity > 0 && (
                        <div className="flex items-center space-x-1 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <span>AI: {(result.similarity * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                    
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
                      
                      {result.similarity !== undefined && result.similarity > 0 && (
                        <div className="flex items-center text-xs text-blue-600 font-medium">
                          <div className="w-1 h-1 bg-blue-600 rounded-full mr-1"></div>
                          Semantic Match: {(result.similarity * 100).toFixed(0)}%
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
          ) : !response.answer && (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <h3 className="text-lg font-medium">No results found</h3>
                <p className="text-sm mt-2">
                  Try adjusting your search criteria or using different keywords.
                </p>
              </div>
              
              {/* AI-powered suggestions */}
              <div className="bg-blue-50 rounded-lg p-4 text-left max-w-md mx-auto">
                <h4 className="font-medium text-blue-900 mb-2">Search suggestions:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Try broader location terms (e.g., "Missouri" instead of "Saint Louis")</li>
                  <li>• Use alternative terms (e.g., "wealth management" vs "investment advisory")</li>
                  <li>• Check spelling of location names</li>
                  <li>• Remove specific filters to see more results</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export Results Component
function ExportResults({ results }: { results: any[] }) {
  const exportToCSV = () => {
    const headers = ['Firm Name', 'Location', 'AUM', 'AI Confidence', 'CRD Number'];
    const csvData = results.map(r => [
      r.firm_name || '',
      `${r.city || ''}, ${r.state || ''}`.replace(/^, |, $/g, ''),
      r.aum ? `$${(r.aum / 1000000).toFixed(0)}M` : '',
      r.similarity ? `${(r.similarity * 100).toFixed(0)}%` : '',
      r.crd_number || ''
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ria-search-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  if (!results || results.length === 0) {
    return null;
  }
  
  return (
    <button
      onClick={exportToCSV}
      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
    >
      <Download className="w-4 h-4" />
      <span>Export CSV</span>
    </button>
  );
}
