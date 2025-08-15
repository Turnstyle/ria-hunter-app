'use client';

import { useState } from 'react';
import { useCredits } from '@/hooks/useCredits';
import UpgradeButton from '@/app/components/subscription/UpgradeButton';

interface FilterOptions {
  fundType: string;
  aumRange: string;
  location: string;
}

interface RIAResult {
  id: string;
  name: string;
  location: string;
  aum: number;
  fundTypes: string[];
}

export default function BrowsePage() {
  const { isSubscriber } = useCredits();
  const [filters, setFilters] = useState<FilterOptions>({
    fundType: '',
    aumRange: '',
    location: ''
  });
  const [results, setResults] = useState<RIAResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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

  const handleSearch = async () => {
    if (!isSubscriber) {
      return; // This will be handled by the UI to show upgrade prompt
    }

    setLoading(true);
    setHasSearched(true);
    
    try {
      // This would call your backend search endpoint with filters
      const response = await fetch('/api/ria-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fundType: filters.fundType,
          aumRange: filters.aumRange,
          location: filters.location
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse RIAs</h1>
          <p className="text-gray-600">
            Advanced filtering and search capabilities for Registered Investment Advisors
          </p>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Filters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Private Fund Type
              </label>
              <select
                value={filters.fundType}
                onChange={(e) => setFilters({...filters, fundType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isSubscriber}
              >
                {fundTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assets Under Management
              </label>
              <select
                value={filters.aumRange}
                onChange={(e) => setFilters({...filters, aumRange: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isSubscriber}
              >
                {aumRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={filters.location}
                onChange={(e) => setFilters({...filters, location: e.target.value})}
                placeholder="City, State"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isSubscriber}
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={handleSearch}
              disabled={loading || !isSubscriber}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                isSubscriber 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Searching...' : 'Search RIAs'}
            </button>

            {!isSubscriber && (
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-2">
                  Upgrade to Pro for advanced search capabilities
                </p>
                <UpgradeButton size="sm" buttonText="Upgrade Now" />
              </div>
            )}
          </div>
        </div>

        {/* Upgrade Prompt for Non-Subscribers */}
        {!isSubscriber && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Unlock Advanced RIA Search
                </h3>
                <p className="text-blue-700 mb-4">
                  Get unlimited access to filter RIAs by fund type, AUM range, geographic location, and more. 
                  Perfect for finding investment opportunities and conducting market research.
                </p>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• Filter by private fund types (VC, PE, CRE, Hedge)</li>
                  <li>• Search by assets under management ranges</li>
                  <li>• Geographic and demographic filtering</li>
                  <li>• Export results and detailed firm profiles</li>
                  <li>• Unlimited searches and queries</li>
                </ul>
              </div>
              <div className="ml-6">
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
        {hasSearched && isSubscriber && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Search Results ({results.length} found)
            </h2>
            
            {results.length > 0 ? (
              <div className="space-y-4">
                {results.map((ria) => (
                  <div key={ria.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{ria.name}</h3>
                        <p className="text-gray-600">{ria.location}</p>
                        <p className="text-sm text-gray-500">
                          AUM: ${(ria.aum / 1000000).toFixed(1)}M
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ria.fundTypes.map((type) => (
                          <span 
                            key={type}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No RIAs found matching your criteria. Try adjusting your filters.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}