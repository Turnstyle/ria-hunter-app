# Phase 2 Q&A Frontend v3 (25-Aug-2025)

This document provides precise answers to focused follow-up questions about the RIA Hunter frontend implementation, focusing on API calls, credit management, and error handling.

## Streaming Implementation & API Configuration

### 1. Does `askStream` currently send POST with JSON body, or is any code path still using GET/EventSource?

**Current implementation: fetch streaming with POST, but EventSource code path exists**

The application has two implementations, but the primary one being used in the `ChatInterface` component is fetch streaming with POST:

```typescript
// From ChatInterface.tsx
abortControllerRef.current = await apiClient.askStream(
  {
    query: input,
    options: {
      includeDetails: true,
      maxResults: 10,
    },
  },
  // Callbacks for token handling, completion, and errors
);
```

This calls the implementation in `apiClient.askStream()` which uses POST:

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: {
    ...this.buildHeaders(),
    'Accept': 'text/event-stream',
  },
  body: JSON.stringify(normalizedRequest),
  signal: controller.signal,
});
```

The EventSource (GET) implementation exists in `useApiStream.ts` but isn't currently used in the main chat interface:

```typescript
export function useAskApiStream() {
  // ...
  const start = (query: string, onData: (chunk: string) => void, onDone?: () => void) => {
    // ...
    const url = `/api/ask-stream?query=${encodeURIComponent(query)}`;
    const es = new EventSource(url);
    // ...
  };
  // ...
}
```

### 2. Do we explicitly include `Content-Type: application/json` AND `Accept: text/event-stream` in headers?

**Yes, both headers are explicitly set**

The `askStream` method sets:
```typescript
headers: {
  ...this.buildHeaders(),
  'Accept': 'text/event-stream',
},
```

And the `buildHeaders` method includes:
```typescript
private buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (this.authToken) {
    headers['Authorization'] = `Bearer ${this.authToken}`;
  }
  
  return headers;
}
```

So the final headers for chat requests include both:
- `Accept: text/event-stream`
- `Content-Type: application/json`

### 5. On a 405 response, do logs show the actual HTTP method sent?

**No, logs don't explicitly capture the HTTP method**

The application logs basic error information for failed requests, but doesn't capture the HTTP method used. For streaming:

```typescript
// In apiClient.askStream
if (!response.ok) {
  throw new Error(`Stream request failed: ${response.status}`);
}
```

This error message doesn't include the method.

In the `/api/ask` route proxy, there's more detailed logging but still no method:
```typescript
console.error('[ask-proxy:error-json]', {
  errorId,
  backendBaseUrl,
  tried: { apiUrl }, // URL but not method
  status: resp.status,
  raw,
});
```

There's no explicit "attempted POST but got 405" logging to definitively confirm method mismatch.

### 10. Is there any stale rewrite or shadow `/api` route in the repo that could intercept prod API calls?

**Yes, potentially interfering shadow routes exist**

The frontend has several API routes that could shadow backend paths:

- `/api/ask-stream` route is particularly relevant:
```typescript
// In /app/api/ask-stream/route.ts
export async function GET(request: NextRequest) {
  const backendBaseUrl = process.env.RIA_HUNTER_BACKEND_URL;
  // ...
  const primaryUrl = `${base}/api/ask-stream?query=${encodeURIComponent(query)}`;
  // ...
}
```

This route only implements the GET method, not POST. If the frontend client is using POST but this shadow route only accepts GET, it would result in a 405 Method Not Allowed error.

Other shadow routes:
- `/api/ask`
- `/api/subscription-status`
- `/api/health`
- `/api/listings`
- And several others that could potentially intercept backend requests

There are no rewrites in `next.config.js` or `vercel.json`, but these shadow routes could cause conflicts if they handle requests differently than the backend expects.

## Credits Management

### 3. Where exactly is the freebies constant (2) stored in frontend? Will it break if backend alone is updated to 15?

**Freebies constant locations:**

The "2" freebies constant is defined in two specific places in `/app/hooks/useCredits.ts`:

```typescript
// Location 1: Anonymous users fallback when API returns no value
if (!user && !session) {
  // Anonymous users get 2 free credits
  const status = await getSubscriptionStatus(null);
  const credits = status.credits || 2;  // HERE: Fallback of 2 credits
  // ...
}

