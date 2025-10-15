'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

interface UseSessionDemoReturn {
  searchesRemaining: number | null;
  searchesUsed: number | null;
  isSubscriber: boolean;
  canSearch: boolean;
  isLoading: boolean;
  error?: string;
  refreshStatus: () => Promise<void>;
  updateFromResponse: (response: any) => void;
}

export function useSessionDemo(): UseSessionDemoReturn {
  const [searchesRemaining, setSearchesRemaining] = useState<number | null>(null);
  const [searchesUsed, setSearchesUsed] = useState<number | null>(null);
  const [isSubscriber, setIsSubscriber] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  
  const { user, session, account } = useAuth();
  
  // Simplified refresh - no caching, no localStorage
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/session/status', {
        method: 'GET',
        credentials: 'include',
        headers: session?.access_token ? {
          'Authorization': `Bearer ${session.access_token}`
        } : {}
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch session status');
      }
      
      const data = await response.json();
      
      setSearchesRemaining(data.searchesRemaining ?? 5);
      setSearchesUsed(data.searchesUsed ?? 0);
      setIsSubscriber(!!data.isSubscriber);
      setError(undefined);
      
    } catch (err) {
      console.error('Failed to fetch session status:', err);
      // Default to demo values for anonymous users
      setSearchesRemaining(5);
      setSearchesUsed(0);
      setIsSubscriber(false);
      setError(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [session]);
  
  // Update from API response metadata
  const updateFromResponse = useCallback((response: any) => {
    if (response?.metadata) {
      if (typeof response.metadata.searchesRemaining === 'number') {
        setSearchesRemaining(response.metadata.searchesRemaining);
      }
      if (typeof response.metadata.searchesUsed === 'number') {
        setSearchesUsed(response.metadata.searchesUsed);
      }
      if (typeof response.metadata.isSubscriber === 'boolean') {
        setIsSubscriber(response.metadata.isSubscriber);
      }
    }
  }, []);

  // Prefer backend account sync for subscriber flag when available
  useEffect(() => {
    if (!account) {
      return;
    }

    const subscriberFlag =
      typeof account.isSubscriber === 'boolean'
        ? account.isSubscriber
        : typeof account.is_subscriber === 'boolean'
          ? account.is_subscriber
          : undefined;

    if (typeof subscriberFlag === 'boolean') {
      setIsSubscriber(subscriberFlag);
    }
  }, [account]);
  
  // Refresh on mount and auth changes
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus, user]);
  
  const canSearch = isSubscriber || (searchesRemaining !== null && searchesRemaining > 0);
  
  return {
    searchesRemaining,
    searchesUsed,
    isSubscriber,
    canSearch,
    isLoading,
    error,
    refreshStatus,
    updateFromResponse
  };
}
