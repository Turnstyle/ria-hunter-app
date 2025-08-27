'use client';

import React from 'react';

export const DEMO_LIMIT_MESSAGE = "You've used your 5 free demo searches. Create a free account to continue exploring RIA Hunter with unlimited searches for 7 days.";

interface DemoLimitReachedProps {
  className?: string;
}

export function DemoLimitReached({ className = '' }: DemoLimitReachedProps) {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-6 text-center ${className}`}>
      <h3 className="text-lg font-semibold text-blue-800 mb-2">
        Demo Limit Reached
      </h3>
      <p className="text-blue-700 mb-4">
        {DEMO_LIMIT_MESSAGE}
      </p>
      <div className="space-x-3">
        <a 
          href="/signup"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Create Free Account
        </a>
        <a 
          href="/pricing"
          className="inline-flex items-center px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
        >
          View Pricing
        </a>
      </div>
    </div>
  );
}

export default DemoLimitReached;