// Location 2: Ultimate fallback if API calls fail completely
// Final fallback values
const fallbackCredits = !user ? 2 : 0;  // HERE: Fallback of 2 credits
const fallbackSubscriber = false;
```

**If backend alone is updated to 15:**
- For new users, they would get 15 credits if the backend returns that value
- But if the API fails or returns no value, the frontend would still fallback to 2 credits
- This could cause inconsistent behavior depending on network conditions

### 4. Does UI sync credits count from backend after each request, or rely only on local decrement?

**UI syncs from backend after each request, no local decrement**

The frontend does not use optimistic updates (no local decrement). Instead, it updates credits based on the response metadata after each completed request:

```typescript
// From ChatInterface.tsx - in the onComplete callback
(response: AskResponse) => {
  // Update credits from response
  updateFromResponse(response);
  
  // Update message with final content and sources
  // ...
}
```

The updateFromResponse function extracts the credit count from the response:
```typescript
// In useCredits.ts
const updateFromResponse = useCallback((response: any) => {
  let newCredits: number | undefined;
  
  // Check for metadata.remaining first (new format)
  if (response?.metadata?.remaining !== undefined) {
    newCredits = Math.max(0, response.metadata.remaining);
    // ...
  }
  
  // Update state and persist
  if (newCredits !== undefined) {
    setCredits(newCredits);
    // ...store in localStorage...
  }
}, [credits, isSubscriber]);
```

### 9. Are anonymous credits persisted across browser sessions? If so, where (localStorage key)?

**Yes, persisted in localStorage**

Anonymous credits are persisted across browser sessions using these localStorage keys:

```typescript
// From /app/hooks/useCredits.ts
const CREDITS_STORAGE_KEY = 'ria-hunter-credits'; // Stores the number of credits
const SUBSCRIBER_STORAGE_KEY = 'ria-hunter-is-subscriber'; // Stores subscription status
const CREDITS_TIMESTAMP_KEY = 'ria-hunter-credits-timestamp'; // Stores when credits were last updated
```

Storage implementation:
```typescript
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
```

This means anonymous users' credit counts persist across page refreshes and browser restarts.

### 8. After freebies run out, what exact UI element forces account creation (modal, toast, disabled button)?

**Inline error message with upgrade button + disabled input**

When credits are exhausted, two UI changes occur:

1. An inline error message appears with an upgrade button:
```typescript
{error && (
  <div className="mx-4 mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-start">
    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
    <div className="flex-1">
      <p>{error}</p>
      {error.includes('credits') && (
        <button
          onClick={() => window.location.href = '/subscription'}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Upgrade Plan
        </button>
      )}
    </div>
    <button onClick={() => setError(null)} className="ml-2 text-red-700 hover:text-red-900">×</button>
  </div>
)}
```

2. The input field becomes disabled:
```typescript
<input
  type="text"
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder="Ask about RIAs, venture capital activity, executives..."
  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
  disabled={isLoading || isStreaming || (!isSubscriber && credits <= 0)}
/>
```

The user flow:
1. User exhausts all credits
2. Error message appears: "You have used all your credits. Please upgrade to continue."
3. Input field becomes disabled
4. User clicks "Upgrade Plan" button
5. User is redirected to `/subscription` page where they can create an account

## Error Handling & Retries

### 6. When subscription-status returns 401, do we suppress retries or spam it continuously?

**401s are handled with fallbacks and caching to prevent spam**

When subscription-status returns 401, the application:
1. Falls back to default values without showing an error
2. Caches the fallback values with a timestamp
3. Doesn't retry immediately, only after cache expiration (5 min)

```typescript
// From /app/lib/api/client.ts - getSubscriptionStatus method
if (!response.ok) {
  // Return default values if status check fails - NO RETRY
  return {
    credits: 0,
    isSubscriber: false,
    subscriptionTier: 'free',
  };
}
```

The caching mechanism prevents continuous retries:
```typescript
// Cache duration (5 minutes)
const CREDITS_CACHE_DURATION = 5 * 60 * 1000;

// Only refresh from backend if cached data is stale
if (stored && isCreditsDataFresh(stored.timestamp)) {
  setCredits(stored.credits);
  setIsSubscriber(stored.isSubscriber);
  setIsLoadingCredits(false);
  return; // Skip API call
}
```

This effectively means a 401 will only be triggered once every 5 minutes at most.

### 7. Is there a retry/backoff strategy for failed SSE fetches, or does the user have to manually retry?

**Yes, automatic retry with exponential backoff for specific errors**

The API client has a retry mechanism with exponential backoff, but only for 5xx errors and 429 (rate limiting):

```typescript
// From fetchWithRetry in /app/lib/api/client.ts
if ((response.status >= 500 || response.status === 429) && 
    attempt < API_CONFIG.retry.maxAttempts) {
  const delay = Math.min(
    API_CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1),
    API_CONFIG.retry.maxDelayMs
  );
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  return this.fetchWithRetry(url, options, attempt + 1);
}
```

The retry configuration:
```typescript
retry: {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
}
```

For 401/402/405 errors, there is no automatic retry - the user sees an error message and must manually retry by submitting their query again.

## Summary of Key Findings

1. **Streaming Implementation**: 
   - Main implementation uses POST with JSON body
   - EventSource/GET code path exists but isn't currently used
   - Both Content-Type and Accept headers are correctly set

2. **Credits Management**:
   - Freebies constant (2) is hardcoded in two places in useCredits.ts
   - UI syncs from backend after each request (no optimistic updates)
   - Anonymous credits persist in localStorage across sessions
   - When credits run out, input disables + inline error with upgrade button appears

3. **Error Handling**:
   - No HTTP method logging for 405 errors
   - 401 errors for subscription status are handled with fallbacks, not retries
   - Automatic retry with backoff exists for 5xx/429 errors only
   - 401/405 errors require manual retry by the user

4. **API Routing**:
   - Shadow routes in /app/api/* could intercept backend calls
   - /api/ask-stream route.ts only implements GET, but client uses POST
   - No rewrites in next.config.js or Vercel settings

These findings suggest that the most likely cause of the 405 Method Not Allowed error is the mismatch between the client using POST and the shadow route in /app/api/ask-stream only implementing GET. The backend may be expecting GET requests, but the frontend client is sending POST requests.