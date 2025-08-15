# Complete Frontend Action Plan for ria-hunter-app

## Strategic Foundation: Leveraging Existing Backend Systems

The backend analysis revealed that your application has sophisticated credit management, subscription validation, and authentication systems that are fully implemented and working correctly. However, your frontend has been accidentally connected to a legacy endpoint (`/api/ask`) that bypasses all this business logic, while the production endpoint (`/api/v1/ria/query`) contains all the sophisticated functionality you need.

This discovery transforms the integration challenge from building complex parallel systems into making strategic routing changes that connect your frontend to the production systems that already work correctly. Think of this like discovering your house has been running on backup power while the main electrical system has been working perfectly all along.

## Task 1: Implement Production API Integration

The backend team has provided a complete service adapter that handles all the complexity of connecting to the production endpoint while maintaining compatibility with your existing component structure.

### Create the Service Adapter

Create `app/services/ria.ts` with the production-ready adapter code:

```typescript
// app/services/ria.ts
export type QueryResultItem = {
  name: string
  city: string
  state: string
  aum?: number
  vcFunds?: number
  vcAum?: number
  crdNumbers?: string[]
};

export type QueryResponse = {
  items: QueryResultItem[]
  remaining: number
  isSubscriber: boolean
  relaxed: boolean
  relaxationLevel: 'state' | 'vector-only' | null
  resolvedRegion?: { city?: string|null; state?: string|null }
};

const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1'; // 'v1' | 'ask'
const USE_STREAM = false; // optional future toggle

export async function queryRia(userQuery: string): Promise<QueryResponse> {
  if (USE_STREAM) {
    // Future: wire /api/ask-stream (SSE) here if needed
  }

  if (API_VERSION === 'v1') {
    const res = await fetch('/api/v1/ria/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userQuery }),
      credentials: 'include', // Important: includes cookies for anonymous user tracking
    });
    if (res.status === 402) throw await res.json();
    if (!res.ok) throw await res.json();

    const data = await res.json();
    return {
      items: (data.results || []).map((r: any) => ({
        name: r.legal_name, 
        city: r.city, 
        state: r.state,
        aum: r.aum, 
        vcFunds: r.private_fund_count, 
        vcAum: r.private_fund_aum, 
        crdNumbers: r.crd_numbers
      })),
      remaining: data.remaining,
      isSubscriber: !!data.isSubscriber,
      relaxed: !!data.meta?.relaxed,
      relaxationLevel: data.meta?.relaxationLevel ?? null,
      resolvedRegion: data.meta?.resolvedRegion,
    };
  } else {
    // Legacy endpoint fallback
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userQuery }),
      credentials: 'include',
    });
    if (res.status === 402) throw await res.json();
    if (!res.ok) throw await res.json();

    const data = await res.json();
    return {
      items: (data.sources || []).map((r: any) => ({
        name: r.legal_name, 
        city: r.city, 
        state: r.state,
        aum: r.vc_total_aum ?? r.aum, 
        vcFunds: r.vc_fund_count, 
        vcAum: r.vc_total_aum
      })),
      remaining: data.metadata?.remaining ?? 0,
      isSubscriber: (data.metadata?.remaining === -1),
      relaxed: !!data.metadata?.relaxed,
      relaxationLevel: data.metadata?.relaxationLevel ?? null,
    };
  }
}

export async function getSubscriptionStatus() {
  const res = await fetch('/api/subscription-status', { credentials: 'include' });
  if (!res.ok) throw await res.json();
  return res.json(); // { unlimited, isSubscriber, subscription?, usage? }
}

export async function submitNotifyForm(payload: { name: string; email: string; subject: string; message: string }) {
  const res = await fetch('/api/save-form-data', {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}
```

This adapter accomplishes several important architectural goals. It provides type-safe interfaces for all API interactions, handles different response formats between endpoints, includes proper error handling, and creates a risk-free migration path through environment variables.

### Update the useAskApi Hook

Replace your existing `app/hooks/useApi.ts` with an implementation that uses the service adapter:

```typescript
// app/hooks/useApi.ts
import { useState, useCallback } from 'react';
import { queryRia, QueryResponse } from '@/services/ria';
import type { ApiError } from '@/lib/types';

export function useAskApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askQuestion = useCallback(async (query: string): Promise<QueryResponse | null> => {
    if (!query.trim()) return null;

    setIsLoading(true);
    setError(null);

    try {
      // Use the service adapter which automatically handles endpoint selection,
      // authentication, and response formatting based on environment configuration
      const response = await queryRia(query);
      return response;
    } catch (err: any) {
      // The service adapter throws structured errors for different failure types
      if (err.code === 'PAYMENT_REQUIRED') {
        setError('Credits exhausted - upgrade to continue');
      } else {
        setError(err.message || 'An error occurred while processing your query');
      }
      throw err; // Re-throw so components can handle 402 errors for upgrade flows
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { askQuestion, isLoading, error };
}
```

