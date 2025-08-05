'use client';

import React, { useState } from 'react';
import SearchForm from '../components/search/SearchForm';
import SearchResults from '../components/search/SearchResults';

export default function RIAHunterPage() {
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<string>('');

  const handleSearchResult = (result: any, query: string) => {
    setSearchResult(result);
    setCurrentQuery(query);
    setError(null);
    setHasSearched(true);
    setIsLoading(false);
  };

  const handleSearchError = (errorMessage: string, query: string) => {
    setError(errorMessage);
    setCurrentQuery(query);
    setSearchResult(null);
    setHasSearched(true);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            Powered by AI
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Search RIAs with <span className="text-blue-600">Natural Language</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Ask questions about Registered Investment Advisors and get intelligent answers 
            with comprehensive source data and analysis.
          </p>
        </div>

        {/* Chat Conversation Area */}
        {hasSearched && (
          <div className="mb-8">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* User Message */}
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-6 py-4 max-w-2xl">
                  <p className="font-medium">{currentQuery}</p>
                </div>
              </div>
              
              {/* AI Response */}
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-md px-6 py-4 max-w-3xl shadow-lg border border-gray-100">
                  <SearchResults result={searchResult} isLoading={isLoading} error={error} />
                </div>
              </div>
            </div>
          </div>
        )}

        <SearchForm onResult={handleSearchResult} onError={handleSearchError} />
      </div>
    </div>
  );
}
