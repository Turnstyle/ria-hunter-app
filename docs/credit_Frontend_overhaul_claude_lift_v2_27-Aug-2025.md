# Credit System Overhaul: AI Agent Execution Plan
## RIA Hunter Frontend Migration - August 27, 2025

### Executive Summary

This plan details the complete migration from RIA Hunter's complex credit-based system to a streamlined session-based demo mode. The backend has already been simplified to use a single `rh_demo` cookie (0-5) for anonymous users and unlimited access for authenticated subscribers. This frontend migration will remove ~2,000 lines of credit management code and replace it with simple session tracking.

**Migration Scope**: Remove credit ledger complexity, eliminate localStorage persistence, simplify error handling, and implement clean demo limit messaging.

---

## Phase 1: Create New Session Management System (Day 1)

### Step 1.1: Create useSessionDemo Hook

**File**: `app/hooks/useSessionDemo.ts` (NEW FILE)

```typescript
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
  
  const { user, session } = useAuth();
  
  // Simplified refresh - no caching, no localStorage
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/_backend/api/session/status', {
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
```

### Step 1.2: Create Compatibility Layer

**File**: `app/hooks/useCreditsCompat.ts` (NEW FILE - Temporary)

```typescript
'use client';

// Temporary compatibility layer for gradual migration
import { useSessionDemo } from './useSessionDemo';

export function useCredits() {
  const session = useSessionDemo();
  
  // Map new interface to old interface for compatibility
  return {
    credits: session.searchesRemaining,
    isSubscriber: session.isSubscriber,
    isLoadingCredits: session.isLoading,
    isSubmitting: session.isLoading,
    error: session.error,
    refreshCredits: session.refreshStatus,
    updateFromResponse: session.updateFromResponse
  };
}
```

---

## Phase 2: Update API Client (Day 2)

### Step 2.1: Modify API Client

**File**: `app/lib/api/client.ts`

**Changes Required**:
1. Remove credit-specific request preparation
2. Update response parsing for new metadata structure
3. Simplify error handling
4. Remove credit deduction logic

```typescript
// Remove these credit-related methods:
// - getCreditsBalance()
// - getCreditsDebug() 
// - deductCredits()

// Update askStream method to handle new metadata:
// - searchesRemaining instead of credits
// - searchesUsed tracking
// - Simplified error messages for 402 responses

// New error message for 402:
"You've used your 5 free demo searches. Create a free account to continue exploring RIA Hunter with unlimited searches for 7 days."
```

### Step 2.2: Update Response Schema

**File**: `app/lib/api/client.ts`

```typescript
// Update AskResponseSchema
const AskResponseSchema = z.object({
  answer: z.string().optional(),
  results: z.array(z.any()).optional(),
  sources: z.array(z.any()).optional(),
  metadata: z.object({
    searchesRemaining: z.number(),
    searchesUsed: z.number(), 
    isSubscriber: z.boolean(),
    searchStrategy: z.enum(['ai_semantic', 'structured_query']).optional()
  }).optional()
});
```

---

## Phase 3: Update UI Components (Day 3-4)

### Step 3.1: Update ChatInterface

**File**: `app/components/ChatInterface.tsx`

**Key Changes**:
```typescript
// Replace useCredits with useSessionDemo
import { useSessionDemo } from '@/app/hooks/useSessionDemo';

const { searchesRemaining, isSubscriber, canSearch, updateFromResponse } = useSessionDemo();

// Update pre-flight check:
if (!canSearch) {
  setError("You've used your 5 free demo searches. Create a free account to continue exploring RIA Hunter with unlimited searches for 7 days.");
  return;
}

// Update credits display:
{!isSubscriber && searchesRemaining !== null && (
  <p className="mt-2 text-sm text-gray-600">
    {searchesRemaining} free searches remaining
  </p>
)}
```

### Step 3.2: Update HeaderCredits

**File**: `app/components/credits/HeaderCredits.tsx`

