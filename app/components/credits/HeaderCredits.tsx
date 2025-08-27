// app/components/credits/HeaderCredits.tsx
// Shows real credit count in the header

'use client';

import { useSessionDemo } from '@/app/hooks/useSessionDemo';
import { Search, Infinity } from 'lucide-react';
import { useState } from 'react';

export function HeaderCredits() {
  const { searchesRemaining, isSubscriber, isLoading } = useSessionDemo();
  const [isManaging, setIsManaging] = useState(false);
  
  // Show loading state briefly
  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <Search className="w-5 h-5" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }
  
  const handleManageClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsManaging(true);
    
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      console.error('Error opening Stripe portal:', error);
      setIsManaging(false);
    }
  };
  
  // Subscriber display
  if (isSubscriber) {
    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center">
          <div className="bg-green-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
            Pro
          </div>
          <Infinity className="w-5 h-5 text-green-600 ml-1" />
          <span className="text-sm font-semibold ml-1 text-green-600">Unlimited Searches</span>
        </div>
        
        <a
          href="#"
          onClick={handleManageClick}
          className="text-xs underline hover:no-underline ml-2"
          aria-disabled={isManaging}
        >
          {isManaging ? 'Opening...' : 'Manage'}
        </a>
      </div>
    );
  }
  
  // Free user display with color coding
  const getSearchesColor = () => {
    if (searchesRemaining === null || searchesRemaining === undefined) return 'text-gray-400';
    if (searchesRemaining === 0) return 'text-red-600';
    if (searchesRemaining === 1) return 'text-orange-600';
    if (searchesRemaining <= 2) return 'text-yellow-600';
    return 'text-gray-600';
  };
  
  // Ensure searches is displayed as a number (default to 5 for anonymous)
  const displaySearches = searchesRemaining ?? 5;
  
  return (
    <div className={`flex items-center space-x-2 ${getSearchesColor()}`}>
      <Search className="w-5 h-5" />
      <span className="text-sm font-semibold">
        {displaySearches === 0 
          ? 'Demo limit reached'
          : `${displaySearches} Free ${displaySearches === 1 ? 'Search' : 'Searches'} Left`}
      </span>
      
      {/* Show Get Unlimited link for demo users */}
      <a
        href={displaySearches === 0 ? "/signup" : "/subscription"}
        className="text-xs underline hover:no-underline"
      >
        {displaySearches === 0 ? 'Sign Up' : 'Get Unlimited'}
      </a>
    </div>
  );
}