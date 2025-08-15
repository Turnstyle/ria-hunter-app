'use client';

import React from 'react';
import { useCredits } from '@/hooks/useCredits';

const HeaderCredits: React.FC = () => {
  const { credits, isSubscriber, loading } = useCredits();

  if (loading) return null;

  // For Pro subscribers, always show "Unlimited"
  if (isSubscriber || credits === -1) {
    return (
      <div className="flex items-center space-x-3">
        <div className="text-sm font-medium text-gray-700">
          <span className="font-semibold text-green-600">
            Unlimited
          </span>
        </div>
      </div>
    );
  }

  // For free users, show remaining credits with appropriate styling
  const colorClass = credits === 0 ? 'text-red-600' : 
                    credits === 1 ? 'text-orange-600' : 'text-blue-600';

  return (
    <div className="flex items-center space-x-3">
      <div className="text-sm font-medium text-gray-700">
        <span className={`font-semibold ${colorClass}`}>
          {credits} Credit{credits === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
};

export default HeaderCredits;
