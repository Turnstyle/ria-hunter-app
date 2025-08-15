# Complete Frontend Integration and Production Readiness Plan for RIA Hunter App

This comprehensive plan will systematically address all the issues preventing your RIA Hunter application from functioning properly in production. We'll approach this like building a house—starting with the foundation (the backend connection) and working our way up to the user experience details.

## Understanding the Current State

Before we begin implementing fixes, let's understand what's happening in your application. You've correctly identified that the infinite loop problem was caused by environment variable confusion, and you've taken the right first step by creating the dedicated `RIA_HUNTER_BACKEND_URL` variable. However, several components throughout your application still need to be updated to use this new configuration, and there are subscription status detection issues that go beyond just the environment variables.

The core problem you're experiencing stems from a disconnect between what your frontend thinks about user subscription status and what's actually stored in your backend systems. Think of it like having a car where the dashboard shows you're out of gas, but the tank is actually full—the problem isn't with the fuel system, it's with the gauge that reads the fuel level.

## Phase 1: Fix the Backend Connection Infrastructure

### Task 1.1: Update All Proxy Routes to Use New Backend URL

The most critical step is ensuring all your API proxy routes use the new server-only environment variable instead of the client-side variable that was causing the infinite loop.

**Files to modify:**

**app/api/v1/ria/query/route.ts** - Update line 8:
```typescript
// Current problematic code:
const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;

// Replace with:
const backendBaseUrl = process.env.RIA_HUNTER_BACKEND_URL;
```

**app/api/ask/route.ts** - Update line 29:
```typescript
// Current problematic code:
const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;

// Replace with:
const backendBaseUrl = process.env.RIA_HUNTER_BACKEND_URL;
```

**app/api/ask-stream/route.ts** - Update line 8:
```typescript
// Current problematic code:
const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;

// Replace with:
const backendBaseUrl = process.env.RIA_HUNTER_BACKEND_URL;
```

**app/api/subscription-status/route.ts** - Update line 45:
```typescript
// Current problematic code:
const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;

// Replace with:
const backendBaseUrl = process.env.RIA_HUNTER_BACKEND_URL;
```

**app/api/funds/summary/[id]/route.ts** - Update line 12:
```typescript
// Current problematic code:
const backendBase = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL

// Replace with:
const backendBase = process.env.RIA_HUNTER_BACKEND_URL
```

### Task 1.2: Add Robust Error Handling to All Proxy Routes

After updating the environment variables, we need to ensure each proxy route has proper error handling when the backend URL is not configured.

For each proxy route file, ensure this pattern is followed:
```typescript
const backendBaseUrl = process.env.RIA_HUNTER_BACKEND_URL;
if (!backendBaseUrl) {
  console.error('RIA_HUNTER_BACKEND_URL not configured in environment variables');
  return NextResponse.json({ error: 'Backend configuration missing' }, { status: 500 });
}
```

### Task 1.3: Verify Client-Side Health Check Configuration

**app/components/SystemStatus.tsx** should continue using the client-side environment variable, but we need to modify it to properly handle the health check:

```typescript
// Update the useEffect in SystemStatus.tsx to use frontend proxy
useEffect(() => {
  const check = async () => {
    try {
      // Always use same-origin proxy to avoid CORS
      const res = await fetch('/api/debug/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const data = await res.json();
        // Check if the health response indicates system is healthy
        const isHealthy = data.ok === true || data.status === 'healthy';
        setBackend(isHealthy ? 'healthy' : 'degraded');
      } else {
        setBackend('degraded');
      }
    } catch {
      setBackend('error');
    }
  };
  
  check();
  const t = setInterval(check, 30000);
  return () => clearInterval(t);
}, []);
```

## Phase 2: Fix Subscription Status Detection and Credits System

### Task 2.1: Create Unified Subscription Service

The subscription status is not being properly detected because different parts of your application are calling different endpoints and parsing responses inconsistently. We need to create a unified service that all components can use.

**Create app/services/ria.ts** (this file appears to be missing):
```typescript
interface SubscriptionStatusResponse {
  hasActiveSubscription: boolean;
  status: string;
  isSubscriber: boolean;
  unlimited: boolean;
  usage?: {
    queriesRemaining: number;
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
    
    // Normalize the response to ensure consistent format
    return {
      hasActiveSubscription: data.hasActiveSubscription || data.isSubscriber || false,
      status: data.status || 'none',
      isSubscriber: data.isSubscriber || data.hasActiveSubscription || data.unlimited || false,
      unlimited: data.unlimited || data.isSubscriber || data.hasActiveSubscription || false,
      usage: data.usage || { queriesRemaining: data.queriesRemaining || 2 }
    };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return null;
  }
}

// Query interface for RIA searches
export interface QueryResponse {
  items: QueryResultItem[];
  remaining?: number;
  isSubscriber?: boolean;
  relaxed?: boolean;
  relaxationLevel?: string;
  resolvedRegion?: any;
}

export interface QueryResultItem {
  name: string;
  city: string;
  state: string;
  crdNumbers?: string[];
  aum?: number;
  vcFunds?: number;
  vcAum?: number;
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
```

