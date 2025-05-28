'use client';

import React, { useState, FormEvent } from 'react';

interface SearchFormData {
  location: string;
  privateInvestment: boolean;
}

const SearchForm: React.FC = () => {
  const [location, setLocation] = useState<string>('');
  const [privateInvestment, setPrivateInvestment] = useState<boolean>(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData: SearchFormData = {
      location,
      privateInvestment,
    };
    console.log('Search criteria:', formData);
    // TODO: Call API with formData
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg shadow-md">
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700">
          Location (e.g., ZIP code, City)
        </label>
        <input
          type="text"
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="Enter location"
        />
      </div>

      <div className="flex items-center">
        <input
          id="privateInvestment"
          type="checkbox"
          checked={privateInvestment}
          onChange={(e) => setPrivateInvestment(e.target.checked)}
          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
        />
        <label htmlFor="privateInvestment" className="ml-2 block text-sm text-gray-700">
          Interested in Private Investments
        </label>
      </div>

      <div>
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Search RIAs
        </button>
      </div>
    </form>
  );
};

export default SearchForm;
