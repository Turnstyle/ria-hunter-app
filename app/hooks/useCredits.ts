'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSubscriptionStatus } from '@/app/services/ria';

export function useCredits() {
  const { user, session } = useAuth();
  const [credits, setCredits] = useState<number>(2);
  const [isSubscriber, setIsSubscriber] = useState<boolean>(false);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('none');

  const checkStatus = useCallback(async () => {
    if (!user || !session?.access_token) {
      setCredits(2);
      setIsSubscriber(false);
      setSubscriptionStatus('none');
      setIsLoadingCredits(false);
      return;
    }

    try {
      setIsLoadingCredits(true);
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
      setIsLoadingCredits(false);
    }
  }, [user, session?.access_token]);

  const updateFromQueryResponse = useCallback((response: any) => {
    if (response?.remaining !== undefined) setCredits(response.remaining);
    if (response?.isSubscriber !== undefined) setIsSubscriber(response.isSubscriber);
  }, []);

  // Decrement credits function to be used when a search is performed
  const decrementCredits = useCallback((amount: number = 1) => {
    if (isSubscriber) return; // No need to decrement for subscribers
    
    setCredits(prevCredits => {
      const newValue = Math.max(0, prevCredits - amount);
      
      // Update server about credit usage
      if (session?.access_token) {
        fetch('/api/subscription-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'use_credit',
            amount: amount
          })
        }).catch(err => {
          console.error('Failed to update credit usage on server:', err);
        });
      }
      
      return newValue;
    });
  }, [isSubscriber, session]);

  // Earn bonus credits (e.g., for social sharing)
  const earnCredits = useCallback(async (source: string, amount: number = 1) => {
    if (isSubscriber || !user || !session?.access_token) return;
    
    try {
      const response = await fetch('/api/subscription-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'earn_credit',
          source,
          amount
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCredits(prev => prev + amount);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to earn credits:', error);
      return false;
    }
  }, [isSubscriber, user, session]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    credits: isSubscriber ? -1 : credits,
    isSubscriber,
    isLoadingCredits,
    subscriptionStatus,
    refreshStatus: checkStatus,
    updateFromQueryResponse,
    decrementCredits,
    earnCredits
  };
}