### Task 2.2: Fix the Credits Hook

**Update app/hooks/useCredits.ts** to use the unified service and properly handle Pro subscribers:

```typescript
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
```

### Task 2.3: Update Header Credits Display

**Update app/components/credits/HeaderCredits.tsx** to properly show unlimited for Pro subscribers:

```typescript
'use client';

import React from 'react';
import { useCredits } from '@/hooks/useCredits';

const HeaderCredits: React.FC = () => {
  const { credits, isSubscriber, loading } = useCredits();

  if (loading) return null;

  // For Pro subscribers, always show "Unlimited"
  if (isSubscriber || credits === -1) {
    return (
      <div className="flex items-center space-x-3">
        <div className="text-sm font-medium text-gray-700">
          <span className="font-semibold text-green-600">
            Unlimited
          </span>
        </div>
      </div>
    );
  }

  // For free users, show remaining credits with appropriate styling
  const colorClass = credits === 0 ? 'text-red-600' : 
                    credits === 1 ? 'text-orange-600' : 'text-blue-600';

  return (
    <div className="flex items-center space-x-3">
      <div className="text-sm font-medium text-gray-700">
        <span className={`font-semibold ${colorClass}`}>
          {credits} Credit{credits === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
};

export default HeaderCredits;
```

### Task 2.4: Remove System Status from Production

**Update app/components/layout/Header.tsx** to remove the SystemStatus component from production:

```typescript
// Remove this import:
// import { SystemStatus } from '@/app/components/SystemStatus';

// In the JSX, remove this line:
// <SystemStatus />

// The header should show only credits and auth, not system status
<div className="flex items-center space-x-2">
  {loading ? (
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  ) : (
    <>
      <HeaderCredits />
      <div className="hidden sm:block">
        {user ? <UserMenu /> : <LoginButton />}
      </div>
      {/* Mobile menu button remains unchanged */}
    </>
  )}
</div>
```

## Phase 3: Fix Usage & Billing Page

### Task 3.1: Update Subscription Details Component

**Update app/components/subscription/SubscriptionDetails.tsx** to properly detect Pro status and show correct CTA:

```typescript
'use client'

import React, { useEffect, useState } from 'react'
import UpgradeButton from '@/app/components/subscription/UpgradeButton'
import { useAuth } from '@/app/contexts/AuthContext'
import { useCredits } from '@/hooks/useCredits'

interface SubscriptionDetailsProps {
  userId: string
}

export default function SubscriptionDetails({ userId }: SubscriptionDetailsProps) {
  const { session } = useAuth()
  const { isSubscriber, subscriptionStatus, loading: creditsLoading } = useCredits()
  const [loading, setLoading] = useState(true)
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null)

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true)
        const headers: Record<string, string> = {}
        const accessToken = session?.access_token
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }

        const resp = await fetch('/api/subscription-status', {
          cache: 'no-store',
          headers,
        })
        
        if (!resp.ok) {
          console.error('Failed to load subscription details')
          return
        }
        
        const data = await resp.json()
        setSubscriptionDetails(data)
      } catch (e: any) {
        console.error('Error loading subscription details:', e)
      } finally {
        setLoading(false)
      }
    }
    
    if (!creditsLoading) {
      loadDetails()
    }
  }, [userId, session?.access_token, creditsLoading])

  if (loading || creditsLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse h-5 bg-gray-200 w-40 rounded" />
      </div>
    )
  }

  // Determine display status
  const displayStatus = isSubscriber ? 'Pro Subscriber' : 
                       subscriptionStatus === 'none' ? 'Free Plan' : 
                       subscriptionStatus;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Subscription</h2>
      <div className="text-sm text-gray-900">Status: {displayStatus}</div>
      
      {subscriptionDetails?.subscription?.current_period_end && (
        <div className="text-xs text-gray-600 mt-1">
          Renews: {new Date(subscriptionDetails.subscription.current_period_end).toLocaleDateString()}
        </div>
      )}
      
      <div className="mt-4">
        {isSubscriber ? (
          <ManageBillingButton />
        ) : (
          <UpgradeButton buttonText="Upgrade to Pro" />
        )}
      </div>
    </div>
  )
}

function ManageBillingButton() {
  const { session } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (!session?.access_token) return
    setIsLoading(true)
    try {
      const resp = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const data = await resp.json()
      if (!resp.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to open billing portal')
      }
      window.location.href = data.url
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to open billing portal')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
    >
      {isLoading ? 'Opening…' : 'Manage Billing'}
    </button>
  )
}
```

