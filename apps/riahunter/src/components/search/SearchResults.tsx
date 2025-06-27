'use client';

import React from 'react';
import Link from 'next/link';

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

interface SearchResultsProps {
  results: RIAResult[];
  isLoading?: boolean;
  error?: string | null;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, isLoading, error }) => {
  const formatAUM = (aum: number | null): string => {
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

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatAddress = (ria: RIAResult): string => {
    const parts = [
      ria.main_addr_city,
      ria.main_addr_state,
      ria.main_addr_zip
    ].filter(Boolean);
    return parts.join(', ') || 'Address not available';
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

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your search criteria or location.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Search Results ({results.length} found)
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Investment advisers matching your criteria
        </p>
      </div>
      <ul className="divide-y divide-gray-200">
        {results.map((ria) => (
          <li key={ria.cik}>
            <Link href={`/profile/${ria.cik}`} className="block hover:bg-gray-50">
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-medium text-indigo-600 truncate">
                      {ria.legal_name}
                    </h4>
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{formatAddress(ria)}</span>
                      {ria.is_st_louis_msa && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          St. Louis MSA
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <span className="mr-4">CRD: {ria.crd_number || 'N/A'}</span>
                      <span className="mr-4">CIK: {ria.cik}</span>
                      {ria.phone_number && (
                        <span>{ria.phone_number}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {ria.latest_filing && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-900">
                          AUM: {formatAUM(ria.latest_filing.total_aum)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Filed: {formatDate(ria.latest_filing.filing_date)}
                        </div>
                        {ria.latest_filing.manages_private_funds_flag && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Private Funds
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchResults;
