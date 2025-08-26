// app/hooks/useCredits.ts
// This hook manages credit state and synchronizes with backend
// Enhanced with cross-page persistence and synchronization

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { apiClient } from '@/app/lib/api/client';

interface UseCreditsReturn {
  credits: number | null;
  isSubscriber: boolean;
  isLoadingCredits: boolean;
  isSubmitting: boolean;
  error?: string;
  refreshCredits: () => Promise<void>;
  updateFromResponse: (response: any) => void;
}

// Storage keys for persistence
const CREDITS_STORAGE_KEY = 'ria-hunter-credits';

// Cache duration in milliseconds (5 minutes)
const CREDITS_CACHE_DURATION = 5 * 60 * 1000;

// Broadcast channel for cross-tab synchronization
let creditsBroadcastChannel: BroadcastChannel | null = null;

// Initialize broadcast channel for cross-tab synchronization
if (typeof window !== 'undefined') {
  try {
    creditsBroadcastChannel = new BroadcastChannel('ria-hunter-credits-sync');
  } catch (e) {
    console.warn('BroadcastChannel not supported in this browser. Credits will not sync across tabs.');
  }
}

// Helper to store credits in localStorage
const storeCredits = (credits: number | null, isSubscriber: boolean) => {
  if (typeof window === 'undefined') return;
  
  try {
    const data = {
      credits,
      isSubscriber,
      timestamp: Date.now()
    };
    localStorage.setItem(CREDITS_STORAGE_KEY, JSON.stringify(data));
    
    // Broadcast to other tabs
    if (creditsBroadcastChannel) {
      creditsBroadcastChannel.postMessage(data);
    }
  } catch (e) {
    console.warn('Failed to store credits in localStorage', e);
  }
};

// Helper to get stored credits from localStorage
const getStoredCredits = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const data = localStorage.getItem(CREDITS_STORAGE_KEY);
    if (!data) return null;
    
    return JSON.parse(data);
  } catch (e) {
    console.warn('Failed to parse stored credits', e);
    return null;
  }
};

// Check if stored credits data is fresh enough to use
const isCreditsDataFresh = (data: { timestamp: number }) => {
  return Date.now() - data.timestamp < CREDITS_CACHE_DURATION;
};

export function useCredits(): UseCreditsReturn {
  // Initialize with stored values or defaults
  const getInitialCredits = useCallback(() => {
    const stored = getStoredCredits();
    return stored?.credits ?? null;
  }, []);

  const getInitialSubscriber = useCallback(() => {
    const stored = getStoredCredits();
    return stored?.isSubscriber ?? false;
  }, []);

  const [credits, setCredits] = useState<number | null>(getInitialCredits);
  const [isSubscriber, setIsSubscriber] = useState<boolean>(getInitialSubscriber);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  
  const { user, session } = useAuth();
  
  // Fetch credits from backend with fallback to stored values
  const refreshCredits = useCallback(async () => {
    setIsLoadingCredits(true);
    setIsSubmitting(true);
    
    // Check if we have fresh cached data
    const stored = getStoredCredits();
    if (stored && isCreditsDataFresh(stored.timestamp)) {
      setCredits(stored.credits);
      setIsSubscriber(stored.isSubscriber);
      setIsLoadingCredits(false);
      setIsSubmitting(false);
      return;
    }
    
    try {
      // Use the credits balance API
      const response = await apiClient.getCreditsBalance();
      
      // Determine credits: prefer credits field, then balance, then null
      // Following standardized API response format
      const creditsValue = typeof response.credits === 'number' ? response.credits
                        : typeof response.balance === 'number' ? response.balance
                        : null;
                        
      // Always use isSubscriber as the source of truth for Pro status
      const isSubscriberValue = !!response.isSubscriber;
      
      setCredits(creditsValue);
      setIsSubscriber(isSubscriberValue);
      setError(undefined);
      storeCredits(creditsValue, isSubscriberValue);
    } catch (error) {
      console.error('Failed to fetch credit status:', error);
      setError('unavailable');
      
      // Use stored values as fallback if available
      if (stored) {
        console.log('Using stored credits as fallback:', stored);
        setCredits(stored.credits);
        setIsSubscriber(stored.isSubscriber);
      } else {
        // If no stored value, set to null to indicate unknown
        // This prevents disabling user input when credits are unknown
        setCredits(null);
        setIsSubscriber(false);
      }
    } finally {
      setIsLoadingCredits(false);
      setIsSubmitting(false);
    }
  }, []);
  
  // Update credits from API response
  // CRITICAL: This is what keeps the UI in sync with backend
  const updateFromResponse = useCallback((response: any) => {
    if (response?.metadata) {
      // Use the most reliable data available
      const newCredits = response.metadata.remaining !== undefined ? response.metadata.remaining : null;
      
      // CRITICAL: Always use isSubscriber as the source of truth for Pro status
      const newIsSubscriber = !!response.metadata.isSubscriber;
      
      setCredits(newCredits);
      setIsSubscriber(newIsSubscriber);
      storeCredits(newCredits, newIsSubscriber);
    }
  }, []);
  
  // Handle cross-tab synchronization
  useEffect(() => {
    const handleCreditSync = (event: MessageEvent) => {
      const { credits: newCredits, isSubscriber: newIsSubscriber } = event.data;
      
      setCredits(newCredits);
      setIsSubscriber(newIsSubscriber);
    };
    
    if (creditsBroadcastChannel) {
      creditsBroadcastChannel.addEventListener('message', handleCreditSync);
    }
    
    return () => {
      if (creditsBroadcastChannel) {
        creditsBroadcastChannel.removeEventListener('message', handleCreditSync);
      }
    };
  }, []);
  
  // Fetch credits on mount and when user/session changes
  useEffect(() => {
    refreshCredits();
    
    // Set up periodic refresh
    const refreshInterval = setInterval(refreshCredits, CREDITS_CACHE_DURATION);
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [refreshCredits, user, session]);
  
  return {
    credits,
    isSubscriber,
    isLoadingCredits,
    isSubmitting,
    error,
    refreshCredits,
    updateFromResponse
  };
}