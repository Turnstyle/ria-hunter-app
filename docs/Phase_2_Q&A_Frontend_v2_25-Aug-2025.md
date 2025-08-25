# Phase 2 Q&A Frontend v2 (25-Aug-2025)

This document provides detailed answers to follow-up questions about the RIA Hunter frontend implementation, focusing on API handling, streaming chat, credit systems, and error reporting.

## Chat API Implementation

### 1. Is `/api/ask-stream` currently called with GET instead of POST?
The frontend has two implementations:
1. The primary implementation in `ChatInterface.tsx` uses **POST** via `apiClient.askStream()`
2. A secondary implementation in `useApiStream.ts` uses **GET** via `EventSource`

Currently, the application uses the POST method in the main chat interface.

### 2. Do we send `Accept: text/event-stream` in headers when requesting chat?
**Yes**, the application explicitly sets the Accept header for streaming:

```typescript
// From /app/lib/api/client.ts - askStream method
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

### 3. Where is the freebies constant (2) defined in code?
The freebies constant is defined in two places within the `useCredits` hook in `/app/hooks/useCredits.ts`:

```typescript
// For anonymous users getting initial credits
if (!user && !session) {
  // Anonymous users get 2 free credits
  const status = await getSubscriptionStatus(null);
  const credits = status.credits || 2;  // HERE: Fallback of 2 credits
  const isSubscriber = false;
  // ...
}

// And in the fallback logic when API calls fail
// Final fallback values
const fallbackCredits = !user ? 2 : 0;  // HERE: Fallback of 2 credits
const fallbackSubscriber = false;
```

### 4. Which files/constants need update to raise freebies to 15?
To increase freebies to 15, these specific code locations need to be updated:

1. In `/app/hooks/useCredits.ts`:
```typescript
// Change this
const credits = status.credits || 2;
// To
const credits = status.credits || 15;

// And change this
const fallbackCredits = !user ? 2 : 0;
// To
const fallbackCredits = !user ? 15 : 0;
```

No UI components need updating since they dynamically display the credit count.

### 5. Are credits decremented optimistically before server confirms?
**No**, the application does not use optimistic updates for credits. Instead, it waits for the server response to update the credit count:

```typescript
// From ChatInterface.tsx
// On complete callback of streaming response
(response: AskResponse) => {
  // Update credits from response
  updateFromResponse(response);
  
  // Update message with final content and sources
  // ...
}
```

The credits are only updated after receiving the response with the new credit count.

### 6. On 405/401 failures, does client rollback credit decrement?
Since the application doesn't use optimistic updates for credits, there's no need for rollback logic. On failures, the original credit count remains unchanged because it's only updated upon successful completion.

The error handling code in `ChatInterface.tsx` doesn't have specific logic to refresh credits on failure:

```typescript
// Handle specific error types
const errorMessage = error instanceof Error ? error.message : String(error);
if (errorMessage === 'CREDITS_EXHAUSTED') {
  setError('You have used all your credits. Please upgrade to continue.');
} else if (errorMessage === 'AUTHENTICATION_REQUIRED') {
  setError('Please sign in to continue.');
} else if (errorMessage === 'RATE_LIMITED') {
  setError('You are sending too many requests. Please slow down.');
} else {
  setError('Failed to process your query. Please try again.');
}
```

### 7. Does frontend retry failed chat requests automatically?
**Yes**, but only for specific error types. The API client has a retry mechanism with exponential backoff for 5xx errors and 429 (rate limiting):

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

It does NOT retry 401/402/405 errors - these are handled directly in the UI.

### 8. What's the exact UI behavior on `/api/subscription-status` returning 401?
When `/api/subscription-status` returns a 401, the application falls back to default values rather than showing an error:

```typescript
// From /app/lib/api/client.ts - getSubscriptionStatus method
async getSubscriptionStatus(): Promise<{
  credits: number;
  isSubscriber: boolean;
  subscriptionTier: string;
}> {
  // ...
  if (!response.ok) {
    // Return default values if status check fails
    return {
      credits: 0,
      isSubscriber: false,
      subscriptionTier: 'free',
    };
  }
  // ...
}
```

For anonymous users, the hook provides a fallback:
```typescript
// From useCredits.ts
if (!user && !session) {
  // Anonymous users get 2 free credits
  const status = await getSubscriptionStatus(null);
  const credits = status.credits || 2;  // Fallback to 2 if API fails
  const isSubscriber = false;
  // ...
}
```

No explicit error message is shown to users when subscription status fails.

### 9. Do API calls set `credentials: 'include'` even though backend doesn't use cookies?
**No**, the API calls don't set `credentials: 'include'`. Authentication is handled entirely through the Authorization header with the Bearer token:

```typescript
// From /app/lib/api/client.ts - buildHeaders method
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

