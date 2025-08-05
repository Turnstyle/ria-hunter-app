'use client';

import React, { useState } from 'react';
import SearchForm from '../components/search/SearchForm';
import SearchResults from '../components/search/SearchResults';

export default function RIAHunterPage() {
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchResult = (result: any) => {
    setSearchResult(result);
    setError(null);
    setHasSearched(true);
    setIsLoading(false);
  };

  const handleSearchError = (errorMessage: string) => {
    setError(errorMessage);
    setSearchResult(null);
    setHasSearched(true);
    setIsLoading(false);
  };

  return (
    <main className="max-w-4xl mx-auto p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">RIA Hunter</h1>
        <p className="text-lg text-gray-600 mb-6">
          Ask questions about Registered Investment Advisors using natural language
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <strong>Powered by AI</strong>
          </div>
          <p>
            Ask natural language questions like &ldquo;What is the largest RIA in California?&rdquo; 
            or &ldquo;Show me the top 5 RIAs in Texas&rdquo; and get intelligent answers with source data.
          </p>
        </div>
      </div>

      <SearchForm onResult={handleSearchResult} onError={handleSearchError} />
      
      {hasSearched && (
        <SearchResults result={searchResult} isLoading={isLoading} error={error} />
      )}
    </main>
  );
}
