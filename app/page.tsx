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
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center bg-blue-100 text-blue-800 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
            A JTP Vibe Coded MVP
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
            Search for Registered Investment Advisor (RIA) information with <span className="text-blue-600">Natural Language</span>
          </h1>


        </div>

        {/* Chat Conversation Area */}
        {hasSearched && (
          <div className="mb-6 sm:mb-8">
            <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
              {/* User Message */}
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-4 sm:px-6 py-3 sm:py-4 max-w-[85%] sm:max-w-2xl">
                  <p className="text-sm sm:text-base font-medium break-words">{currentQuery}</p>
                </div>
              </div>
              
              {/* AI Response */}
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-md px-4 sm:px-6 py-4 max-w-[95%] sm:max-w-3xl shadow-lg border border-gray-100">
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