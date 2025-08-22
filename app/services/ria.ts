// app/services/ria.ts
// COMPLETE REPLACEMENT - Delete everything and replace with this

import { apiClient, type AskResponse, type AskRequest } from '@/app/lib/api/client';
import { Session } from '@supabase/supabase-js';

// DEPRECATED - DO NOT USE
// This function exists only for backward compatibility during migration
// All new code should use apiClient.ask() directly
export async function queryRia(
  query: string,
  options?: {
    city?: string;
    state?: string;
    minAum?: number;
    minVcActivity?: number;
    includeDetails?: boolean;
    maxResults?: number;
  },
  session?: Session | null
): Promise<AskResponse> {
  console.warn('queryRia is deprecated. Use apiClient.ask() directly.');
  
  // Set auth token if session provided
  if (session?.access_token) {
    apiClient.setAuthToken(session.access_token);
  }
  
  // Call the new API client
  const response = await apiClient.ask({
    query,
    options,
  });
  
  // CRITICAL: Update credits from metadata
  // This fixes the "always shows 2 credits" bug and syncs across pages
  if (typeof window !== 'undefined' && response.metadata?.remaining !== undefined) {
    // Dispatch custom event that useCredits hook will listen for
    // This will also persist the values and sync across tabs
    window.dispatchEvent(
      new CustomEvent('credits-updated', {
        detail: {
          remaining: response.metadata.remaining,
          isSubscriber: response.metadata.isSubscriber,
        },
      })
    );
  }
  
  return response;
}

// New function for streaming queries
export async function queryRiaStream(
  query: string,
  options?: AskRequest['options'],
  callbacks?: {
    onToken?: (token: string) => void;
    onComplete?: (response: AskResponse) => void;
    onError?: (error: Error) => void;
  },
  session?: Session | null
): Promise<AbortController> {
  // Set auth token if session provided
  if (session?.access_token) {
    apiClient.setAuthToken(session.access_token);
  }
  
  return apiClient.askStream(
    { query, options },
    callbacks?.onToken || (() => {}),
    callbacks?.onComplete || (() => {}),
    callbacks?.onError || (() => {})
  );
}

// Get subscription status
export async function getSubscriptionStatus(session?: Session | null) {
  if (session?.access_token) {
    apiClient.setAuthToken(session.access_token);
  }
  
  return apiClient.getSubscriptionStatus();
}

// Get RIA profile
export async function getRiaProfile(id: string, session?: Session | null) {
  if (session?.access_token) {
    apiClient.setAuthToken(session.access_token);
  }
  
  return apiClient.getProfile(id);
}

// Check system health
export async function checkSystemHealth() {
  return apiClient.checkHealth();
}

// REMOVED FUNCTIONS:
// - searchRia: Use queryRia or apiClient.ask instead
// - submitNotifyForm: Move to separate contact service if needed
