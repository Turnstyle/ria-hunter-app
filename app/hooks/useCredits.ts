// app/hooks/useCredits.ts
// This hook manages credit state and synchronizes with backend

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSubscriptionStatus } from '@/app/services/ria';

interface UseCreditsReturn {
  credits: number;
  isSubscriber: boolean;
  isLoadingCredits: boolean;
  refreshCredits: () => Promise<void>;
  updateFromResponse: (response: any) => void;
}

export function useCredits(): UseCreditsReturn {
  // CRITICAL: Default to 0, not 2
  // The backend will tell us the actual count
  const [credits, setCredits] = useState<number>(0);
  const [isSubscriber, setIsSubscriber] = useState<boolean>(false);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true);
  
  const { user, session } = useAuth();
  
  // Fetch credits from backend
  const refreshCredits = useCallback(async () => {
    setIsLoadingCredits(true);
    
    try {
      if (!user && !session) {
        // Anonymous users get 2 free credits
        // But we still check with backend first
        const status = await getSubscriptionStatus(null);
        setCredits(status.credits || 2);
        setIsSubscriber(false);
      } else {
        // Authenticated users - get actual credit count
        const status = await getSubscriptionStatus(session);
        setCredits(status.credits);
        setIsSubscriber(status.isSubscriber);
      }
    } catch (error) {
      console.error('Failed to fetch credit status:', error);
      
      // Fallback values on error
      if (!user) {
        setCredits(2); // Anonymous users
      } else {
        setCredits(0); // Authenticated users with error
      }
      setIsSubscriber(false);
    } finally {
      setIsLoadingCredits(false);
    }
  }, [user, session]);
  
  // Update credits from API response
  // CRITICAL: This is what keeps the UI in sync with backend
  const updateFromResponse = useCallback((response: any) => {
    // Check for metadata.remaining first (new format)
    if (response?.metadata?.remaining !== undefined) {
      setCredits(Math.max(0, response.metadata.remaining));
      
      if (response.metadata.isSubscriber !== undefined) {
        setIsSubscriber(response.metadata.isSubscriber);
      }
      
      return;
    }
    
    // Fallback to checking top-level remaining (backward compatibility)
    if (response?.remaining !== undefined) {
      setCredits(Math.max(0, response.remaining));
    }
    
    if (response?.isSubscriber !== undefined) {
      setIsSubscriber(response.isSubscriber);
    }
  }, []);
  
  // Listen for credit update events
  useEffect(() => {
    const handleCreditUpdate = (event: CustomEvent) => {
      if (event.detail?.remaining !== undefined) {
        setCredits(Math.max(0, event.detail.remaining));
      }
      if (event.detail?.isSubscriber !== undefined) {
        setIsSubscriber(event.detail.isSubscriber);
      }
    };
    
    window.addEventListener('credits-updated', handleCreditUpdate as EventListener);
    
    return () => {
      window.removeEventListener('credits-updated', handleCreditUpdate as EventListener);
    };
  }, []);
  
  // Initial load and auth changes
  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);
  
  return {
    credits,
    isSubscriber,
    isLoadingCredits,
    refreshCredits,
    updateFromResponse,
  };
}