```typescript
// Replace with useSessionDemo
import { useSessionDemo } from '@/app/hooks/useSessionDemo';

export function HeaderCredits() {
  const { searchesRemaining, isSubscriber, isLoading } = useSessionDemo();
  
  if (isSubscriber) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-green-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
          Pro
        </div>
        <span className="text-sm font-semibold text-green-600">Unlimited Searches</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center space-x-2 text-gray-600">
      <span className="text-sm font-semibold">
        {searchesRemaining ?? 5} Free Searches Left
      </span>
      <a href="/signup" className="text-xs underline hover:no-underline">
        Get Unlimited
      </a>
    </div>
  );
}
```

### Step 3.3: Update CreditsCounter

**File**: `app/components/credits/CreditsCounter.tsx`

```typescript
// Simplify to show demo searches or unlimited
const CreditsCounter = ({ className = "" }) => {
  const { searchesRemaining, isSubscriber, isLoading } = useSessionDemo();

  if (isSubscriber) {
    return (
      <div className={`bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-green-800">Pro Account</h3>
          <p className="text-green-600">Unlimited AI-powered searches</p>
        </div>
      </div>
    );
  }

  const remaining = searchesRemaining ?? 5;
  
  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="text-center">
        <div className="text-3xl font-bold text-blue-800 mb-2">
          {remaining}
        </div>
        <h3 className="text-lg font-semibold text-blue-800">Free Searches Left</h3>
        <p className="text-sm text-blue-600 mb-4">
          {remaining === 0 ? 'Demo limit reached' : 'Explore RIA Hunter'}
        </p>
        
        {remaining === 0 && (
          <a
            href="/signup" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Get Unlimited Access
          </a>
        )}
      </div>
    </div>
  );
};
```

---

## Phase 4: Remove Legacy Code (Day 5-6)

### Step 4.1: Delete Credit System Files

**Files to DELETE**:
```
app/hooks/useCredits.ts
app/hooks/useCreditsCompat.ts  
app/api/credits/balance/route.ts
app/api/credits/deduct/route.ts
app/api/credits/debug/route.ts
app/components/credits/CreditsDebug.tsx
app/credits/debug/page.tsx
```

### Step 4.2: Remove Credit API Client Methods

**File**: `app/lib/api/client.ts`

**Remove these methods**:
- `getCreditsBalance()`
- `getCreditsDebug()`
- `deductCredits()`
- Any credit-related error handling
- Credit-specific retry logic

### Step 4.3: Update Import Statements

**Search and Replace Across Codebase**:
```bash
# Replace all useCredits imports
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/useCredits/useSessionDemo/g'

# Update import paths
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i 's/@\/app\/hooks\/useCredits/@\/app\/hooks\/useSessionDemo/g'
```

---

## Phase 5: Error Handling & Messaging (Day 7)

### Step 5.1: Standardize Error Messages

**Error Message Templates**:

```typescript
// 402 Response Handler
const DEMO_LIMIT_MESSAGE = "You've used your 5 free demo searches. Create a free account to continue exploring RIA Hunter with unlimited searches for 7 days.";

