'use client';

import { useState } from 'react';
import { apiClient } from '@/app/lib/api/client';

export default function TestStLouisVC() {
  const [searchResults, setSearchResults] = useState<any>(null);
  const [browseResults, setBrowseResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearchTest = async () => {
    setIsLoading(true);
    setError(null);
    setSearchResults(null);
    
    try {
      console.log('Running St. Louis VC search test using /api/ask...');
      
      const response = await apiClient.ask({
        query: 'RIAs with venture capital or private equity activity',
        options: {
          state: 'MO',
          city: 'St. Louis',
          maxResults: 400
        }
      });
      
      console.log('Search response:', response);
      setSearchResults(response);
      
      if (response.results && response.results.length > 0) {
        console.log(`✅ Found ${response.results.length} results`);
        
        // Check for known RIAs
        const knownRIAs = ['EDWARD JONES', 'WELLS FARGO', 'STIFEL', 'MONETA'];
        const foundRIAs = knownRIAs.filter(name => 
          response.results.some((r: any) => 
            r.firm_name?.toUpperCase().includes(name) || 
            r.name?.toUpperCase().includes(name)
          )
        );
        
        console.log('Found known RIAs:', foundRIAs);
      }
    } catch (err) {
      console.error('Search test failed:', err);
      setError(err instanceof Error ? err.message : 'Search test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const runBrowseTest = async () => {
    setIsLoading(true);
    setError(null);
    setBrowseResults(null);
    
    try {
      console.log('Running St. Louis VC browse test using /api/ask/browse...');
      
      const response = await apiClient.browse({
        state: 'MO',
        city: 'St. Louis',
        hasVcActivity: true,
        limit: 100,
        offset: 0,
        sortBy: 'aum',
        sortOrder: 'desc'
      });
      
      console.log('Browse response:', response);
      setBrowseResults(response);
      
      if (response.results && response.results.length > 0) {
        console.log(`✅ Found ${response.results.length} results (page 1 of ${Math.ceil(response.pagination.total / response.pagination.limit)})`);
        console.log(`Total St. Louis RIAs with VC activity: ${response.pagination.total}`);
        
        // Check for known RIAs
        const knownRIAs = ['EDWARD JONES', 'WELLS FARGO', 'STIFEL', 'MONETA'];
        const foundRIAs = knownRIAs.filter(name => 
          response.results.some((r: any) => 
            r.legal_name?.toUpperCase().includes(name)
          )
        );
        
        console.log('Found known RIAs in first page:', foundRIAs);
      }
    } catch (err) {
      console.error('Browse test failed:', err);
      setError(err instanceof Error ? err.message : 'Browse test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formatAUM = (aum: number): string => {
    if (aum >= 1e9) return `$${(aum / 1e9).toFixed(2)}B`;
    if (aum >= 1e6) return `$${(aum / 1e6).toFixed(2)}M`;
    if (aum >= 1e3) return `$${(aum / 1e3).toFixed(2)}K`;
    return `$${aum.toFixed(2)}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">St. Louis VC Search Test</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-yellow-900 mb-2">Test Expectation</h2>
        <p className="text-yellow-800">
          The backend has been fixed and should now return <strong>375+ RIAs</strong> with VC/PE activity 
          in St. Louis, not just 1. This test verifies the fix is working.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <button
          onClick={runSearchTest}
          disabled={isLoading}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mr-4"
        >
          {isLoading ? 'Testing...' : 'Test Search API (/api/ask)'}
        </button>
        
        <button
          onClick={runBrowseTest}
          disabled={isLoading}
          className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Testing...' : 'Test Browse API (/api/ask/browse)'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>Error: {error}</p>
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Search Results: {searchResults.results?.length || 0} RIAs
            {searchResults.results?.length >= 375 ? ' ✅' : ' ❌'}
          </h2>
          
          {searchResults.results?.length > 0 ? (
            <>
              <div className={`mb-4 p-3 rounded ${searchResults.results.length >= 375 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {searchResults.results.length >= 375 
                  ? '✅ SUCCESS: Found 375+ RIAs as expected!' 
                  : `❌ FAILURE: Only found ${searchResults.results.length} RIAs, expected 375+`}
              </div>
              
              <h3 className="font-semibold mb-2">Top 10 by AUM:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.results.slice(0, 10).map((ria: any, idx: number) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="font-semibold">{ria.firm_name || ria.name}</div>
                    <div className="text-sm text-gray-600">
                      {ria.city}, {ria.state} | AUM: {ria.aum ? formatAUM(ria.aum) : 'N/A'}
                    </div>
                    {ria.crd_number && (
                      <div className="text-xs text-gray-500">CRD: {ria.crd_number}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-600">No results found</p>
          )}
          
          {searchResults.answer && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-semibold mb-2">Natural Language Response:</h3>
              <p className="text-gray-700">{searchResults.answer}</p>
            </div>
          )}
        </div>
      )}

      {/* Browse Results */}
      {browseResults && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">
            Browse Results: {browseResults.pagination?.total || 0} Total RIAs
            {browseResults.pagination?.total >= 375 ? ' ✅' : ' ❌'}
          </h2>
          
          {browseResults.results?.length > 0 ? (
            <>
              <div className={`mb-4 p-3 rounded ${browseResults.pagination?.total >= 375 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {browseResults.pagination?.total >= 375 
                  ? `✅ SUCCESS: Found ${browseResults.pagination.total} total RIAs with VC activity!` 
                  : `❌ FAILURE: Only found ${browseResults.pagination?.total || 0} RIAs, expected 375+`}
              </div>
              
              <div className="mb-4 text-sm text-gray-600">
                Showing page 1 of {Math.ceil(browseResults.pagination.total / browseResults.pagination.limit)} 
                ({browseResults.results.length} results per page)
              </div>
              
              <h3 className="font-semibold mb-2">Top 10 by AUM:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {browseResults.results.slice(0, 10).map((ria: any, idx: number) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="font-semibold">{ria.legal_name}</div>
                    <div className="text-sm text-gray-600">
                      {ria.city}, {ria.state} | AUM: {ria.aum ? formatAUM(ria.aum) : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      CRD: {ria.crd_number} | Funds: {ria.private_fund_count || 0}
                      {ria.has_vc_activity && ' | VC/PE ✓'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-600">No results found</p>
          )}
        </div>
      )}
    </div>
  );
}
