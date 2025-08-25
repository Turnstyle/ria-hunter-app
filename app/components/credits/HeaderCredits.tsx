// app/components/credits/HeaderCredits.tsx
// Shows real credit count in the header

'use client';

import { useCredits } from '@/app/hooks/useCredits';
import { CreditCard, Infinity } from 'lucide-react';

export function HeaderCredits() {
  const { credits, isSubscriber, isLoadingCredits } = useCredits();
  
  // Don't show anything while loading
  if (isLoadingCredits) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <CreditCard className="w-5 h-5" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }
  
  // Subscriber display
  if (isSubscriber) {
    return (
      <div className="flex items-center space-x-2 text-green-600">
        <Infinity className="w-5 h-5" />
        <span className="text-sm font-semibold">Pro</span>
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