### Task 3.2: Create Stripe Portal Session Endpoint

If it doesn't exist, create **app/api/create-portal-session/route.ts**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
    })
  : null;

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the user token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get the customer's Stripe customer ID from your database
    // This assumes you have it stored in the subscriptions table
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.ria-hunter.app'}/usage-billing`,
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
```

## Phase 4: Implement Browse Page with Premium Features

### Task 4.1: Create Browse Page with Filtering

**Create app/browse/page.tsx**:

```typescript
'use client';

import { useState } from 'react';
import { useCredits } from '@/hooks/useCredits';
import UpgradeButton from '@/app/components/subscription/UpgradeButton';

interface FilterOptions {
  fundType: string;
  aumRange: string;
  location: string;
}

interface RIAResult {
  id: string;
  name: string;
  location: string;
  aum: number;
  fundTypes: string[];
}

export default function BrowsePage() {
  const { isSubscriber } = useCredits();
  const [filters, setFilters] = useState<FilterOptions>({
    fundType: '',
    aumRange: '',
    location: ''
  });
  const [results, setResults] = useState<RIAResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fundTypeOptions = [
    { value: '', label: 'All Fund Types' },
    { value: 'vc', label: 'Venture Capital' },
    { value: 'pe', label: 'Private Equity' },
    { value: 'cre', label: 'Commercial Real Estate' },
    { value: 'hedge', label: 'Hedge Funds' },
    { value: 'other', label: 'Other Private Funds' }
  ];

  const aumRangeOptions = [
    { value: '', label: 'Any AUM' },
    { value: '0-100m', label: 'Under $100M' },
    { value: '100m-1b', label: '$100M - $1B' },
    { value: '1b-10b', label: '$1B - $10B' },
    { value: '10b+', label: 'Over $10B' }
  ];

  const handleSearch = async () => {
    if (!isSubscriber) {
      return; // This will be handled by the UI to show upgrade prompt
    }

    setLoading(true);
    setHasSearched(true);
    
    try {
      // This would call your backend search endpoint with filters
      const response = await fetch('/api/ria-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fundType: filters.fundType,
          aumRange: filters.aumRange,
          location: filters.location
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse RIAs</h1>
          <p className="text-gray-600">
            Advanced filtering and search capabilities for Registered Investment Advisors
          </p>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Filters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Private Fund Type
              </label>
              <select
                value={filters.fundType}
                onChange={(e) => setFilters({...filters, fundType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isSubscriber}
              >
                {fundTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assets Under Management
              </label>
              <select
                value={filters.aumRange}
                onChange={(e) => setFilters({...filters, aumRange: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isSubscriber}
              >
                {aumRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={filters.location}
                onChange={(e) => setFilters({...filters, location: e.target.value})}
                placeholder="City, State"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isSubscriber}
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={handleSearch}
              disabled={loading || !isSubscriber}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                isSubscriber 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Searching...' : 'Search RIAs'}
            </button>

            {!isSubscriber && (
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-2">
                  Upgrade to Pro for advanced search capabilities
                </p>
                <UpgradeButton size="sm" buttonText="Upgrade Now" />
              </div>
            )}
          </div>
        </div>

        {/* Upgrade Prompt for Non-Subscribers */}
        {!isSubscriber && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Unlock Advanced RIA Search
                </h3>
                <p className="text-blue-700 mb-4">
                  Get unlimited access to filter RIAs by fund type, AUM range, geographic location, and more. 
                  Perfect for finding investment opportunities and conducting market research.
                </p>
                <ul className="text-sm text-blue-600 space-y-1">
                  <li>• Filter by private fund types (VC, PE, CRE, Hedge)</li>
                  <li>• Search by assets under management ranges</li>
                  <li>• Geographic and demographic filtering</li>
                  <li>• Export results and detailed firm profiles</li>
                  <li>• Unlimited searches and queries</li>
                </ul>
              </div>
              <div className="ml-6">
                <UpgradeButton 
                  variant="primary" 
                  size="lg" 
                  buttonText="Start Pro Trial" 
                />
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {hasSearched && isSubscriber && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Search Results ({results.length} found)
            </h2>
            
            {results.length > 0 ? (
              <div className="space-y-4">
                {results.map((ria) => (
                  <div key={ria.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{ria.name}</h3>
                        <p className="text-gray-600">{ria.location}</p>
                        <p className="text-sm text-gray-500">
                          AUM: ${(ria.aum / 1000000).toFixed(1)}M
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ria.fundTypes.map((type) => (
                          <span 
                            key={type}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No RIAs found matching your criteria. Try adjusting your filters.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Task 4.2: Create RIA Search Backend Endpoint

**Create app/api/ria-search/route.ts**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers as nextHeaders } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const reqHeaders = await nextHeaders();
    const requestId = reqHeaders?.get?.('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const backendBaseUrl = process.env.RIA_HUNTER_BACKEND_URL;
    if (!backendBaseUrl) {
      return NextResponse.json({ error: 'Backend URL not configured' }, { status: 500 });
    }

    // Extract auth token from cookies
    let authHeader = request.headers.get('authorization') || undefined;
    const body = await request.json().catch(() => ({}));

    if (!authHeader) {
      try {
        const cookieStore = await cookies();
        const directToken = (cookieStore as any)?.get?.('sb-access-token')?.value;
        if (directToken) {
          authHeader = `Bearer ${directToken}`;
        } else {
          const all = ((cookieStore as any)?.getAll?.() ?? []) as Array<{ name: string; value: string }>;
          const sbCookie = all.find(c => c.name.includes('sb-') && c.name.includes('auth')) || all.find(c => c.name.startsWith('sb-'));
          if (sbCookie?.value) {
            try {
              const parsed: any = JSON.parse(sbCookie.value);
              if (parsed?.access_token) {
                authHeader = `Bearer ${parsed.access_token}`;
              }
            } catch {
              authHeader = `Bearer ${sbCookie.value}`;
            }
          }
        }
      } catch {}
    }

    const base = backendBaseUrl.replace(/\/$/, '');
    const url = `${base}/api/v1/ria/search`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        'x-request-id': requestId,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await resp.text();
    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json, { status: resp.status });
    } catch {
      return new NextResponse(text, { 
        status: resp.status, 
        headers: { 'Content-Type': resp.headers.get('content-type') || 'text/plain' } 
      });
    }
  } catch (error) {
    console.error('RIA search proxy error:', error);
    return NextResponse.json({ error: 'Search proxy failed' }, { status: 500 });
  }
}
```

## Phase 5: Testing and Verification

### Task 5.1: Create Systematic Testing Plan

After implementing all the above changes, follow this testing sequence:

1. **Backend Connection Test**
   - Load the main page and verify no infinite loops occur
   - Check browser console for errors
   - Verify health check endpoint responds correctly

2. **Authentication Flow Test**
   - Sign in with Google OAuth
   - Verify user session is maintained across page refreshes
   - Test sign out functionality

3. **Subscription Status Test**
   - For Pro subscribers: Verify "Unlimited" shows in header
   - For Pro subscribers: Verify Usage & Billing shows "Pro Subscriber" status
   - For Pro subscribers: Verify CTA shows "Manage Billing" not "Upgrade"
   - For free users: Verify credit count shows correctly

4. **Chat Functionality Test**
   - Test sending queries as both Pro and free users
   - Verify credit deduction for free users
   - Verify unlimited access for Pro subscribers
   - Test error handling for various scenarios

5. **Browse Page Test**
   - Verify Pro subscribers can use all filtering options
   - Verify free users see upgrade prompts
   - Test the upgrade flow from Browse page

### Task 5.2: Production Deployment Checklist

Before considering the fixes complete, verify:

- All environment variables are set correctly in Vercel
- No console errors appear in production
- All API endpoints respond correctly
- Subscription status detection works reliably
- Credit counting is accurate
- Upgrade flows direct to Stripe correctly
- Billing portal redirects work properly

### Task 5.3: Monitor Key Metrics

After deployment, monitor these metrics to ensure everything is working:

- API response times and error rates
- User session persistence
- Subscription status accuracy
- Payment flow completion rates
- Customer support tickets related to billing issues

## Phase 6: Future Enhancements

### Task 6.1: Additional Browse Features

Once the core functionality is stable, consider adding:

- Export functionality for search results
- Saved search preferences
- Advanced analytics for RIA market trends
- Comparison tools for multiple RIAs
- Integration with external data sources

### Task 6.2: Performance Optimizations

- Implement caching for frequently accessed subscription status
- Add loading states for better user experience
- Optimize API calls to reduce redundant requests
- Implement retry logic for failed requests

This comprehensive plan addresses all the identified issues systematically, ensuring your RIA Hunter application functions correctly in production with proper subscription handling, accurate credit tracking, and enhanced user experience features.