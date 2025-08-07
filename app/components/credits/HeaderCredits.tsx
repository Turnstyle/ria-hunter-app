'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { checkUserSubscription, getSubscriptionSystemHealth, SubscriptionStatus } from '@/app/lib/subscription-utils';

const HeaderCredits: React.FC = () => {
  const { user, session } = useAuth();
  const [credits, setCredits] = useState<number>(2);
  const [hasSharedOnLinkedIn, setHasSharedOnLinkedIn] = useState<boolean>(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({ 
    hasActiveSubscription: false, 
    status: null,
    trialEnd: null,
    currentPeriodEnd: null
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [showLinkedInModal, setShowLinkedInModal] = useState<boolean>(false);
  const subscriptionCheckRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

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

  // Safely check subscription status with circuit breaker and rate limiting
  const checkSubscriptionSafely = useCallback(async (userId: string) => {
    if (subscriptionCheckRef.current) {
      console.log('Subscription check already in progress, skipping');
      return;
    }

    // Check if circuit breaker is open before attempting
    const health = getSubscriptionSystemHealth(userId);
    if (health.isCircuitOpen) {
      console.log(`Circuit breaker open for user ${userId}, skipping subscription check`);
      setLoading(false);
      return;
    }

    subscriptionCheckRef.current = true;
    setLoading(true);

    try {
      const status = await checkUserSubscription(userId);
      
      // Only update state if component is still mounted
      if (mountedRef.current) {
        setSubscriptionStatus(status);
        
        // Log circuit breaker status if it indicates issues
        if (status.status === 'circuit_breaker_open') {
          console.warn('Subscription check returned circuit breaker status');
        }
      }
    } catch (error) {
      console.error('Error in HeaderCredits subscription check:', error);
      if (mountedRef.current) {
        setSubscriptionStatus({ 
          hasActiveSubscription: false, 
          status: null,
          trialEnd: null,
          currentPeriodEnd: null
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      subscriptionCheckRef.current = false;
    }
  }, []);

  // Check subscription status for authenticated users with safeguards
  useEffect(() => {
    if (user?.id) {
      // Add a small delay to prevent rapid-fire calls
      const timeoutId = setTimeout(() => {
        checkSubscriptionSafely(user.id);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    } else {
      setLoading(false);
      setSubscriptionStatus({ 
        hasActiveSubscription: false, 
        status: null,
        trialEnd: null,
        currentPeriodEnd: null
      });
    }
  }, [user?.id, checkSubscriptionSafely]); // Depend on stable user ID and callback

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Listen for query count changes to update credits (optimized to prevent loops)
  useEffect(() => {
    const handleStorageChange = () => {
      if (!mountedRef.current) return;
      
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

    // Listen for storage changes from other tabs
    window.addEventListener('storage', handleStorageChange);
    
    // Reduced polling frequency and added safeguards
    const interval = setInterval(() => {
      if (mountedRef.current) {
        handleStorageChange();
      }
    }, 15000); // Increased from 10s to 15s

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [hasSharedOnLinkedIn]); // Keep dependency to handle LinkedIn state changes

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

  // Don't show anything while loading
  if (loading) return null;

  // For authenticated users with active subscription
  if (user && subscriptionStatus.hasActiveSubscription) {
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