None of the fetch calls in the codebase explicitly set the credentials option.

### 10. How are anonymous credits persisted locally (localStorage key, sessionStorage, none)?
Anonymous credits are persisted in **localStorage** with these keys:

```typescript
// From /app/hooks/useCredits.ts
// Storage keys for persistence
const CREDITS_STORAGE_KEY = 'ria-hunter-credits';
const SUBSCRIBER_STORAGE_KEY = 'ria-hunter-is-subscriber';
const CREDITS_TIMESTAMP_KEY = 'ria-hunter-credits-timestamp';
```

The storage logic:
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

## API Configuration & Runtime

### 11. What API base URL does frontend resolve in prod at runtime?
In production, the frontend resolves API URLs to the same domain as the frontend itself:

- For relative URLs (majority of calls): `https://ria-hunter.app/api/*`
- When absolute URLs are used: Value from `process.env.RIA_HUNTER_BACKEND_URL` or empty string (falling back to relative)

From the API configuration:
```typescript
// From /app/lib/api/client.ts
const API_CONFIG = {
  // Backend URL - uses environment variable or same-origin
  baseUrl: process.env.NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL || '',
  
  endpoints: {
    ask: '/api/ask',
    askStream: '/api/ask-stream',
    // ...
  }
}
```

### 12. Is there a `NEXT_PUBLIC_API_BASE_URL` var? Actual value in prod?
There is no direct `NEXT_PUBLIC_API_BASE_URL` variable. Instead, there are:

- `NEXT_PUBLIC_API_URL` - Set to `https://ria-hunter.app` in production
- `NEXT_PUBLIC_RIA_HUNTER_API_URL` - Set to `https://ria-hunter.vercel.app` for preview/development
- `NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL` - Used in the API client configuration

In production, these would point to the same domain as the frontend.

### 13. Does `next.config.js` define a rewrite from `/api/*` to `api.ria-hunter.app`?
**No**, the `next.config.js` file doesn't define any rewrites or proxies. The configuration only includes:
- ESLint settings
- Environment variables setup
- Webpack caching configuration
- Axiom integration

There are no rewrites configured that would redirect `/api/*` paths to an external domain.

### 14. Any Vercel rewrites doing the same?
**No**, the `vercel.json` file doesn't contain any rewrites:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

There are no Vercel project-level rewrites configured.

### 15. Are there shadow routes in `/app/api/*` colliding with backend?
**Yes**, the frontend implements several API routes that could potentially shadow backend paths:

- `/api/ask`
- `/api/ask-stream`
- `/api/create-checkout-session`
- `/api/create-portal-session`
- `/api/health`
- `/api/listings`
- `/api/subscription-status`
- `/api/stripe-webhook`
- `/api/redeem-share`
- `/api/ria-search`
- `/api/test-ai`

These routes act as proxies that forward requests to the backend, but they could cause conflicts if the backend expects direct access to these paths.

### 16. Does `middleware.ts` match `/api/*`? If yes, what logic?
**Yes**, `middleware.ts` matches `/api/*` paths but it simply passes them through without any authentication or transformation logic:

```typescript
// From middleware.ts
export function middleware(req: NextRequest) {
  // Allow API routes to bypass middleware protection
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // We don't block API routes here, authentication is handled within each API route
    return NextResponse.next()
  }
  // ...other middleware logic...
}
```

The middleware explicitly skips processing API routes, allowing them to be handled by their respective route handlers.

### 17. Is a service worker or fetch interceptor wrapping API calls?
**No**, there are no active service workers or fetch interceptors in the codebase. All API calls are made directly through the API client or through the fetch API without interception.

The only wrapper is the API client class itself, which provides consistent headers and retry logic, but this is not a service worker or interceptor.

### 18. Are Sentry or error tracking interceptors applied to API?
The application uses Axiom for logging (imported in `next.config.js`), but there's no evidence of Sentry or other error tracking interceptors being applied to API calls. 

There is a reference to a Sentry configuration in the standalone app:
```
ria-hunter-standalone/apps/riahunter/sentry.server.config.js
```

But it doesn't appear to be actively used in the main application for intercepting API calls.

### 19. Which runtime (edge/node) is set for pages using chat?
The chat functionality is implemented in client components that run in the browser, not on the server. For server components:

