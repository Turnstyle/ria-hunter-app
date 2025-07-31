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
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">RIA Hunter</h1>
      <SearchForm onResult={handleSearchResult} onError={handleSearchError} />
      {hasSearched && (
        <SearchResults result={searchResult} isLoading={isLoading} error={error} />
      )}
    </main>
  );
}
