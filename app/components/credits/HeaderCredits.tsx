'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { checkUserSubscription } from '@/app/lib/subscription-utils';

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  status: string | null;
}

const HeaderCredits: React.FC = () => {
  const { user, session } = useAuth();
  const [credits, setCredits] = useState<number>(2);
  const [hasSharedOnLinkedIn, setHasSharedOnLinkedIn] = useState<boolean>(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ hasActiveSubscription: false, status: null });
  const [loading, setLoading] = useState<boolean>(true);
  const [showLinkedInModal, setShowLinkedInModal] = useState<boolean>(false);

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

  // Check subscription status for authenticated users (temporarily disabled to prevent infinite loop)
  useEffect(() => {
    if (user) {
      setLoading(false);
      // Temporarily assume no active subscription to prevent infinite loop
      setSubscriptionStatus({ hasActiveSubscription: false, status: null });
    } else {
      setLoading(false);
    }
  }, [user?.id]); // Only depend on user ID to prevent loops

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
    
    // Also check periodically in case the same tab made changes (reduced frequency to prevent loops)
    const interval = setInterval(handleStorageChange, 10000);

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
      setShowLinkedInModal(false);
      
      // Update credits
      const savedQueryCount = localStorage.getItem('ria-hunter-query-count') || '0';
      const used = parseInt(savedQueryCount);
      const newCredits = Math.max(0, 3 - used); // 2 base + 1 bonus - used
      setCredits(newCredits);
    }, 3000);
  };

  // Don't show anything if loading or no user
  if (loading || !user) return null;

  // For authenticated users with active subscription
  if (subscriptionStatus.hasActiveSubscription) {
    return (
      <div className="flex items-center space-x-3">
        <div className="text-sm font-medium text-gray-700">
          Credits <span className="text-green-600">Unlimited</span>
        </div>
      </div>
    );
  }

  // For free users - show credits and bonus button if applicable
  const showBonusButton = !hasSharedOnLinkedIn && credits <= 1;

  return (
    <>
      <div className="flex items-center space-x-2">
        {showBonusButton && (
          <button
            onClick={() => setShowLinkedInModal(true)}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          >
            <span className="hidden xs:inline">+1 Free Credit</span>
            <span className="xs:hidden">+1</span>
          </button>
        )}
        
        <div className="text-sm font-medium text-gray-700">
          <span className="hidden xs:inline">Credits </span>
          <span className={`font-semibold ${credits === 0 ? 'text-red-600' : credits === 1 ? 'text-orange-600' : 'text-green-600'}`}>
            {credits}
          </span>
        </div>
      </div>

      {/* LinkedIn Share Modal */}
      {showLinkedInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 relative">
            <button
              onClick={() => setShowLinkedInModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Get 1 Bonus Credit</h3>
              <p className="text-sm text-gray-600 mb-6">
                Share RIA Hunter on LinkedIn to unlock an extra free query!
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleLinkedInShare}
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium rounded-md hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Share on LinkedIn
                </button>
                <button
                  onClick={() => setShowLinkedInModal(false)}
                  className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HeaderCredits;