- The `/api/ask-stream` route explicitly uses Edge runtime: `export const runtime = 'edge';`
- Most other routes, including pages that contain the chat interface, use the default Node.js runtime

### 20. Do we use `dynamic = 'force-dynamic'` or `cache: 'no-store'` for chat pages?
For API requests, the application explicitly uses `cache: 'no-store'`:

```typescript
const resp = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(authHeader ? { Authorization: authHeader } : {}),
    'x-request-id': requestId,
  },
  body: JSON.stringify(body || {}),
  cache: 'no-store',
});
```

For page components, there's no explicit `dynamic = 'force-dynamic'` directive found, but the pages are primarily client-side rendered components that wouldn't be affected by server-side caching.

## Streaming Implementation Details

### 21. Show `askStream` code—what method, headers, and body are used?
Here's the complete `askStream` implementation:

```typescript
// From /app/lib/api/client.ts
async askStream(
  request: AskRequest,
  onToken: (token: string) => void,
  onComplete: (response: AskResponse) => void,
  onError: (error: Error) => void
): Promise<AbortController> {
  const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.askStream}`;
  const controller = new AbortController();
  
  try {
    const normalizedRequest = this.normalizeAskRequest(request);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.buildHeaders(),
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(normalizedRequest),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.status}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            // Stream completed
            continue;
          }
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.token) {
              onToken(parsed.token);
            }
            
            if (parsed.complete) {
              onComplete(parsed);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      onError(error);
    } else if (!(error instanceof Error)) {
      onError(new Error(String(error)));
    }
  }
  
  return controller;
}
```

Key details:
- **Method**: POST
- **Headers**:
  - 'Content-Type': 'application/json' (from buildHeaders)
  - 'Accept': 'text/event-stream'
  - 'Authorization': `Bearer ${this.authToken}` (if authenticated)
- **Body**: JSON.stringify(normalizedRequest) - contains query and options

### 22. Does it use EventSource or `fetch` streaming parser?
The primary implementation in `apiClient.askStream()` uses the **Fetch API with streaming** via `response.body?.getReader()`.

There is an alternative implementation in `useApiStream.ts` that uses **EventSource**, but it's not currently used in the main chat interface:

```typescript
// From /app/hooks/useApiStream.ts
const start = (query: string, onData: (chunk: string) => void, onDone?: () => void) => {
  if (isStreaming) return;
  setIsStreaming(true);
  setError(null);
  const url = `/api/ask-stream?query=${encodeURIComponent(query)}`;
  const es = new EventSource(url);
  eventSourceRef.current = es;
  // ...
}
```

### 23. How are SSE chunks parsed (decoder, loop, handler)?
SSE chunks are parsed using TextDecoder and a buffer mechanism:

```typescript
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  
  if (done) {
    break;
  }
  
  buffer += decoder.decode(value, { stream: true });
  
  // Process complete SSE messages
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      // Process data...
    }
  }
}
```

The parsing process:
1. Read chunks from the response body using reader.read()
2. Decode binary data to text using TextDecoder
3. Append to a buffer
4. Split buffer by newlines to get complete messages
5. Process lines that start with 'data: '
6. Parse JSON content of messages
7. Call appropriate callbacks based on message content

### 24. Are special `event:` lines handled (e.g., error, done)?
The code doesn't explicitly handle `event:` lines. It only processes `data:` lines and looks for special markers within the data content:

```typescript
if (line.startsWith('data: ')) {
  const data = line.slice(6);
  
  if (data === '[DONE]') {
    // Stream completed
    continue;
  }
  
  try {
    const parsed = JSON.parse(data);
    
    if (parsed.token) {
      onToken(parsed.token);
    }
    
    if (parsed.complete) {
      onComplete(parsed);
    }
  } catch (e) {
    console.error('Failed to parse SSE data:', e);
  }
}
```

The completion is determined by either:
1. A `data: [DONE]` message
2. A parsed message with `parsed.complete` set to true

Error handling is managed through try/catch blocks rather than explicit error events.

### 25. Do we surface backend request IDs in error logs?
**Yes**, the application captures and logs backend request IDs:

```typescript
// From /app/api/ask/route.ts
// Correlation id
const reqHeaders = await nextHeaders();
const incomingReqId = (reqHeaders as any)?.get?.('x-request-id') || undefined;
const requestId = incomingReqId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ...