This implementation centralizes API logic in the service layer while maintaining backward compatibility with your existing component interfaces.

## Task 2: Implement Unified Credit and Subscription Management

Rather than building complex credit tracking logic, your frontend can now rely on the backend systems that already handle all subscription validation and credit management correctly.

### Create Simplified Credits Hook

Create `app/hooks/useCredits.ts`:

```typescript
// app/hooks/useCredits.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSubscriptionStatus } from '@/services/ria';

export function useCredits() {
  const { user, session } = useAuth();
  const [credits, setCredits] = useState<number>(2);
  const [isSubscriber, setIsSubscriber] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    if (!user || !session?.access_token) {
      // For unauthenticated users, start with default credits
      // The actual enforcement happens on the backend through cookies
      setCredits(2);
      setIsSubscriber(false);
      setLoading(false);
      return;
    }

    try {
      // Use the backend's subscription status endpoint which handles
      // all the complex subscription logic including trial periods,
      // active subscriptions, and usage tracking
      const status = await getSubscriptionStatus();
      
      if (status.unlimited || status.isSubscriber) {
        setCredits(-1); // Backend convention for unlimited access
        setIsSubscriber(true);
      } else {
        // For non-subscribers, the backend tracks usage accurately
        // and provides remaining query count
        setCredits(status.usage?.queriesRemaining || 2);
        setIsSubscriber(false);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      // Fallback to safe defaults rather than breaking the UI
      setCredits(user ? 2 : 2);
      setIsSubscriber(false);
    } finally {
      setLoading(false);
    }
  }, [user, session?.access_token]);

  // Update credits based on query responses since the backend
  // includes current status in every response
  const updateFromQueryResponse = useCallback((response: any) => {
    if (response.remaining !== undefined) {
      setCredits(response.remaining);
    }
    if (response.isSubscriber !== undefined) {
      setIsSubscriber(response.isSubscriber);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    credits: isSubscriber ? -1 : credits,
    isSubscriber,
    loading,
    refreshStatus: checkStatus,
    updateFromQueryResponse,
  };
}
```

This implementation serves primarily as a presentation layer that displays backend-provided status information, eliminating complex frontend business logic.

### Update ChatInterface Integration

Modify your existing `app/components/ChatInterface.tsx` to integrate with the backend credit system:

