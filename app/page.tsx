'use client';

import React, { useState } from 'react';
// import { UserProvider } from '@auth0/nextjs-auth0';
import SearchForm from '../components/search/SearchForm';
import SearchResults from '../components/search/SearchResults';

interface RIAResult {
  cik: number;
  crd_number: number | null;
  legal_name: string;
  main_addr_street1: string | null;
  main_addr_street2: string | null;
  main_addr_city: string | null;
  main_addr_state: string | null;
  main_addr_zip: string | null;
  main_addr_country: string | null;
  phone_number: string | null;
  fax_number: string | null;
  website: string | null;
  is_st_louis_msa: boolean | null;
  latest_filing: {
    filing_date: string;
    total_aum: number | null;
    manages_private_funds_flag: boolean | null;
  } | null;
}

export default function RIAHunterPage() {
  const [searchResults, setSearchResults] = useState<RIAResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchResults = (results: RIAResult[]) => {
    setSearchResults(results);
    setError(null);
    setHasSearched(true);
  };

  const handleSearchError = (errorMessage: string) => {
    setError(errorMessage);
    setSearchResults([]);
    setHasSearched(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <h1 className="text-3xl font-bold text-gray-900">RIA Hunter</h1>
                <p className="ml-4 text-sm text-gray-500">
                  Find Registered Investment Advisers
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Powered by SEC Form ADV data
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Search Form */}
            <div className="lg:col-span-4">
              <div className="sticky top-8">
                <SearchForm
                  onResults={handleSearchResults}
                  onError={handleSearchError}
                />

                {/* Search Tips */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">Search Tips</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Use specific cities like &ldquo;St. Louis&rdquo; or ZIP codes like &ldquo;63101&rdquo;</li>
                    <li>• Check &ldquo;Private Investments&rdquo; to find RIAs managing private funds</li>
                    <li>• Leave location empty to search all advisers</li>
                    <li>• Results include the most recent SEC filings</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Search Results */}
            <div className="lg:col-span-8">
              {!hasSearched ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Ready to search</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Enter your search criteria to find investment advisers.
                  </p>
                </div>
              ) : (
                <SearchResults
                  results={searchResults}
                  isLoading={isLoading}
                  error={error}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Data sourced from SEC Form ADV filings. Updated regularly.
              </div>
              <div className="text-sm text-gray-500">
                Built with Next.js & Supabase
              </div>
            </div>
          </div>
        </footer>
    </div>
  );
}