// Include request ID in error response
return NextResponse.json(
  { error: 'Upstream ask service failed', errorId, status: resp.status, backend: backendBaseUrl, details: raw },
  { status: [401, 402].includes(resp.status) ? resp.status : 500 }
);
```

The error responses include the request ID as `errorId`, which can be used for correlation with backend logs.

### 26. Is error telemetry grouped by user/session for 401/405/5xx?
There is some basic error grouping by user in the logs, particularly in the subscription status route:

```typescript
console.log('Subscription status response:', response);
// ...where response includes userId and userEmail
```

However, there isn't a comprehensive system for grouping errors by user/session for all error types. The request ID provides some correlation ability, but it's not explicitly tied to user sessions in all error logs.

### 27. Does client log the final resolved URL/method for failed requests?
In some cases, yes. For example, in the `/api/ask` route:

```typescript
console.error('[ask-proxy:error-json]', {
  errorId,
  backendBaseUrl,
  tried: { apiUrl },
  status: resp.status,
  raw,
});
```

This logs the attempted URL (`apiUrl`), but it's not consistently implemented across all API calls. The focus is more on logging the error status and response content rather than the full request details.

### 28. Are failed responses surfaced to users (toast, modal) or silent?
Failed responses are surfaced to users through error messages in the UI, but not through toasts or modals. In the ChatInterface component:

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
    <button
      onClick={() => setError(null)}
      className="ml-2 text-red-700 hover:text-red-900"
    >
      ×
    </button>
  </div>
)}
```

Different error types have specific messages:
```typescript
if (errorMessage === 'CREDITS_EXHAUSTED') {
  setError('You have used all your credits. Please upgrade to continue.');
} else if (errorMessage === 'AUTHENTICATION_REQUIRED') {
  setError('Please sign in to continue.');
} else if (errorMessage === 'RATE_LIMITED') {
  setError('You are sending too many requests. Please slow down.');
} else {
  setError('Failed to process your query. Please try again.');
}
```

### 29. Is there a dev diagnostic toggle to see verbose fetch logs?
There's no explicit dev/diagnostic toggle for showing verbose network information in the UI. However, there are some debug routes that might provide diagnostic information:

- `/api/debug/health`
- `/api/debug-profile`
- `/api/debug-subscription`

These are likely used for development/debugging rather than being exposed to end users.

### 30. Is Sentry DSN configured in prod? Environment labels?
There's no clear evidence of Sentry being configured in the main application. The only reference is to a Sentry server config in the standalone app:

```
ria-hunter-standalone/apps/riahunter/sentry.server.config.js
```

Axiom appears to be the primary error tracking solution, as indicated by the Next.js configuration:

```javascript
const { withAxiom } = require('next-axiom');
// ...
module.exports = withAxiom(nextConfig);
```

But specific DSN or environment labels for either service aren't explicitly visible in the examined code.

## Credits & UI Logic

### 31. On login, how do we reconcile anonymous credits with server?
When a user logs in, the application fetches the user's actual credit count from the server rather than attempting to reconcile the anonymous credits:

```typescript
// From useCredits.ts - refreshCredits function
if (!user && !session) {
  // Anonymous users
  const status = await getSubscriptionStatus(null);
  const credits = status.credits || 2;
  const isSubscriber = false;
  // ...
} else {
  // Authenticated users - get actual credit count
  const status = await getSubscriptionStatus(session);
  const credits = status.credits;
  const isSubscriber = status.isSubscriber;
  // ...
}
```

This means that when a user logs in, their credits are completely determined by the server, and any local anonymous credits are effectively discarded.

### 32. On logout, do we clear/reset local credit state?
Yes, the auth state change triggers a refresh of credits. When a user logs out, the `session` and `user` become null, which causes the `refreshCredits` function to be called:

```typescript
// From AuthContext.tsx
else if (!session && typeof window !== 'undefined') {
  sessionStorage.removeItem('supabase.auth.token');
}

// From useCredits.ts
// Initial load and auth changes
useEffect(() => {
  refreshCredits();
}, [refreshCredits]);
```

This will fetch the anonymous credits count and update the UI accordingly.

### 33. Do we call `/api/subscription-status` on every page load or only on demand?
The subscription status is checked:
1. When the `useCredits` hook is initialized
2. After receiving API responses that might affect credits

It's not called on every page load, but rather when the auth state changes or when the cached data expires:

```typescript
// From useCredits.ts
// Check if we have fresh cached data
const stored = getStoredCredits();
if (stored && isCreditsDataFresh(stored.timestamp)) {
  setCredits(stored.credits);
  setIsSubscriber(stored.isSubscriber);
  setIsLoadingCredits(false);
  return;
}
```

