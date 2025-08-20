'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCredits } from '@/app/hooks/useCredits';

export const HeaderCredits: React.FC = () => {
  const { credits, isSubscriber, isLoadingCredits } = useCredits();
  const router = useRouter();

  if (isLoadingCredits) {
    return (
      <div className="flex items-center space-x-3">
        <div className="text-sm font-medium text-secondary-500 animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  // For Pro subscribers, show "Unlimited"
  if (isSubscriber || credits === -1) {
    return (
      <div className="flex items-center space-x-3">
        <div className="text-sm font-medium text-secondary-700">
          <span className="font-semibold text-accent-600">
            Pro Plan (Unlimited)
          </span>
        </div>
      </div>
    );
  }

  // For free users, show remaining credits with appropriate styling
  const colorClass = credits === 0 ? 'text-red-600' : 
                   credits === 1 ? 'text-orange-600' : 'text-primary-600';

  return (
    <div className="flex items-center">
      <div className="text-sm font-medium text-secondary-700 mr-3">
        <span className={`font-semibold ${colorClass}`}>
          {credits} Credit{credits === 1 ? '' : 's'}
        </span>
      </div>
      
      {credits < 3 && (
        <button
          onClick={() => router.push('/subscription')}
          className="text-xs px-3 py-1 rounded-md bg-primary-600 hover:bg-primary-700 text-white transition-colors"
        >
          Upgrade
        </button>
      )}
    </div>
  );
};