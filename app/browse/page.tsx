'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionDemo } from '@/app/hooks/useSessionDemo';
import UpgradeButton from '@/app/components/subscription/UpgradeButton';
import { HeaderCredits } from '@/app/components/credits/HeaderCredits';
import { RIAHunterAPIClient } from '@/app/lib/api/client';
import { useAuth } from '@/app/contexts/AuthContext';

interface FilterOptions {
  fundType: string;
  aumRange: string;
  location: string;
  state: string;
  vcActivity: string;
  sortBy: string;
  sortOrder: string;
  page: number;
  limit: number;
}

interface RIAResult {
  id: string;
  firm_name?: string;
  name?: string;  // Support both firm_name and name
  state?: string;
  city?: string;
  aum?: number;
  employee_count?: number;
  fundTypes?: string[];
  vcActivity?: number;
  crd_number?: string;
  website?: string;
  services?: string[];
}

export default function BrowsePage() {
  const { isSubscriber, searchesRemaining, updateFromResponse } = useSessionDemo();
  const { session } = useAuth();
  const router = useRouter();
  const [apiClient] = useState(() => new RIAHunterAPIClient());
  const [filters, setFilters] = useState<FilterOptions>({
    fundType: '',
    aumRange: '',
    location: '',
    state: '',
    vcActivity: '',
    sortBy: 'aum',
    sortOrder: 'desc',
    page: 1,
    limit: 20
  });
  const [results, setResults] = useState<RIAResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fundTypeOptions = [
    { value: '', label: 'All Fund Types' },
    { value: 'vc', label: 'Venture Capital' },
    { value: 'pe', label: 'Private Equity' },
    { value: 'cre', label: 'Commercial Real Estate' },
    { value: 'hedge', label: 'Hedge Funds' },
    { value: 'other', label: 'Other Private Funds' }
  ];

  const aumRangeOptions = [
    { value: '', label: 'Any AUM' },
    { value: '0-100m', label: 'Under $100M' },
    { value: '100m-1b', label: '$100M - $1B' },
    { value: '1b-10b', label: '$1B - $10B' },
    { value: '10b+', label: 'Over $10B' }
  ];

  const stateOptions = [
    { value: '', label: 'All States' },
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
    { value: 'DC', label: 'District of Columbia' }
  ];

  const vcActivityOptions = [
    { value: '', label: 'Any VC Activity' },
    { value: 'high', label: 'High Activity' },
    { value: 'medium', label: 'Medium Activity' },
    { value: 'low', label: 'Low Activity' },
    { value: 'none', label: 'No Activity' }
  ];

  const sortOptions = [
    { value: 'aum', label: 'Assets Under Management' },
    { value: 'employee_count', label: 'Employee Count' },
    { value: 'vc_activity', label: 'VC Activity' },
    { value: 'name', label: 'Name' }
  ];

  // Helper function to parse AUM range into minimum value
  const parseAumRange = (range: string): number | undefined => {
    switch(range) {
      case '0-100m': return 0;
      case '100m-1b': return 100000000;
      case '1b-10b': return 1000000000;
      case '10b+': return 10000000000;
      default: return undefined;
    }
  };

  // Helper function to parse VC activity level
  const parseVcActivity = (activity: string): number | undefined => {
    switch(activity) {
      case 'high': return 7;
      case 'medium': return 3;
      case 'low': return 1;
      case 'none': return 0;
      default: return undefined;
    }
  };

  const handleSearch = async (page = 1) => {
    // Temporarily bypass subscription check for MVP functionality
    // if ((searchesRemaining === 0 || searchesRemaining === null) && !isSubscriber) {
    //   setError("You've used your 5 free demo searches. Create a free account to continue exploring RIA Hunter.");
    //   return;
    // }

    setLoading(true);
    setHasSearched(true);
    setError(null);
    
    try {
      // Update auth token in API client if we have a session
      if (session?.access_token) {
        apiClient.setAuthToken(session.access_token);
      }

      // Build search query based on filters
      let searchQuery = 'Find RIAs';
      const queryParts = [];
      
      if (filters.state) {
        const stateLabel = stateOptions.find(opt => opt.value === filters.state)?.label || filters.state;
        queryParts.push(`in ${stateLabel}`);
      }
      if (filters.location) {
        queryParts.push(`in ${filters.location}`);
      }
      if (filters.fundType) {
        const fundLabel = fundTypeOptions.find(opt => opt.value === filters.fundType)?.label || filters.fundType;
        queryParts.push(`with ${fundLabel} funds`);
      }
      if (filters.aumRange) {
        const aumLabel = aumRangeOptions.find(opt => opt.value === filters.aumRange)?.label || filters.aumRange;
        queryParts.push(`with AUM ${aumLabel}`);
      }
      if (filters.vcActivity) {
        const vcLabel = vcActivityOptions.find(opt => opt.value === filters.vcActivity)?.label || filters.vcActivity;
        queryParts.push(`with ${vcLabel} VC activity`);
      }
      
      if (queryParts.length > 0) {
        searchQuery += ' ' + queryParts.join(', ');
      }

      // Use the API client to make the request
      const response = await apiClient.ask({
        query: searchQuery,
        options: {
          state: filters.state || undefined,
          city: filters.location || undefined,
          fundType: filters.fundType || undefined,
          minAum: filters.aumRange ? parseAumRange(filters.aumRange) : undefined,
          minVcActivity: filters.vcActivity ? parseVcActivity(filters.vcActivity) : undefined,
          maxResults: filters.limit,
          useHybridSearch: false
        }
      });

      // Update session status from response metadata
      if (response.metadata) {
        updateFromResponse({ metadata: response.metadata });
      }

      // Extract results from response
      setResults(response.results || []);
      // totalCount might be in metadata or just use the results length
      const totalFromMetadata = response.metadata?.totalCount;
      const resultsLength = response.results?.length || 0;
      setTotalCount(totalFromMetadata || resultsLength);
      setFilters(prev => ({ ...prev, page }));
      
    } catch (error) {
      console.error('Search failed:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message === 'CREDITS_EXHAUSTED') {
          setError("You've used all your searches. Please upgrade to continue.");
        } else if (error.message === 'AUTHENTICATION_REQUIRED') {
          setError("Please sign in to continue searching.");
        } else {
          setError(error.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= Math.ceil(totalCount / filters.limit)) {
      handleSearch(newPage);
    }
  };

  // Handle filter changes
  const handleFilterChange = (name: keyof FilterOptions, value: string | number) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Calculate total pages for pagination
  const totalPages = Math.ceil(totalCount / filters.limit);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-secondary-800">
          Browse RIAs
        </h1>
        <HeaderCredits />
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-secondary-800 mb-4">Search Filters</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              State
            </label>
            <select
              value={filters.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
              className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {stateOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Fund Type
            </label>
            <select
              value={filters.fundType}
              onChange={(e) => handleFilterChange('fundType', e.target.value)}
              className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {fundTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Assets Under Management
            </label>
            <select
              value={filters.aumRange}
              onChange={(e) => handleFilterChange('aumRange', e.target.value)}
              className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {aumRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              City
            </label>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              placeholder="e.g., Boston"
              className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              VC Activity
            </label>
            <select
              value={filters.vcActivity}
              onChange={(e) => handleFilterChange('vcActivity', e.target.value)}
              className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {vcActivityOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Sort By
            </label>
            <div className="flex space-x-2">
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="flex-1 px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                className="w-24 px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => handleSearch(1)}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-white ${
              loading
                ? 'bg-secondary-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {loading ? 'Searching...' : 'Search RIAs'}
          </button>

          {/* Temporarily hidden for MVP functionality */}
          {false && !isSubscriber && searchesRemaining !== null && searchesRemaining <= 2 && (
            <div className="text-right">
              <p className="text-sm text-secondary-600 mb-2">
                You have {searchesRemaining ?? 0} free search{(searchesRemaining ?? 0) === 1 ? '' : 'es'} remaining
              </p>
              <UpgradeButton size="sm" buttonText="Get Unlimited" />
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Prompt for Non-Subscribers with no searches */}
      {false && !isSubscriber && searchesRemaining !== null && (searchesRemaining ?? 0) <= 0 && (
        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-200 rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0 md:mr-6">
              <h3 className="text-lg font-semibold text-primary-900 mb-2">
                Unlock Advanced RIA Search
              </h3>
              <p className="text-primary-700 mb-4">
                Get unlimited access to filter RIAs by fund type, AUM range, geographic location, and more.
                Perfect for finding investment opportunities and conducting market research.
              </p>
              <ul className="text-sm text-primary-600 space-y-1">
                <li>• Filter by private fund types (VC, PE, CRE, Hedge)</li>
                <li>• Search by assets under management ranges</li>
                <li>• Geographic and demographic filtering</li>
                <li>• Export results and detailed firm profiles</li>
                <li>• Unlimited searches and queries</li>
              </ul>
            </div>
            <div className="flex-shrink-0">
              <UpgradeButton 
                variant="primary" 
                size="lg" 
                buttonText="Start Pro Trial" 
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {hasSearched && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-secondary-800">
              Search Results ({totalCount} found)
            </h2>
            
            {/* Results per page selector */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-secondary-600">Per page:</label>
              <select
                value={filters.limit}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                className="px-2 py-1 text-sm border border-secondary-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                disabled={loading}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          
          {results.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {results.map((ria) => (
                  <div 
                    key={ria.id || ria.crd_number} 
                    className="border border-secondary-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => router.push(`/profile/${ria.id || ria.crd_number}`)}
                  >
                    <div className="flex flex-col h-full">
                      <div className="mb-2">
                        <h3 className="font-semibold text-secondary-800 line-clamp-2">
                          {ria.firm_name || ria.name || 'Unknown Firm'}
                        </h3>
                        {(ria.city || ria.state) && (
                          <p className="text-secondary-600 text-sm">
                            {ria.city}{ria.city && ria.state ? ', ' : ''}{ria.state}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex-grow">
                        {ria.aum !== undefined && (
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-secondary-600">AUM:</span>
                            <span className="text-sm font-medium text-secondary-800">
                              ${(ria.aum / 1000000).toFixed(1)}M
                            </span>
                          </div>
                        )}
                        {ria.employee_count !== undefined && (
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-secondary-600">Employees:</span>
                            <span className="text-sm font-medium text-secondary-800">
                              {ria.employee_count}
                            </span>
                          </div>
                        )}
                        {ria.vcActivity !== undefined && ria.vcActivity > 0 && (
                          <div className="flex justify-between">
                            <span className="text-sm text-secondary-600">VC Activity:</span>
                            <span className="text-sm font-medium text-secondary-800">
                              {ria.vcActivity > 7 ? 'High' : ria.vcActivity > 3 ? 'Medium' : 'Low'}
                            </span>
                          </div>
                        )}
                        {ria.crd_number && (
                          <div className="flex justify-between">
                            <span className="text-sm text-secondary-600">CRD:</span>
                            <span className="text-sm font-medium text-secondary-800">
                              {ria.crd_number}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {ria.fundTypes && ria.fundTypes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {ria.fundTypes.map((type) => (
                            <span 
                              key={type}
                              className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded-full"
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {ria.services && ria.services.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ria.services.slice(0, 3).map((service) => (
                            <span 
                              key={service}
                              className="px-2 py-1 bg-secondary-100 text-secondary-700 text-xs rounded"
                            >
                              {service}
                            </span>
                          ))}
                          {ria.services.length > 3 && (
                            <span className="px-2 py-1 text-secondary-500 text-xs">
                              +{ria.services.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(filters.page - 1)}
                      disabled={filters.page === 1 || loading}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-secondary-300 bg-white text-sm font-medium ${
                        filters.page === 1 || loading
                          ? 'text-secondary-300 cursor-not-allowed'
                          : 'text-secondary-500 hover:bg-secondary-50'
                      }`}
                    >
                      <span className="sr-only">Previous</span>
                      &larr;
                    </button>
                    
                    {/* Page number buttons - show up to 5 pages with ellipsis if needed */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = filters.page;
                      
                      // Logic to show pages around current page
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (filters.page <= 3) {
                        pageNum = i + 1;
                      } else if (filters.page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = filters.page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={i}
                          onClick={() => handlePageChange(pageNum)}
                          disabled={loading}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pageNum === filters.page
                              ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                              : 'bg-white border-secondary-300 text-secondary-500 hover:bg-secondary-50'
                          } ${loading ? 'cursor-not-allowed' : ''}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => handlePageChange(filters.page + 1)}
                      disabled={filters.page === totalPages || loading}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-secondary-300 bg-white text-sm font-medium ${
                        filters.page === totalPages || loading
                          ? 'text-secondary-300 cursor-not-allowed'
                          : 'text-secondary-500 hover:bg-secondary-50'
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      &rarr;
                    </button>
                  </nav>
                </div>
              )}
            </>
          ) : (
            <p className="text-secondary-600 py-8 text-center">
              No RIAs found matching your criteria. Try adjusting your filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}