'use client';

import React, { useState, FormEvent } from 'react';

interface SearchFormData {
  location: string;
  privateInvestment: boolean;
}

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

interface SearchFormProps {
  onResults?: (results: RIAResult[]) => void;
  onError?: (error: string) => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ onResults, onError }) => {
  const [location, setLocation] = useState<string>('');
  const [privateInvestment, setPrivateInvestment] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    const formData: SearchFormData = {
      location,
      privateInvestment,
    };

    console.log('Search criteria:', formData);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (location.trim()) {
        params.append('location', location.trim());
      }
      params.append('privateInvestment', privateInvestment.toString());

      const response = await fetch(`/api/ria-hunter/search?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      console.log('Search results:', data);

      if (onResults) {
        onResults(data.data || []);
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg shadow-md bg-white">
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700">
          Location (e.g., ZIP code, City, State)
        </label>
        <input
          type="text"
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="Enter location (e.g., St. Louis, 63101)"
          disabled={isLoading}
        />
      </div>

      <div className="flex items-center">
        <input
          id="privateInvestment"
          type="checkbox"
          checked={privateInvestment}
          onChange={(e) => setPrivateInvestment(e.target.checked)}
          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          disabled={isLoading}
        />
        <label htmlFor="privateInvestment" className="ml-2 block text-sm text-gray-700">
          Interested in Private Investments
        </label>
      </div>

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Searching...
            </>
          ) : (
            'Search RIAs'
          )}
        </button>
      </div>
    </form>
  );
};

export default SearchForm;
