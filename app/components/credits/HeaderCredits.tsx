'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { normalizeSubscriptionResponse, getSubscriptionSystemHealth, SubscriptionStatus } from '@/app/lib/subscription-client-utils';

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

  const getKey = useCallback((base: string) => {
    const suffix = user?.id ? `:${user.id}` : ':anon';
    return `${base}${suffix}`;
  }, [user?.id]);

  const readBool = useCallback((key: string) => {
    try { return localStorage.getItem(key) === 'true'; } catch { return false; }
  }, []);

  const readInt = useCallback((key: string) => {
    try { const v = localStorage.getItem(key); return v ? parseInt(v) : null; } catch { return null; }
  }, []);

  const write = useCallback((key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch {}
  }, []);

  useEffect(() => {
    if (subscriptionStatus.hasActiveSubscription) {
      setCredits(999999);
      return;
    }

    const savedQueryCount = readInt(getKey('ria-hunter-query-count'));
    const savedShareStatus = readBool(getKey('ria-hunter-linkedin-shared'));
    const signupBonusAwarded = readBool(getKey('ria-hunter-signup-bonus'));
    
    if (savedQueryCount !== null) {
      const used = savedQueryCount;
      const baseCredits = 2;
      const linkedInBonus = savedShareStatus ? 1 : 0;
      const signupBonus = signupBonusAwarded ? 2 : 0;
      const totalCredits = baseCredits + linkedInBonus + signupBonus;
      const remaining = Math.max(0, totalCredits - used);
      setCredits(remaining);
    } else {
      if (user && !signupBonusAwarded) {
        write(getKey('ria-hunter-signup-bonus'), 'true');
        setCredits(4);
      } else {
        setCredits(2);
      }
    }
    
    if (savedShareStatus) {
      setHasSharedOnLinkedIn(true);
    }
  }, [user, subscriptionStatus.hasActiveSubscription, getKey, readBool, readInt, write]);

  const checkSubscriptionSafely = useCallback(async (userId: string) => {
    if (subscriptionCheckRef.current) {
      return;
    }

    const health = getSubscriptionSystemHealth(userId);
    if (health.isCircuitOpen) {
      setLoading(false);
      return;
    }

    subscriptionCheckRef.current = true;
    setLoading(true);

    try {
      let status: SubscriptionStatus = { hasActiveSubscription: false, status: null, trialEnd: null, currentPeriodEnd: null };
      if (session?.access_token) {
        try {
          const resp = await fetch('/api/subscription-status', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: 'no-store',
          });
          if (resp.ok) {
            const data = await resp.json();
            status = normalizeSubscriptionResponse(data);
          }
        } catch (e) {}
      }

      if (mountedRef.current) {
        setSubscriptionStatus(status);
        if (status.status === 'circuit_breaker_open') {
          console.warn('Subscription check returned circuit breaker status');
        }
      }
    } catch (error) {
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
  }, [session?.access_token, getSubscriptionSystemHealth]);

  useEffect(() => {
    if (user?.id) {
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
  }, [user?.id, checkSubscriptionSafely]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (loading) return null;

  if (user && subscriptionStatus.hasActiveSubscription) {
    return (
      <div className="flex items-center space-x-3">
        <div className="text-sm font-medium text-gray-700">
          Credits <span className="text-green-600">Unlimited</span>
        </div>
      </div>
    );
  }

  const showBonusButton = !hasSharedOnLinkedIn;

  return (
    <>
      <div className="flex items-center space-x-1.5 sm:space-x-3">
        {showBonusButton && (
          <button
            onClick={() => setShowLinkedInModal(true)}
            className="px-2 py-1.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs sm:text-xs font-semibold rounded-md sm:rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-md hover:shadow-lg animate-pulse hover:animate-none"
          >
            <span className="hidden sm:inline">Earn 1 Free Credit</span>
            <span className="sm:hidden">+1 Free</span>
          </button>
        )}
        
        <div className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
          <span className={`font-semibold ${credits === 0 ? 'text-red-600' : credits === 1 ? 'text-orange-600' : subscriptionStatus.hasActiveSubscription ? 'text-purple-600' : 'text-green-600'}`}>
            {subscriptionStatus.hasActiveSubscription ? '∞' : credits}
          </span>
          <span className="ml-0.5 sm:ml-1">
            <span className="hidden sm:inline">{subscriptionStatus.hasActiveSubscription ? 'Unlimited' : (credits === 1 ? 'Credit' : 'Credits')}</span>
            <span className="sm:hidden">{subscriptionStatus.hasActiveSubscription ? '∞' : 'C'}</span>
          </span>
        </div>
      </div>

      {showLinkedInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999] p-4">
          <div className="bg-white rounded-xl p-6 sm:p-8 max-w-md w-full mx-4 relative max-h-screen overflow-y-auto">
            <button
              onClick={() => setShowLinkedInModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">🎉 Loving RIA Hunter?</h3>
              <p className="text-gray-600 mb-6">
                Share your experience on LinkedIn and unlock <span className="font-semibold text-blue-600">1 bonus query</span>! 
                Help others discover this powerful tool while getting extra searches.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    try {
                      if (session?.access_token) {
                        await fetch('/api/redeem-share', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
                      }
                    } catch {}
                    setHasSharedOnLinkedIn(true);
                    write(getKey('ria-hunter-linkedin-shared'), 'true');
                    setShowLinkedInModal(false);
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  Share on LinkedIn & Get Bonus Query
                </button>
                <button
                  onClick={() => setShowLinkedInModal(false)}
                  className="w-full px-6 py-3 text-gray-600 hover:text-gray-800 focus:outline-none transition-colors"
                >
                  Skip for Now
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