```typescript
// Add these imports to existing ChatInterface.tsx
import { useCredits } from '@/hooks/useCredits';

// In the ChatInterface component, add credit integration:
export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const { isLoading, error, askQuestion } = useAskApi();
  const { credits, isSubscriber, updateFromQueryResponse } = useCredits();

  const sendQuery = async (query: string) => {
    if (!query || isLoading) return;

    const userMessage: ChatMessage = { id: uuidv4(), role: 'user', content: query };
    const assistantPlaceholder: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      isLoading: true,
    };
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput('');

    try {
      // Use the service adapter which handles all backend communication
      // including authentication, credit checking, and response formatting
      const apiResponse = await askQuestion(query);
      
      if (apiResponse) {
        // Update credit display based on backend response which includes
        // current remaining credits and subscription status
        updateFromQueryResponse(apiResponse);
        
        // Transform the structured results into a natural language response
        const answerText = generateAnswerFromResults(apiResponse.items);
        
        // Create the assistant message with both text and structured sources
        const finalMessage: ChatMessage = {
          id: assistantPlaceholder.id,
          role: 'assistant',
          content: answerText,
          sources: apiResponse.items.map(item => ({
            crd_number: parseInt(item.crdNumbers?.[0] || '0'),
            legal_name: item.name,
            city: item.city,
            state: item.state,
            executives: [], // This comes from the detailed backend response
            vc_fund_count: item.vcFunds || 0,
            vc_total_aum: item.vcAum || 0,
            activity_score: 0, // Calculate based on available data
          })),
          isLoading: false,
        };
        
        setMessages((prev) => prev.map((msg) => (msg.id === finalMessage.id ? finalMessage : msg)));
        
        // Show relaxation banner if results were expanded geographically
        if (apiResponse.relaxed) {
          showRelaxationBanner(apiResponse);
        }
      }
    } catch (err: any) {
      // Handle specific error types from the service adapter
      let errorContent = '';
      
      if (err.code === 'PAYMENT_REQUIRED') {
        errorContent = isSubscriber 
          ? 'Your subscription may have expired. Please check your billing status.'
          : 'You\'ve used all your free queries. Upgrade to Pro for unlimited access to continue exploring RIA data.';
      } else {
        errorContent = 'I encountered an error processing your request. Please try again or rephrase your question.';
      }
      
      const errorMessage: ChatMessage = {
        id: assistantPlaceholder.id,
        role: 'assistant',
        content: errorContent,
        sources: [],
        isLoading: false,
      };
      
      setMessages((prev) => prev.map((msg) => (msg.id === errorMessage.id ? errorMessage : msg)));
    }
  };

  // Helper function to convert structured results into natural language
  const generateAnswerFromResults = (items: QueryResultItem[]) => {
    if (items.length === 0) {
      return "I couldn't find any RIAs matching your specific criteria. Try broadening your search terms or exploring different geographic regions.";
    }
    
    const topFirms = items.slice(0, 5);
    let answer = `I found ${items.length} RIA${items.length > 1 ? 's' : ''} matching your criteria. `;
    
    if (topFirms.length > 0) {
      answer += "Here are the top results:\n\n";
      topFirms.forEach((firm, index) => {
        answer += `${index + 1}. **${firm.name}** (${firm.city}, ${firm.state})`;
        if (firm.aum) answer += ` - $${(firm.aum / 1000000).toFixed(1)}M AUM`;
        if (firm.vcFunds) answer += ` - ${firm.vcFunds} private funds`;
        answer += '\n';
      });
    }
    
    return answer;
  };

  // Show relaxation banner when search results were geographically expanded
  const showRelaxationBanner = (response: QueryResponse) => {
    const message = response.relaxationLevel === 'vector-only'
      ? 'No exact geographic match found; showing semantically similar results.'
      : `No exact matches in ${response.resolvedRegion?.city || 'specified city'}; expanded to ${response.resolvedRegion?.state || 'state'} results.`;
    
    // Implement this as a toast notification or inline banner
    console.log('Search relaxation:', message);
    // You could add a toast library call here or set state for an inline banner
  };

  // Rest of your existing ChatInterface implementation
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await sendQuery(input.trim());
  };

  return (
    <div className="w-full">
      {/* Show credit warning for users approaching limits */}
      {!isSubscriber && credits <= 1 && credits > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-orange-800">
              {credits === 1 ? 'Last free query remaining' : 'Running low on credits'}
            </div>
            <button className="text-xs text-orange-600 hover:text-orange-800 font-medium">
              Upgrade to Pro
            </button>
          </div>
        </div>
      )}

      {/* Existing message rendering logic */}
      <div className="space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">Try one of these:</div>
            <QuerySuggestions onSelect={sendQuery} />
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={message.role === 'user' ? 'text-right' : 'text-left'}>
            {message.role === 'user' ? (
              <div className="inline-block bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[85%]">
                <p className="text-sm font-medium break-words">{message.content}</p>
              </div>
            ) : (
              <div className="inline-block bg-white rounded-2xl rounded-bl-md px-4 py-4 max-w-[95%] shadow-lg border border-gray-100">
                <AssistantMessage message={message} />
              </div>
            )}
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about RIAs…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!isSubscriber && credits <= 0}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || (!isSubscriber && credits <= 0)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {isLoading ? 'Asking…' : 'Ask'}
        </button>
      </form>
      {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
    </div>
  );
}
```

## Task 3: Simplify Credit Display Components

Update your existing credit display components to use the backend integration rather than complex local storage management.

### Update HeaderCredits Component

Replace the complex logic in `app/components/credits/HeaderCredits.tsx`:

```typescript
// app/components/credits/HeaderCredits.tsx
'use client';

import React from 'react';
import { useCredits } from '@/hooks/useCredits';

const HeaderCredits: React.FC = () => {
  const { credits, isSubscriber, loading } = useCredits();

  if (loading) return null;

  const displayText = isSubscriber || credits === -1 ? 'Unlimited' : `${credits} Credit${credits === 1 ? '' : 's'}`;
  const colorClass = isSubscriber || credits === -1 ? 'text-green-600' : 
                    credits === 0 ? 'text-red-600' : 
                    credits === 1 ? 'text-orange-600' : 'text-blue-600';

  return (
    <div className="flex items-center space-x-3">
      <div className="text-sm font-medium text-gray-700">
        <span className={`font-semibold ${colorClass}`}>
          {displayText}
        </span>
      </div>
    </div>
  );
};

export default HeaderCredits;
```

### Update CreditsCounter Component

Simplify `app/components/credits/CreditsCounter.tsx`:

