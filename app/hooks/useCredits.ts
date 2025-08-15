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
      
      if (status?.unlimited || status?.isSubscriber) {
        setCredits(-1); // -1 indicates unlimited
        setIsSubscriber(true);
        setSubscriptionStatus(status.status || 'active');
      } else {
        setCredits(status?.usage?.queriesRemaining ?? 2);
        setIsSubscriber(false);
        setSubscriptionStatus(status?.status || 'none');
      }
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