The cache duration is 5 minutes:
```typescript
// Cache duration (5 minutes)
const CREDITS_CACHE_DURATION = 5 * 60 * 1000;
```

### 34. Do we debounce/throttle subscription checks to avoid spam?
There's no explicit debounce/throttle mechanism, but the caching system effectively limits how often the subscription status is checked:

```typescript
const isCreditsDataFresh = (timestamp: number): boolean => {
  return Date.now() - timestamp < CREDITS_CACHE_DURATION;
};
```

This ensures that the subscription status is only checked once every 5 minutes unless there's a specific reason to refresh it.

### 35. Do we skip calling subscription endpoint when unauthenticated?
**No**, the code still calls `/api/subscription-status` for anonymous users:

```typescript
if (!user && !session) {
  // Anonymous users get 2 free credits
  // But we still check with backend first
  const status = await getSubscriptionStatus(null);
  const credits = status.credits || 2;
  const isSubscriber = false;
  // ...
}
```

This call will likely result in a 401 response, which is handled by falling back to the default values.

### 36. Is freebie logic fully mirrored in UI (2 + shareCount ≤ 1)?
There is no explicit UI representation of the "2 + shareCount ≤ 1" logic. The UI simply displays the total number of credits without breaking down how they were earned:

```typescript
{!isSubscriber && (
  <p className="mt-2 text-sm text-gray-600">
    {credits > 0 ? `${credits} credits remaining` : 'No credits remaining'}
  </p>
)}
```

The share bonus appears to be handled on the backend side, with the frontend simply displaying whatever credit count it receives.

### 37. How is share bonus surfaced in UI (text, badge, counter)?
There's no specific UI element that explicitly shows share bonuses. The credits are displayed as a total count without distinguishing between initial freebies and share bonuses:

```typescript
{credits > 0 ? `${credits} credits remaining` : 'No credits remaining'}
```

There might be a separate interface for redeeming shares (given the existence of `/api/redeem-share`), but it's not directly integrated with the credit display in the chat interface.

### 38. After 15 freebies, what exact flow forces account creation?
When credits are exhausted, the UI shows an error message with an upgrade button:

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
    <button
      onClick={() => setError(null)}
      className="ml-2 text-red-700 hover:text-red-900"
    >
      ×
    </button>
  </div>
)}
```

The flow:
1. User exhausts all credits
2. Error message appears: "You have used all your credits. Please upgrade to continue."
3. User clicks "Upgrade Plan" button
4. User is redirected to `/subscription` page where they can create an account and subscribe

The input field is also disabled when credits are exhausted:
```typescript
disabled={isLoading || isStreaming || (!isSubscriber && credits <= 0)}
```

### 39. Which UI components must change copy when freebies go from 2 → 15?
No UI components need to change copy since they dynamically display the credit count:

```typescript
{!isSubscriber && (
  <p className="mt-2 text-sm text-gray-600">
    {credits > 0 ? `${credits} credits remaining` : 'No credits remaining'}
  </p>
)}
```

The only changes needed are the constants in the code that determine the initial credit count for anonymous users.

### 40. Any feature flags that disable chat/credits UI? Names + defaults?
There don't appear to be explicit feature flags for disabling the chat or credits UI. The application handles different states based on:

1. User authentication status
2. Credit availability
3. Subscription status

But these are dynamic states rather than feature flags.

The closest thing to a feature flag is the conditional rendering based on subscription and credit status:
```typescript
<input
  // ...
  disabled={isLoading || isStreaming || (!isSubscriber && credits <= 0)}
/>
```

And:
```typescript
{!isSubscriber && (
  <p className="mt-2 text-sm text-gray-600">
    {credits > 0 ? `${credits} credits remaining` : 'No credits remaining'}
  </p>
)}
```

## Conclusion

Based on this detailed analysis, the primary issues affecting the frontend appear to be:

1. **API Routing Conflict**: The frontend has shadow routes under `/api/*` that may be conflicting with backend endpoints, potentially causing 405 errors.

2. **Mixed HTTP Methods**: The codebase has both GET and POST implementations for streaming, but primarily uses POST. If the backend expects GET, this could cause issues.

3. **Freebies Implementation**: The hard-coded fallback of 2 credits needs to be updated to 15 in specific locations within `useCredits.ts`.

4. **Error Handling**: The application has basic error handling but lacks comprehensive telemetry and user-facing diagnostics, making it harder to troubleshoot issues.

To raise freebies to 15, the simplest path is updating the two constants in `useCredits.ts`, with no UI changes needed since the display is dynamic.
