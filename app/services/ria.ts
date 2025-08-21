export type QueryResultItem = {
  name: string;
  city: string;
  state: string;
  aum?: number;
  vcFunds?: number;
  vcAum?: number;
  crdNumbers?: string[];
};

export type QueryResponse = {
  items: QueryResultItem[];
  remaining?: number;
  isSubscriber?: boolean;
  relaxed?: boolean;
  relaxationLevel?: string;
  resolvedRegion?: any;
};

interface SubscriptionStatusResponse {
  hasActiveSubscription: boolean;
  status: string;
  isSubscriber: boolean;
  unlimited: boolean;
  usage?: {
    queriesRemaining: number;
  };
}

const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
const USE_STREAM = false;

import { fetchWithRetry, createApiError } from '@/app/lib/apiClient';

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

export async function queryRia(
  query: string,
  authToken?: string,
  options: { maxResults?: number; includeDetails?: boolean; onRetry?: (attempt: number, delay: number) => void } = {}
): Promise<QueryResponse> {
  const { maxResults, includeDetails, onRetry } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const response = await fetchWithRetry('/api/ask', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      userToken: authToken,
      maxResults,
      includeDetails
    })
  }, {
    maxRetries: 3,
    onRetry
  });

  if (!response.ok) {
    if (response.status === 402) {
      throw { code: 'PAYMENT_REQUIRED', message: 'Credits exhausted' };
    }
    if (response.status === 401) {
      throw { code: 'UNAUTHORIZED', message: 'Authentication required' };
    }
    if (response.status === 429) {
      throw { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' };
    }
    throw new Error(`Query failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Handle normalized response format from /api/ask
  const items: QueryResultItem[] = data.sources?.map((source: any) => ({
    name: source.legal_name || source.name,
    city: source.city,
    state: source.state,
    crdNumbers: [source.crd_number?.toString()].filter(Boolean),
    aum: source.vc_total_aum || source.total_aum,
    vcFunds: source.vc_fund_count,
    vcAum: source.vc_total_aum || source.total_aum,
  })) || [];

  return {
    items,
    remaining: data.remaining || data.queriesRemaining,
    isSubscriber: data.isSubscriber || data.hasActiveSubscription,
    relaxed: data.relaxed,
    relaxationLevel: data.relaxationLevel,
    resolvedRegion: data.resolvedRegion,
  };
}

export type SearchResponse = {
  items: QueryResultItem[];
  total?: number;
  page?: number;
  hasMore?: boolean;
  isSubscriber?: boolean;
};

export async function searchRia(
  params: Record<string, string | number | boolean>,
  authToken?: string,
  options: { onRetry?: (attempt: number, delay: number) => void } = {}
): Promise<SearchResponse> {
  const { onRetry } = options;
  const queryString = new URLSearchParams(params as any).toString();
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const response = await fetchWithRetry(`/api/v1/ria/search?${queryString}`, {
    headers,
    cache: 'no-store'
  }, {
    maxRetries: 3,
    onRetry
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw { code: 'UNAUTHORIZED', message: 'Authentication required' };
    }
    if (response.status === 429) {
      throw { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' };
    }
    throw new Error(`Search failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  const items: QueryResultItem[] = data.results?.map((item: any) => ({
    name: item.legal_name || item.name,
    city: item.city,
    state: item.state,
    crdNumbers: [item.crd_number?.toString()].filter(Boolean),
    aum: item.total_aum,
    vcFunds: item.private_fund_count,
    vcAum: item.private_fund_aum,
  })) || [];

  return {
    items,
    total: data.total,
    page: data.page,
    hasMore: data.hasMore,
    isSubscriber: data.isSubscriber,
  };
}

export async function getSubscriptionStatus(token?: string): Promise<SubscriptionStatusResponse | null> {
  if (!token) {
    return null;
  }

  try {
    const response = await fetch('/api/subscription-status', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Subscription status check failed:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Debug logging for promotional subscription diagnosis
    console.log('Raw subscription status API response:', data);
    
    // Normalize the response to ensure consistent format
    const normalized = {
      hasActiveSubscription: data.hasActiveSubscription || data.isSubscriber || false,
      status: data.status || 'none',
      isSubscriber: data.isSubscriber || data.hasActiveSubscription || data.unlimited || false,
      unlimited: data.unlimited || data.isSubscriber || data.hasActiveSubscription || false,
      usage: data.usage || { queriesRemaining: data.queriesRemaining || 2 }
    };
    
    console.log('Normalized subscription status:', normalized);
    console.log('Subscription normalization logic applied:', {
      originalIsSubscriber: data.isSubscriber,
      originalUnlimited: data.unlimited,
      originalHasActiveSubscription: data.hasActiveSubscription,
      normalizedIsSubscriber: normalized.isSubscriber,
      normalizedUnlimited: normalized.unlimited,
      shouldHaveProAccess: normalized.isSubscriber && normalized.unlimited
    });
    
    return normalized;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return null;
  }
}

export async function submitNotifyForm(payload: { name: string; email: string; subject: string; message: string }) {
  const res = await fetch('/api/save-form-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseJsonSafe(res);
  return res.json();
}
