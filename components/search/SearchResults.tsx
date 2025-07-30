'use client';

import React from 'react';

interface SearchResultsProps {
  result: {
    answer: string;
    sources: Array<{
      firm_name: string;
      crd_number: string;
      city: string;
      state: string;
      aum?: number | null;
    }>;
  } | null;
  isLoading?: boolean;
  error?: string | null;
}

const SearchResults: React.FC<SearchResultsProps> = ({ result, isLoading, error }) => {
  const formatAUM = (aum: number | null | undefined): string => {
    if (!aum) return 'N/A';

    if (aum >= 1_000_000_000) {
      return `$${(aum / 1_000_000_000).toFixed(1)}B`;
    } else if (aum >= 1_000_000) {
      return `$${(aum / 1_000_000).toFixed(1)}M`;
    } else if (aum >= 1_000) {
      return `$${(aum / 1_000).toFixed(1)}K`;
    }
    return `$${aum.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Search Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* AI Answer Card */}
      <div className="border p-4 rounded shadow bg-white">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Answer</h3>
        <p className="text-gray-700">{result.answer}</p>
      </div>

      {/* Sources */}
      {result.sources && result.sources.length > 0 && (
        <div className="border rounded shadow bg-white">
          <div className="p-4 border-b">
            <details open>
              <summary className="cursor-pointer text-sm text-gray-600 font-medium">
                Sources ({result.sources.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {result.sources.map((source, index) => (
                  <li key={index} className="text-sm border-l-4 border-blue-500 pl-3 py-1">
                    <div className="font-medium text-gray-900">{source.firm_name}</div>
                    <div className="text-gray-600">
                      CRD: {source.crd_number} • {source.city}, {source.state}
                      {source.aum && ` • AUM: ${formatAUM(source.aum)}`}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
