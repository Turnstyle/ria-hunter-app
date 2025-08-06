'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { checkUserSubscription } from '@/app/lib/subscription-utils';

interface CreditsCounterProps {
  onLinkedInBonus?: () => void;
  className?: string;
}

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  status: string | null;
}

const CreditsCounter: React.FC<CreditsCounterProps> = ({ onLinkedInBonus, className = "" }) => {
  const { user, session } = useAuth();
  const [credits, setCredits] = useState<number>(2);
  const [hasSharedOnLinkedIn, setHasSharedOnLinkedIn] = useState<boolean>(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ hasActiveSubscription: false, status: null });
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize credits and LinkedIn status from localStorage
  useEffect(() => {
    const savedQueryCount = localStorage.getItem('ria-hunter-query-count');
    const savedShareStatus = localStorage.getItem('ria-hunter-linkedin-shared');
    
    if (savedQueryCount) {
      const used = parseInt(savedQueryCount);
      const baseCredits = 2;
      const bonusCredits = savedShareStatus === 'true' ? 1 : 0;
      const remaining = Math.max(0, baseCredits + bonusCredits - used);
      setCredits(remaining);
    } else {
      setCredits(2);
    }
    
    if (savedShareStatus === 'true') {
      setHasSharedOnLinkedIn(true);
    }
  }, []);

  // Check subscription status for authenticated users
  useEffect(() => {
    const checkSubscription = async () => {
      if (user) {
        try {
          setLoading(true);
          const status = await checkUserSubscription(user.id);
          setSubscriptionStatus(status);
        } catch (error) {
          console.error('Error checking subscription:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [user]);

  // Listen for query count changes to update credits
  useEffect(() => {
    const handleStorageChange = () => {
      const savedQueryCount = localStorage.getItem('ria-hunter-query-count');
      const savedShareStatus = localStorage.getItem('ria-hunter-linkedin-shared');
      
      if (savedQueryCount) {
        const used = parseInt(savedQueryCount);
        const baseCredits = 2;
        const bonusCredits = savedShareStatus === 'true' ? 1 : 0;
        const remaining = Math.max(0, baseCredits + bonusCredits - used);
        setCredits(remaining);
      }
      
      if (savedShareStatus === 'true' && !hasSharedOnLinkedIn) {
        setHasSharedOnLinkedIn(true);
      }
    };

    // Listen for storage changes
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case the same tab made changes
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [hasSharedOnLinkedIn]);

  const handleLinkedInShare = () => {
    const shareText = encodeURIComponent(
      "🔍 Just discovered RIA Hunter - an amazing tool for finding and researching Registered Investment Advisors! Perfect for anyone in finance or investment research. Check it out!"
    );
    const shareUrl = encodeURIComponent("https://riahunter.com");
    
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}&text=${shareText}`;
    
    // Open LinkedIn share dialog
    const popup = window.open(linkedInUrl, 'linkedin-share', 'width=600,height=500,scrollbars=yes,resizable=yes');
    
    // Grant bonus credit after a delay (assuming they shared)
    setTimeout(() => {
      if (popup) {
        popup.close();
      }
      
      // Grant the bonus credit
      localStorage.setItem('ria-hunter-linkedin-shared', 'true');
      setHasSharedOnLinkedIn(true);
      
      // Update credits
      const savedQueryCount = localStorage.getItem('ria-hunter-query-count') || '0';
      const used = parseInt(savedQueryCount);
      const newCredits = Math.max(0, 3 - used); // 2 base + 1 bonus - used
      setCredits(newCredits);
      
      if (onLinkedInBonus) {
        onLinkedInBonus();
      }
    }, 3000);
  };

  if (loading && user) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-20 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  // For authenticated users with active subscription
  if (user && subscriptionStatus.hasActiveSubscription) {
    return (
      <div className={`bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-green-800">Pro Plan Active</h3>
              <p className="text-xs text-green-600">Unlimited queries</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-800">∞</div>
            <div className="text-xs text-green-600">Queries</div>
          </div>
        </div>
      </div>
    );
  }

  // For free users (unauthenticated or authenticated without subscription)
  const isLowCredits = credits <= 1;
  const showLinkedInBonus = !hasSharedOnLinkedIn && credits <= 1;

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isLowCredits ? 'bg-orange-100' : 'bg-blue-100'
            }`}>
              <svg className={`w-5 h-5 ${isLowCredits ? 'text-orange-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium ${isLowCredits ? 'text-orange-800' : 'text-blue-800'}`}>
              Free Queries Remaining
            </h3>
            <p className={`text-xs ${isLowCredits ? 'text-orange-600' : 'text-blue-600'}`}>
              {isLowCredits ? 'Running low on credits!' : 'Use them wisely'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${isLowCredits ? 'text-orange-800' : 'text-blue-800'}`}>
            {credits}
          </div>
          <div className={`text-xs ${isLowCredits ? 'text-orange-600' : 'text-blue-600'}`}>
            Credits
          </div>
        </div>
      </div>
      
      {showLinkedInBonus && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Want an extra query?</p>
              <p className="text-xs text-blue-600">Share on LinkedIn for +1 bonus credit!</p>
            </div>
            <button
              onClick={handleLinkedInShare}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clipRule="evenodd" />
              </svg>
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditsCounter;