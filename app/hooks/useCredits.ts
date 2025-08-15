'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSubscriptionStatus } from '@/services/ria';

export function useCredits() {
  const { user, session } = useAuth();
  const [credits, setCredits] = useState<number>(2);
  const [isSubscriber, setIsSubscriber] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('none');

  const checkStatus = useCallback(async () => {
    if (!user || !session?.access_token) {
      setCredits(2);
      setIsSubscriber(false);
      setSubscriptionStatus('none');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const status = await getSubscriptionStatus(session.access_token);
      
      // Debug logging for promotional subscription diagnosis
      console.log('useCredits received subscription status:', status);
      console.log('useCredits subscription evaluation:', {
        unlimited: status?.unlimited,
        isSubscriber: status?.isSubscriber,
        hasActiveSubscription: status?.hasActiveSubscription,
        shouldBeProUser: status?.unlimited || status?.isSubscriber
      });
      
      if (status?.unlimited || status?.isSubscriber) {
        console.log('Setting user as Pro subscriber with unlimited credits');
        setCredits(-1); // -1 indicates unlimited
        setIsSubscriber(true);
        setSubscriptionStatus(status.status || 'active');
      } else {
        console.log('Setting user as free user with limited credits');
        setCredits(status?.usage?.queriesRemaining ?? 2);
        setIsSubscriber(false);
        setSubscriptionStatus(status?.status || 'none');
      }
      
      console.log('useCredits final state:', {
        credits: status?.unlimited || status?.isSubscriber ? -1 : (status?.usage?.queriesRemaining ?? 2),
        isSubscriber: status?.unlimited || status?.isSubscriber || false,
        subscriptionStatus: status?.status || (status?.unlimited || status?.isSubscriber ? 'active' : 'none')
      });
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setCredits(2);
      setIsSubscriber(false);
      setSubscriptionStatus('error');
    } finally {
      setLoading(false);
    }
  }, [user, session?.access_token]);

  const updateFromQueryResponse = useCallback((response: any) => {
    if (response?.remaining !== undefined) setCredits(response.remaining);
    if (response?.isSubscriber !== undefined) setIsSubscriber(response.isSubscriber);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    credits: isSubscriber ? -1 : credits,
    isSubscriber,
    loading,
    subscriptionStatus,
    refreshStatus: checkStatus,
    updateFromQueryResponse,
  };
}