```typescript
// app/components/credits/CreditsCounter.tsx
'use client';

import React from 'react';
import { useCredits } from '@/hooks/useCredits';

interface CreditsCounterProps {
  className?: string;
}

const CreditsCounter: React.FC<CreditsCounterProps> = ({ className = "" }) => {
  const { credits, isSubscriber, loading } = useCredits();

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-20 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  // For Pro subscribers - show unlimited status
  if (isSubscriber || credits === -1) {
    return (
      <div className={`bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-green-800">Pro Plan Active</h3>
              <p className="text-xs text-green-600">Unlimited queries</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-800">∞</div>
            <div className="text-xs text-green-600">Queries</div>
          </div>
        </div>
      </div>
    );
  }

  // For free users - show remaining credits
  const isLowCredits = credits <= 1;

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isLowCredits ? 'bg-orange-100' : 'bg-blue-100'
            }`}>
              <svg className={`w-5 h-5 ${isLowCredits ? 'text-orange-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div>
            <h3 className={`text-sm font-medium ${isLowCredits ? 'text-orange-800' : 'text-blue-800'}`}>
              Free Queries Remaining
            </h3>
            <p className={`text-xs ${isLowCredits ? 'text-orange-600' : 'text-blue-600'}`}>
              {isLowCredits ? 'Running low on credits!' : 'Use them wisely'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${isLowCredits ? 'text-orange-800' : 'text-blue-800'}`}>
            {credits}
          </div>
          <div className={`text-xs ${isLowCredits ? 'text-orange-600' : 'text-blue-600'}`}>
            Credits
          </div>
        </div>
      </div>
      
      {credits === 0 && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="text-center">
            <p className="text-sm text-blue-700 font-medium">Ready for unlimited access?</p>
            <button 
              onClick={() => {
                // Implement your upgrade flow here
                window.location.href = '/pricing';
              }}
              className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditsCounter;
```

### Update SystemStatus Component

Update `app/components/SystemStatus.tsx` to check the production backend:

```typescript
// In app/components/SystemStatus.tsx, replace the useEffect:
useEffect(() => {
  const check = async () => {
    try {
      // Check the production backend health endpoint instead of the legacy ask endpoint
      const backendUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL || '';
      const healthEndpoint = backendUrl ? 
        `${backendUrl.replace(/\/$/, '')}/api/debug/health` : 
        '/api/debug/health';
        
      const res = await fetch(healthEndpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const data = await res.json();
        // The backend health endpoint returns structured status information
        const isHealthy = data.status === 'healthy' && 
          data.openai?.status === 'healthy' && 
          data.supabase?.status === 'healthy';
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

## Task 4: Environment Configuration and Deployment

The backend team has designed the integration to minimize configuration complexity while maximizing deployment flexibility.

### Environment Variable Setup

Add the following to your `.env.local` file:

```bash
# API Integration Configuration
NEXT_PUBLIC_API_VERSION=v1

# Backend URL (only needed if backend runs on different domain)
NEXT_PUBLIC_RIA_HUNTER_API_URL=http://localhost:8000

# These should already be configured from your existing setup:
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# STRIPE_SECRET_KEY=your_stripe_secret
# STRIPE_WEBHOOK_SECRET=your_webhook_secret
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_public_key
```

For production deployment, ensure these environment variables are configured in your deployment platform (Vercel):

```bash
# Production Environment Variables for Vercel
NEXT_PUBLIC_API_VERSION=v1
NEXT_PUBLIC_RIA_HUNTER_API_URL=https://your-production-backend.com
# ... other existing production variables
```

The `NEXT_PUBLIC_API_VERSION` variable creates a safe migration path. You can deploy all the new integration code while initially keeping it pointed at the legacy endpoint by setting this to 'ask'. Once you verify everything works correctly, switch to the production endpoint by changing this value to 'v1'.

## Task 5: Testing and Validation Protocol

Follow this comprehensive testing protocol to ensure all components work together correctly.

### Anonymous User Testing

Open an incognito browser window and test the anonymous user experience:

1. Navigate to your application
2. Verify the credit counter shows "2 Credits"
3. Make your first query
4. Verify the credit counter updates to "1 Credit"
5. Make your second query
6. Verify the credit counter shows "0 Credits"
7. Attempt a third query
8. Verify you receive a 402 error with upgrade messaging

### Authenticated Free User Testing

Sign in with Google and test the authenticated free user experience:

1. Sign in and verify credit counter updates appropriately
2. Make queries and verify credits decrement correctly
3. Test hitting the credit limit
4. Verify upgrade prompts appear when credits are exhausted

### Pro Subscriber Testing

Test with a Pro subscriber account (or temporarily modify subscription status):

1. Sign in as Pro user
2. Verify credit counter immediately shows "Unlimited"
3. Make multiple queries
4. Verify credits never decrement
5. Verify no upgrade prompts appear

### Geographic Query Testing

Test the relaxation handling feature:

1. Search for "Top RIAs in Saint Louis, MO"
2. If no exact city matches exist, verify a helpful banner explains state-level expansion
3. Try queries with very specific geographic constraints
4. Verify the system explains when results are broadened

### Subscription Status Testing

Test subscription status synchronization:

1. Check subscription status at application load
2. Verify status updates correctly after subscription changes
3. Test with expired subscriptions
4. Verify appropriate messaging for different subscription states

## Task 6: User Experience Improvements

With the core integration working, implement user experience improvements that make the application feel professional.

### Implement Query Suggestions

Update `app/components/QuerySuggestions.tsx` with queries that work well with your current dataset:

```typescript
// Update the default suggestions to match your dataset capabilities
const DEFAULT_SUGGESTIONS: string[] = [
  'Top RIAs by VC funds in Saint Louis, MO',
  'RIAs in Missouri with private funds and executives',
  'Show RIAs with > $500M AUM in Texas',
  'Private fund managers in California',
  'RIAs in New York with highest activity scores'
];
```

Avoid time-based qualifiers like "recently" since your dataset doesn't include temporal information about when funds were added.

### Implement Upgrade Flow

Create a clean upgrade experience for users who hit credit limits:

```typescript
// Add to your existing upgrade components or create new ones
const handleUpgradeFlow = (errorResponse: any) => {
  if (errorResponse.code === 'PAYMENT_REQUIRED') {
    const message = errorResponse.isSubscriber
      ? 'Your subscription may have expired. Please check your billing status.'
      : 'Ready for unlimited queries? Upgrade to Pro to continue exploring RIA data without limits.';
    
    // Redirect to your pricing page or show upgrade modal
    window.location.href = '/pricing';
  }
};
```

### Remove Unbuilt Features

Hide or remove features that aren't implemented yet to avoid user confusion:

1. Hide "Save Search History" toggle in settings
2. Remove "Auto-save Results" toggle 
3. Ensure sign-out doesn't show "Subscription Cancelled" messaging
4. Update any placeholder text that references unbuilt features

## Task 7: Integration Verification

After implementing all changes, verify the complete integration works correctly:

### Functional Verification Checklist

- [ ] Users can make queries and receive structured responses with source citations
- [ ] Credit system accurately tracks usage for free users
- [ ] Pro subscribers see unlimited access without credit limitations
- [ ] Authentication works seamlessly without manual token management
- [ ] Error messages are clear and actionable
- [ ] Subscription status updates correctly after billing changes

### Technical Verification Checklist

- [ ] Browser Network tab shows requests to `/api/v1/ria/query` (not `/api/ask`)
- [ ] Requests include proper authentication headers
- [ ] Responses include credit information and subscription status
- [ ] Error handling works for 402 (payment required) responses
- [ ] Geographic relaxation banners appear when appropriate
- [ ] All TypeScript compilation errors are resolved

### User Experience Verification Checklist

- [ ] Application feels responsive with appropriate loading states
- [ ] Free users understand their credit limitations clearly
- [ ] Pro users experience unlimited access without friction
- [ ] Upgrade prompts are helpful and appropriately timed
- [ ] Geographic query explanations are clear and educational

## Success Criteria and Benefits

After completing this action plan, your frontend will transform from a system struggling with integration challenges into a clean presentation layer that showcases sophisticated backend capabilities. The result will be:

**Simplified Architecture**: Your frontend becomes primarily a presentation layer that displays backend-provided information, eliminating complex business logic duplication.

**Improved Reliability**: By leveraging tested backend systems rather than building parallel logic, you reduce the possibility of synchronization issues and bugs.

**Better User Experience**: Users receive consistent behavior throughout the application because everything uses the same backend business logic.

**Easier Maintenance**: Future feature development follows a clear pattern of implementing business logic in the backend and creating presentation components in the frontend.

**Professional Feel**: The application provides clear feedback, appropriate error handling, and smooth user flows that make it feel polished and reliable.

The strategic insight that drives this entire plan is understanding that the sophisticated systems you need already exist and work correctly. Rather than building complex parallel systems in the frontend, this plan connects your presentation layer to the production backend systems that already handle authentication, subscription management, credit tracking, and query processing properly. This approach results in a more maintainable, reliable, and professional application that showcases the excellent backend work that has already been completed.