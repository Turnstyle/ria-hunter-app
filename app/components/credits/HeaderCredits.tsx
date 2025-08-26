// app/components/credits/HeaderCredits.tsx
// Shows real credit count in the header

'use client';

import { useCredits } from '@/app/hooks/useCredits';
import { CreditCard, Infinity } from 'lucide-react';
import { useState } from 'react';

export function HeaderCredits() {
  const { credits, isSubscriber, isLoadingCredits } = useCredits();
  const [isManaging, setIsManaging] = useState(false);
  
  // Don't show anything while loading
  if (isLoadingCredits) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <CreditCard className="w-5 h-5" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }
  
  const handleManageClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsManaging(true);
    
    try {
      const response = await fetch('/_backend/api/stripe/portal', {
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
          <span className="text-sm font-semibold ml-1 text-green-600">Unlimited</span>
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
  const getCreditsColor = () => {
    if (credits === null) return 'text-gray-400';
    if (credits === 0) return 'text-red-600';
    if (credits === 1) return 'text-orange-600';
    if (credits <= 3) return 'text-yellow-600';
    return 'text-gray-600';
  };
  
  return (
    <div className={`flex items-center space-x-2 ${getCreditsColor()}`}>
      <CreditCard className="w-5 h-5" />
      <span className="text-sm font-semibold">
        {credits === null ? '— Credits' : `${credits} ${credits === 1 ? 'Credit' : 'Credits'} Remaining`}
      </span>
      
      {/* Only show Upgrade link for non-subscribers */}
      {!isSubscriber && (
        <a
          href="/subscription"
          className="text-xs underline hover:no-underline"
        >
          Upgrade
        </a>
      )}
    </div>
  );
}