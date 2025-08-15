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

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

export async function queryRia(query: string): Promise<QueryResponse> {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    if (response.status === 402) {
      throw { code: 'PAYMENT_REQUIRED', message: 'Credits exhausted' };
    }
    throw new Error(`Query failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Transform the response to match expected format
  const items = (data.sources || []).map((source: any) => ({
    name: source.legal_name,
    city: source.city,
    state: source.state,
    crdNumbers: [source.crd_number?.toString()].filter(Boolean),
    aum: source.vc_total_aum,
    vcFunds: source.vc_fund_count,
    vcAum: source.vc_total_aum,
  }));

  return {
    items,
    remaining: data.remaining,
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