// UI Error Display Component
const DemoLimitReached = () => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
    <h3 className="text-lg font-semibold text-blue-800 mb-2">
      Demo Limit Reached
    </h3>
    <p className="text-blue-700 mb-4">
      {DEMO_LIMIT_MESSAGE}
    </p>
    <div className="space-x-3">
      <a 
        href="/signup"
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Create Free Account
      </a>
      <a 
        href="/pricing"
        className="inline-flex items-center px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
      >
        View Pricing
      </a>
    </div>
  </div>
);
```

### Step 5.2: Update Error Boundaries

**File**: `app/components/ErrorBoundary.tsx` (if exists)

Remove credit-specific error handling and simplify to handle:
- Demo limit reached (402)
- Authentication required (401) 
- Rate limiting (429)
- Server errors (5xx)

---

## Phase 6: Testing & Validation (Day 8)

### Step 6.1: Test Scenarios

**Anonymous User Flow**:
1. Visit site → Should see "5 free searches remaining"
2. Perform 1-4 searches → Counter decrements correctly
3. Perform 5th search → Should see demo limit message
4. Attempt 6th search → Should be blocked with upgrade prompt

**Authenticated User Flow**:
1. Sign up/login → Should see "Unlimited searches"
2. Perform searches → No counter, no limits
3. UI shows "Pro" badge and unlimited messaging

**Edge Cases**:
1. Network failures → Graceful fallback to default values
2. Invalid backend responses → Error handling without crashes
3. Session expiration → Proper re-authentication flow

### Step 6.2: Performance Validation

**Metrics to Monitor**:
- Page load times (should improve with less localStorage operations)
- API response times (should improve with simplified backend)
- Memory usage (should decrease with removal of BroadcastChannel)
- Bundle size reduction from deleted code

---

## Phase 7: Final Cleanup & Documentation (Day 9)

### Step 7.1: Update Documentation

**Files to Update**:
- README.md → Remove credit system documentation
- API documentation → Update with new session endpoints
- Component documentation → Reflect simplified state management

### Step 7.2: Environment Variables Cleanup

**Remove Unused Variables**:
```bash
# From .env files, remove:
CREDITS_CACHE_DURATION
CREDITS_STORAGE_KEY  
CREDITS_BROADCAST_CHANNEL
```

### Step 7.3: Bundle Analysis

**Verify Code Reduction**:
```bash
# Before migration bundle size
npm run build -- --analyze

# After migration bundle size (should be significantly smaller)
npm run build -- --analyze
```

---

## Risk Mitigation Strategies

### Rollback Plan

**Feature Flag Implementation** (Temporary):
```typescript
// app/config/features.ts
export const FEATURES = {
  USE_SESSION_DEMO: process.env.NEXT_PUBLIC_USE_SESSION_DEMO === 'true'
};

// In components:
const creditSystem = FEATURES.USE_SESSION_DEMO ? useSessionDemo() : useCredits();
```

### Monitoring & Alerts

**Key Metrics to Watch**:
- 402 error frequency (should remain stable)
- User signup conversion from demo limit prompts
- API error rates during transition
- User session duration and engagement

### Gradual Rollout

**Deployment Strategy**:
1. Deploy with feature flag OFF (keeps existing system)
2. Enable for 10% of users, monitor metrics
3. Gradually increase to 50%, then 100%
4. Remove feature flag and legacy code after 48h stability

---

## Success Criteria

### Technical Success Metrics

- ✅ 40% reduction in frontend codebase complexity
- ✅ Elimination of localStorage dependencies for core functionality  
- ✅ Zero increase in API error rates
- ✅ Page load time improvement (target: 15-20% faster)
- ✅ Bundle size reduction (target: 200KB+ smaller)

### User Experience Metrics

- ✅ Clear, actionable messaging for demo limits
- ✅ Seamless transition from demo to authenticated state
- ✅ Improved signup conversion from limit-reached prompts
- ✅ Zero user-facing errors during migration

### Business Metrics

- ✅ Maintained or improved user signup rates
- ✅ Reduced credit-related support tickets
- ✅ Improved trial-to-paid conversion rates

---

## Post-Migration Enhancements

### Progressive Enhancement Opportunities

**Subscriber Experience**:
- Rich search result layouts for unlimited users
- Advanced filtering options for Pro accounts  
- Search history and saved searches
- Export capabilities for authenticated users

**Demo User Experience**:
- Search countdown animation for urgency
- "Searches used today" indicator
- Preview of Pro features in results
- Smart upgrade prompts based on usage patterns

---

## Conclusion

This migration represents a fundamental simplification of the RIA Hunter frontend architecture. By removing the complex credit management system and aligning with the streamlined backend design, we eliminate maintenance overhead while improving user experience clarity.

The success of this migration depends on:
1. **Methodical execution** following the phased approach
2. **Comprehensive testing** of all user flows
3. **Careful monitoring** during the transition period
4. **Quick response capability** if issues arise

Expected outcome: A significantly simpler, more maintainable codebase that provides clearer user value propositions and improved conversion funnels.

---

**Implementation Timeline**: 9 days
**Code Reduction**: ~2,000 lines removed  
**Architecture Improvement**: Centralized session management
**User Experience**: Clearer messaging and upgrade paths