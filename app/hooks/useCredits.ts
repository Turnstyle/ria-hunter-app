// app/hooks/useCredits.ts
// This hook manages credit state and synchronizes with backend
// Enhanced with cross-page persistence and synchronization

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

// Storage keys for persistence
const CREDITS_STORAGE_KEY = 'ria-hunter-credits';
const SUBSCRIBER_STORAGE_KEY = 'ria-hunter-is-subscriber';
const CREDITS_TIMESTAMP_KEY = 'ria-hunter-credits-timestamp';

// Cache duration (5 minutes)
const CREDITS_CACHE_DURATION = 5 * 60 * 1000;

// Utility functions for localStorage
const getStoredCredits = (): { credits: number; isSubscriber: boolean; timestamp: number } | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const credits = localStorage.getItem(CREDITS_STORAGE_KEY);
    const isSubscriber = localStorage.getItem(SUBSCRIBER_STORAGE_KEY);
    const timestamp = localStorage.getItem(CREDITS_TIMESTAMP_KEY);
    
    if (credits !== null && isSubscriber !== null && timestamp !== null) {
      return {
        credits: parseInt(credits, 10),
        isSubscriber: isSubscriber === 'true',
        timestamp: parseInt(timestamp, 10),
      };
    }
  } catch (error) {
    console.error('Error reading credits from storage:', error);
  }
  
  return null;
};

const storeCredits = (credits: number, isSubscriber: boolean): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const timestamp = Date.now();
    localStorage.setItem(CREDITS_STORAGE_KEY, credits.toString());
    localStorage.setItem(SUBSCRIBER_STORAGE_KEY, isSubscriber.toString());
    localStorage.setItem(CREDITS_TIMESTAMP_KEY, timestamp.toString());
  } catch (error) {
    console.error('Error storing credits to storage:', error);
  }
};

const isCreditsDataFresh = (timestamp: number): boolean => {
  return Date.now() - timestamp < CREDITS_CACHE_DURATION;
};

export function useCredits(): UseCreditsReturn {
  // Initialize with stored values or defaults
  const getInitialCredits = useCallback(() => {
    const stored = getStoredCredits();
    return stored?.credits ?? 0;
  }, []);

  const getInitialSubscriber = useCallback(() => {
    const stored = getStoredCredits();
    return stored?.isSubscriber ?? false;
  }, []);

  const [credits, setCredits] = useState<number>(getInitialCredits);
  const [isSubscriber, setIsSubscriber] = useState<boolean>(getInitialSubscriber);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true);
  
  const { user, session } = useAuth();
  
  // Fetch credits from backend with fallback to stored values
  const refreshCredits = useCallback(async () => {
    setIsLoadingCredits(true);
    
    // Check if we have fresh cached data
    const stored = getStoredCredits();
    if (stored && isCreditsDataFresh(stored.timestamp)) {
      setCredits(stored.credits);
      setIsSubscriber(stored.isSubscriber);
      setIsLoadingCredits(false);
      return;
    }
    
    try {
      if (!user && !session) {
        // Anonymous users get 2 free credits
        // But we still check with backend first
        const status = await getSubscriptionStatus(null);
        const credits = status.credits || 2;
        const isSubscriber = false;
        
        setCredits(credits);
        setIsSubscriber(isSubscriber);
        storeCredits(credits, isSubscriber);
      } else {
        // Authenticated users - get actual credit count
        const status = await getSubscriptionStatus(session);
        const credits = status.credits;
        const isSubscriber = status.isSubscriber;
        
        setCredits(credits);
        setIsSubscriber(isSubscriber);
        storeCredits(credits, isSubscriber);
      }
    } catch (error) {
      console.error('Failed to fetch credit status:', error);
      
      // Use stored values as fallback if available
      if (stored) {
        console.log('Using stored credits as fallback:', stored);
        setCredits(stored.credits);
        setIsSubscriber(stored.isSubscriber);
      } else {
        // Final fallback values
        const fallbackCredits = !user ? 2 : 0;
        const fallbackSubscriber = false;
        
        setCredits(fallbackCredits);
        setIsSubscriber(fallbackSubscriber);
        storeCredits(fallbackCredits, fallbackSubscriber);
      }
    } finally {
      setIsLoadingCredits(false);
    }
  }, [user, session]);
  
  // Update credits from API response
  // CRITICAL: This is what keeps the UI in sync with backend
  const updateFromResponse = useCallback((response: any) => {
    let newCredits: number | undefined;
    let newIsSubscriber: boolean | undefined;
    
    // Check for metadata.remaining first (new format)
    if (response?.metadata?.remaining !== undefined) {
      newCredits = Math.max(0, response.metadata.remaining);
      
      if (response.metadata.isSubscriber !== undefined) {
        newIsSubscriber = response.metadata.isSubscriber;
      }
    }
    // Fallback to checking top-level remaining (backward compatibility)
    else if (response?.remaining !== undefined) {
      newCredits = Math.max(0, response.remaining);
    }
    
    if (response?.isSubscriber !== undefined) {
      newIsSubscriber = response.isSubscriber;
    }
    
    // Update state and persist if values changed
    if (newCredits !== undefined) {
      setCredits(newCredits);
    }
    if (newIsSubscriber !== undefined) {
      setIsSubscriber(newIsSubscriber);
    }
    
    // Persist to storage if we have values to update
    if (newCredits !== undefined || newIsSubscriber !== undefined) {
      const currentCredits = newCredits ?? credits;
      const currentSubscriber = newIsSubscriber ?? isSubscriber;
      storeCredits(currentCredits, currentSubscriber);
      
      // Broadcast to other tabs/windows
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new StorageEvent('storage', {
          key: CREDITS_STORAGE_KEY,
          newValue: currentCredits.toString(),
        }));
      }
    }
  }, [credits, isSubscriber]);
  
  // Listen for credit update events and cross-tab synchronization
  useEffect(() => {
    const handleCreditUpdate = (event: CustomEvent) => {
      if (event.detail?.remaining !== undefined) {
        const newCredits = Math.max(0, event.detail.remaining);
        setCredits(newCredits);
        
        // Persist the update
        const currentSubscriber = event.detail?.isSubscriber ?? isSubscriber;
        storeCredits(newCredits, currentSubscriber);
      }
      if (event.detail?.isSubscriber !== undefined) {
        setIsSubscriber(event.detail.isSubscriber);
      }
    };
    
    // Listen for storage changes from other tabs/windows
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === CREDITS_STORAGE_KEY && event.newValue !== null) {
        try {
          const newCredits = parseInt(event.newValue, 10);
          if (!isNaN(newCredits)) {
            setCredits(newCredits);
          }
        } catch (error) {
          console.error('Error parsing credits from storage event:', error);
        }
      } else if (event.key === SUBSCRIBER_STORAGE_KEY && event.newValue !== null) {
        setIsSubscriber(event.newValue === 'true');
      }
    };
    
    // Listen for visibility change to refresh when returning to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Check if data is stale when tab becomes visible
        const stored = getStoredCredits();
        if (!stored || !isCreditsDataFresh(stored.timestamp)) {
          refreshCredits();
        }
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('credits-updated', handleCreditUpdate as EventListener);
      window.addEventListener('storage', handleStorageChange);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('credits-updated', handleCreditUpdate as EventListener);
        window.removeEventListener('storage', handleStorageChange);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [isSubscriber, refreshCredits]);
  
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