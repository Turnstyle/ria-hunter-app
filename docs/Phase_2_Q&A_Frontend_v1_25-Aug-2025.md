# Phase 2 Q&A Frontend v1 (25-Aug-2025)

This document provides answers to specific questions about the RIA Hunter frontend implementation, API handling, authentication flow, and other critical aspects of the application.

## A) Runtime & config

### 1. What domain(s) is the frontend deployed to (prod/preview), and which env is active at runtime?
- **Prod Domain**: `ria-hunter.app` (based on environment variables and API configurations)
- **Preview/Dev Domain**: `ria-hunter.vercel.app` (secondary domain mentioned in env files)
- **Active Runtime Env**: Production environment based on the repository status

### 2. What API base URL does the app resolve in prod (actual string at runtime)?
- The app uses relative URLs for API calls in most cases, which resolve to the same domain as the frontend
- When absolute URLs are used, they refer to:
  - `https://ria-hunter.app/api/*` (from NEXT_PUBLIC_API_URL)
  - Backend API calls might use `process.env.RIA_HUNTER_BACKEND_URL` when defined

### 3. Do we have `NEXT_PUBLIC_API_BASE_URL` (or similar)? List all API-related env vars.
API-related environment variables:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_RIA_HUNTER_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `RIA_HUNTER_BACKEND_URL`
- `NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL`

### 4. Does `next.config.js` define a rewrite/proxy from `/api/*` → `https://api.ria-hunter.app`?
No, the `next.config.js` file doesn't define any rewrites or proxies. The configuration only includes:
- ESLint settings
- Environment variables setup
- Webpack caching configuration
- Axiom integration

### 5. Any Vercel project-level rewrites/edge routes doing the same?
No Vercel-specific rewrites were found in `vercel.json`. The file only contains basic configuration:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

### 6. Does the frontend ship any `/app/api/*` routes that could shadow backend paths? List them.
Yes, the frontend has several API routes that could potentially shadow backend paths:
- `/api/ask`
- `/api/ask-stream`
- `/api/create-checkout-session`
- `/api/create-portal-session`
- `/api/debug-profile`
- `/api/debug-subscription`
- `/api/health`
- `/api/listings`
- `/api/listings/[id]`
- `/api/manual-subscription-fix`
- `/api/problem-report`
- `/api/redeem-share`
- `/api/ria-search`
- `/api/stripe-webhook`
- `/api/subscription-status`
- `/api/test-ai`

### 7. Does `middleware.ts` in the frontend match `/api/*`? If yes, what does it do?
Yes, `middleware.ts` matches `/api/*` paths but it simply passes them through:

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

### 8. Are service workers or fetch interceptors (e.g., Sentry) touching network requests?
There are no active service workers or fetch interceptors in the codebase. 
- Axiom is imported in `next.config.js` but appears to be used for logging rather than network interception
- No Sentry implementation was found that would intercept fetch requests

### 9. Next.js version and runtime per page (node vs edge)?
- Next.js version appears to be based on a recent version with App Router support
- Runtime configuration varies by route:
  - The `/api/ask-stream` route uses Edge runtime: `export const runtime = 'edge';`
  - Most other routes use the default Node.js runtime

### 10. Any `basePath`/`assetPrefix` that alters fetch URL resolution?
No `basePath` or `assetPrefix` configurations were found in `next.config.js` that would alter URL resolution.

## B) Streaming chat request

### 11. Show the `askStream` function (file path). Which HTTP method is used?
The `askStream` function is defined in `/app/lib/api/client.ts` and uses the **POST** HTTP method:

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
    // ...rest of function
  }
}
```

However, there's also a `/app/hooks/useApiStream.ts` implementation that uses EventSource (GET):

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

### 12. If EventSource is used, confirm it issues GET; otherwise confirm POST + fetch streaming.
Both mechanisms are implemented:
- **EventSource** implementation in `useApiStream.ts` uses **GET** requests
- **Fetch API** implementation in `apiClient.askStream()` uses **POST** requests with streaming response handling
- The primary implementation used in `ChatInterface.tsx` is the **POST** method via `apiClient.askStream()`

### 13. Exact URL built for chat in prod (after helpers).
For the POST method implementation (primary one used):
```
https://ria-hunter.app/api/ask-stream
```

For the GET method implementation:
```
https://ria-hunter.app/api/ask-stream?query={encoded_query}
```

### 14. Full `fetch` options for chat: headers, `mode`, `cache`, `keepalive`, `signal`, `credentials`.
Fetch options for the POST implementation:
```javascript
{
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    // Authorization header added if user is authenticated
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  },
  body: JSON.stringify(normalizedRequest),
  signal: controller.signal,
  // Note: No explicit mode, cache, keepalive, or credentials settings
}
```

### 15. Are we sending `Content-Type: application/json` with `{ query }`?
Yes, the `apiClient.askStream()` function sets `'Content-Type': 'application/json'` and sends a JSON body with the query and options:
```javascript
{
  query: "User's query text",
  options: {
    // Optional parameters like city, state, etc.
    includeDetails: true,
    maxResults: 10,
    // ...other options
  }
}
```

### 16. Do we set `Accept: text/event-stream`?
Yes, the `apiClient.askStream()` function explicitly sets the Accept header:
```javascript
headers: {
  ...this.buildHeaders(),
  'Accept': 'text/event-stream',
},
```

### 17. How are SSE chunks parsed (decoder/parser code)?
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
```

### 18. How are `data:` lines, `event:` types, and `id:` handled (incl. end/error)?
- **data:** lines are processed by slicing the 'data: ' prefix and passing to JSON.parse()
- **[DONE]** marker is recognized for stream completion: `if (data === '[DONE]') { continue; }`
- **parsed.token** is handled via the onToken callback for incremental updates
- **parsed.complete** is handled via the onComplete callback for final response
- **event:** types don't appear to be explicitly handled in the main implementation
- **id:** fields don't appear to be explicitly handled
- Errors are passed to the onError callback

### 19. Do we retry on 429/5xx? What backoff?
Yes, the API client has a retry mechanism with exponential backoff for 5xx errors and 429 (rate limiting):

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

The backoff configuration:
```typescript
// Retry configuration
retry: {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
},
```

### 20. On non-200 (e.g., 405), what message is shown and what telemetry is captured?
For non-200 responses in the streaming implementation:
- Error message: `Stream request failed: ${response.status}`
- UI displays: "I encountered an error processing your request. Please try again."
- Console error logging: `console.error('Streaming error:', error);`
- The error is passed to the onError callback which can show specific error messages based on the error type

In the API client, for specific error codes:
- 402: "CREDITS_EXHAUSTED" 
- 401: "AUTHENTICATION_REQUIRED"
- 429: "RATE_LIMITED"
- Other: "API request failed: {status}"

## C) Auth / session handling

### 21. How is the Supabase client created (factory code and options)?
The Supabase client is created in `/app/lib/supabase-client.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase environment variables are not set. Using placeholder client.');
  // Provide a placeholder client to avoid crashing the app
  supabase = {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithOAuth: () => Promise.resolve({ error: { message: "Supabase not configured" } }),
    },
  } as any;
}
```

No special options are provided, just the URL and anonymous key.

### 22. On app load, do we call `supabase.auth.getSession()`? Where?
Yes, `supabase.auth.getSession()` is called in the `AuthProvider` component's useEffect hook when the application loads:

```typescript
// From /app/contexts/AuthContext.tsx
useEffect(() => {
  // Get initial session
  const getInitialSession = async () => {
    try {
      // Ensure we have the Supabase URL and key before trying to get session
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('Supabase environment variables are missing');
        setLoading(false);
        return;
      }
      
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Store token in sessionStorage for API client
        if (session?.access_token && typeof window !== 'undefined') {
          sessionStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: session.access_token,
            expires_at: session.expires_at
          }));
        }
      }
    } catch (error) {
      console.error('Error getting initial session:', error);
    } finally {
      setLoading(false);
    }
  };

  getInitialSession();
  // ...
}, []);
```

### 23. What do we do on `onAuthStateChange('INITIAL_SESSION', undefined)`?
The `onAuthStateChange` handler in `AuthContext.tsx` doesn't appear to have specific logic for the 'INITIAL_SESSION' event. It handles all auth state changes in the same way:

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  async (event, session) => {
    console.log('Auth state change:', event, session?.user?.email);
    setSession(session);
    setUser(session?.user ?? null);
    
    // Update token in sessionStorage on auth changes
    if (session?.access_token && typeof window !== 'undefined') {
      sessionStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: session.access_token,
        expires_at: session.expires_at
      }));
    } else if (!session && typeof window !== 'undefined') {
      sessionStorage.removeItem('supabase.auth.token');
    }
    
    setLoading(false);
  }
);
```

### 24. For `/api/subscription-status`, do we attach `Authorization: Bearer <access_token>`? Show code.
Yes, the Authorization header is attached to the subscription status request in several places:

1. In the RIAHunterAPIClient:
```typescript
// From getSubscriptionStatus in /app/lib/api/client.ts
async getSubscriptionStatus(): Promise<{
  credits: number;
  isSubscriber: boolean;
  subscriptionTier: string;
}> {
  const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.subscriptionStatus}`;
  
  const response = await this.fetchWithRetry(url, {
    method: 'GET',
    headers: this.buildHeaders(), // This includes Authorization if authToken exists
  });
  // ...
}

// buildHeaders method
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

2. In the API route handler for subscription-status:
```typescript
// From /app/api/subscription-status/route.ts
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({
        hasActiveSubscription: false,
        status: 'no_auth',
        error: 'Missing authorization header'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    // ...
```

### 25. Do we refresh tokens before protected calls (and handle 401 → refresh → retry)?
There doesn't appear to be explicit token refresh logic before protected calls. The client relies on Supabase's built-in token refresh mechanisms. There is no visible pattern of handling 401 responses with a token refresh and retry.

### 26. Do we ever set `credentials: 'include'` on API calls? If yes, why?
No, the API calls don't explicitly set `credentials: 'include'`. The authorization is handled through the Authorization header with the Bearer token rather than with cookies that would require credentials: 'include'.

### 27. How are anonymous users identified client-side (localStorage ID, cookie, none)?
Anonymous users don't have a specific identification mechanism beyond the browser's session. The credits system does store information in localStorage:

```typescript
// From /app/hooks/useCredits.ts
// Storage keys for persistence
const CREDITS_STORAGE_KEY = 'ria-hunter-credits';
const SUBSCRIBER_STORAGE_KEY = 'ria-hunter-is-subscriber';
const CREDITS_TIMESTAMP_KEY = 'ria-hunter-credits-timestamp';
```

This allows tracking credits for anonymous users, but there's no persistent unique identifier assigned to anonymous users.

### 28. On login/logout, do we reconcile/clear any local credit counters?
Yes, the credit counters are updated when the auth state changes. The `useCredits` hook depends on the auth state and refreshes credits accordingly:

```typescript
// From /app/hooks/useCredits.ts
const refreshCredits = useCallback(async () => {
  setIsLoadingCredits(true);
  
  // Check if we have fresh cached data
  const stored = getStoredCredits();
  if (stored && isCreditsDataFresh(stored.timestamp)) {
    setCredits(stored.credits);
    setIsSubscriber(stored.isSubscriber);
    setIsLoadingCredits(false);
    return;
  }
  
  try {
    if (!user && !session) {
      // Anonymous users get 2 free credits
      // But we still check with backend first
      const status = await getSubscriptionStatus(null);
      const credits = status.credits || 2;
      const isSubscriber = false;
      
      setCredits(credits);
      setIsSubscriber(isSubscriber);
      storeCredits(credits, isSubscriber);
    } else {
      // Authenticated users - get actual credit count
      const status = await getSubscriptionStatus(session);
      const credits = status.credits;
      const isSubscriber = status.isSubscriber;
      
      setCredits(credits);
      setIsSubscriber(isSubscriber);
      storeCredits(credits, isSubscriber);
    }
  } catch (error) {
    // Fallback handling...
  }
}, [user, session]);

// Initial load and auth changes
useEffect(() => {
  refreshCredits();
}, [refreshCredits]);
```

### 29. Do we skip calling `/api/subscription-status` when unauthenticated to avoid 401 spam?
No, the code still calls `/api/subscription-status` for anonymous users. This can be seen in the `useCredits` hook:

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

However, the API route returns a 401 status for unauthenticated requests:
```typescript
const authHeader = request.headers.get('authorization');
if (!authHeader) {
  return NextResponse.json({
    hasActiveSubscription: false,
    status: 'no_auth',
    error: 'Missing authorization header'
  }, { status: 401 });
}
```

### 30. Are auth errors surfaced to users vs silently logged?
Auth errors are both logged to the console and surfaced to users in some cases:

1. Console logging:
```typescript
if (error) {
  console.error('Error getting session:', error);
}
```

2. User-facing errors for specific cases:
```typescript
if (errorMessage === 'AUTHENTICATION_REQUIRED') {
  setError('Please sign in to continue.');
}
```

The `ChatInterface` component also shows specific error messages for authentication issues, and there are UI components like `<AuthPrompt>` that guide users to sign in when needed.

## D) Credits UI & logic (target: 15 freebies)

### 31. Source of truth for "X credits remaining" in the UI (server vs local)?
The source of truth for credit display is a combination of server and local storage, with the server being the ultimate authority. The `useCredits` hook manages this:

1. Initial credits are loaded from localStorage if available
2. A server request is made to get the current credit status
3. After each chat response, the metadata from the response updates the credits

The core implementation is in `/app/hooks/useCredits.ts`:

```typescript
export function useCredits(): UseCreditsReturn {
  // Initialize with stored values or defaults
  const getInitialCredits = useCallback(() => {
    const stored = getStoredCredits();
    return stored?.credits ?? 0;
  }, []);

  // ...

  // Update credits from API response
  const updateFromResponse = useCallback((response: any) => {
    let newCredits: number | undefined;
    let newIsSubscriber: boolean | undefined;
    
    // Check for metadata.remaining first (new format)
    if (response?.metadata?.remaining !== undefined) {
      newCredits = Math.max(0, response.metadata.remaining);
      
      if (response.metadata.isSubscriber !== undefined) {
        newIsSubscriber = response.metadata.isSubscriber;
      }
    }
    // Fallback to checking top-level remaining
    else if (response?.remaining !== undefined) {
      newCredits = Math.max(0, response.remaining);
    }
    
    // Update state and persist if values changed
    if (newCredits !== undefined) {
      setCredits(newCredits);
    }
    // ...
  }, [credits, isSubscriber]);
}
```

### 32. Do we maintain a local anonymous credits counter? Storage location and key.
Yes, a local anonymous credits counter is maintained in localStorage:

```typescript
// From /app/hooks/useCredits.ts
// Storage keys for persistence
const CREDITS_STORAGE_KEY = 'ria-hunter-credits';
const SUBSCRIBER_STORAGE_KEY = 'ria-hunter-is-subscriber';
const CREDITS_TIMESTAMP_KEY = 'ria-hunter-credits-timestamp';

// Utility functions for localStorage
const getStoredCredits = (): { credits: number; isSubscriber: boolean; timestamp: number } | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const credits = localStorage.getItem(CREDITS_STORAGE_KEY);
    const isSubscriber = localStorage.getItem(SUBSCRIBER_STORAGE_KEY);
    const timestamp = localStorage.getItem(CREDITS_TIMESTAMP_KEY);
    
    if (credits !== null && isSubscriber !== null && timestamp !== null) {
      return {
        credits: parseInt(credits, 10),
        isSubscriber: isSubscriber === 'true',
        timestamp: parseInt(timestamp, 10),
      };
    }
  } catch (error) {
    console.error('Error reading credits from storage:', error);
  }
  
  return null;
};

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

### 33. When a chat starts, do we optimistically decrement? Rollback policy on failure/abort?
The code does not appear to optimistically decrement credits when a chat starts. Instead, it waits for the response from the server and then updates the credits based on the response metadata:

```typescript
// From ChatInterface.tsx - handleSubmit function
// On complete
(response: AskResponse) => {
  // Update credits from response
  updateFromResponse(response);
  
  // Update message with final content and sources
  setMessages(prev => prev.map(msg => 
    msg.id === assistantMessageId
      ? {
          ...msg,
          content: response.answer || msg.content,
          sources: response.sources,
          isStreaming: false,
        }
      : msg
  ));
  
  setIsStreaming(false);
  streamingMessageIdRef.current = null;
}
```

There's no specific rollback policy for credit decrements on failure or abort.

### 34. After any error, do we re-fetch server status to resync?
There doesn't appear to be explicit code to re-fetch server status after errors to resync credits. However, the system does have fallback mechanisms:

```typescript
// In ChatInterface.tsx error handling
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

But there's no explicit call to refresh credits after errors.

### 35. How do we prevent race conditions from concurrent chats updating the same counter?
The code doesn't have explicit protection against race conditions for concurrent chats. It relies on the most recent response to update the credits:

```typescript
const updateFromResponse = useCallback((response: any) => {
  let newCredits: number | undefined;
  let newIsSubscriber: boolean | undefined;
  
  // Check for metadata.remaining first (new format)
  if (response?.metadata?.remaining !== undefined) {
    newCredits = Math.max(0, response.metadata.remaining);
    // ...
  }
  
  // Update state and persist if values changed
  if (newCredits !== undefined) {
    setCredits(newCredits);
  }
  // ...
}, [credits, isSubscriber]);
```

Since there's no optimistic updates, only server-confirmed updates, this reduces the risk of race conditions, but doesn't completely eliminate them.

### 36. Where is the freebie constant on the client set (currently shows 2)? Provide references.
The freebie constant is set as a fallback in the `useCredits` hook:

```typescript
// From useCredits.ts
if (!user && !session) {
  // Anonymous users get 2 free credits
  // But we still check with backend first
  const status = await getSubscriptionStatus(null);
  const credits = status.credits || 2;
  const isSubscriber = false;
  
  setCredits(credits);
  setIsSubscriber(isSubscriber);
  storeCredits(credits, isSubscriber);
}
```

And also in the fallback logic:

```typescript
// Final fallback values
const fallbackCredits = !user ? 2 : 0;
const fallbackSubscriber = false;
```

### 37. What code/UI must change to raise freebies to 15 (constants, copy, gating)?
To change freebies from 2 to 15, the following changes would be needed:

1. Update the fallback constants in `useCredits.ts`:
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

2. The UI doesn't need to change as it dynamically displays the current credit count:
```typescript
{!isSubscriber && (
  <p className="mt-2 text-sm text-gray-600">
    {credits > 0 ? `${credits} credits remaining` : 'No credits remaining'}
  </p>
)}
```

## Conclusion

Based on this comprehensive analysis of the RIA Hunter frontend codebase, we can identify several key insights:

1. **API Configuration**: The application primarily uses relative URLs for API calls, with API routes in Next.js acting as proxies to the backend. This architecture can potentially lead to issues if the frontend's `/api/*` routes shadow backend endpoints.

2. **Streaming Implementation**: The application implements two different methods for streaming chat:
   - A POST-based streaming implementation using the Fetch API
   - A GET-based implementation using EventSource
   
   The primary implementation used is the POST method.

3. **Authentication**: The application uses Supabase for authentication and stores the access token in sessionStorage. There's no explicit token refresh mechanism for expired tokens.

4. **Credits System**: 
   - The current system provides 2 free credits to anonymous users
   - Credits are tracked in localStorage with server verification
   - To increase freebies to 15, the fallback constants in useCredits.ts would need to be updated

5. **Error Handling**: The application uses Axiom for logging, but there's limited user-facing error diagnostics beyond basic error messages.

6. **Caching**: API routes explicitly disable caching with appropriate headers, reducing the risk of stale responses.

These findings provide valuable context for addressing the current issues and implementing the planned increase to 15 free credits for anonymous users.

3. The backend would also need to be updated to align with the frontend's expectations.

### 38. After 15 freebies, what exact UX prompts account creation (modal, route, button IDs)?
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

## Conclusion

Based on this comprehensive analysis of the RIA Hunter frontend codebase, we can identify several key insights:

1. **API Configuration**: The application primarily uses relative URLs for API calls, with API routes in Next.js acting as proxies to the backend. This architecture can potentially lead to issues if the frontend's `/api/*` routes shadow backend endpoints.

2. **Streaming Implementation**: The application implements two different methods for streaming chat:
   - A POST-based streaming implementation using the Fetch API
   - A GET-based implementation using EventSource
   
   The primary implementation used is the POST method.

3. **Authentication**: The application uses Supabase for authentication and stores the access token in sessionStorage. There's no explicit token refresh mechanism for expired tokens.

4. **Credits System**: 
   - The current system provides 2 free credits to anonymous users
   - Credits are tracked in localStorage with server verification
   - To increase freebies to 15, the fallback constants in useCredits.ts would need to be updated

5. **Error Handling**: The application uses Axiom for logging, but there's limited user-facing error diagnostics beyond basic error messages.

6. **Caching**: API routes explicitly disable caching with appropriate headers, reducing the risk of stale responses.

These findings provide valuable context for addressing the current issues and implementing the planned increase to 15 free credits for anonymous users.

The input field is also disabled when credits are exhausted:
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

### 39. How is "share = +1 credit (max 1)" represented in UI? Do we query actual share count?
There doesn't appear to be an explicit UI representation of the "share = +1 credit" feature in the examined code. However, the backend might handle this logic, and the frontend would receive updated credit counts that reflect any share bonuses.

### 40. Does the UI distinguish subscriber vs free states using `/api/subscription-status` fields?
Yes, the UI distinguishes between subscriber and free states using the `isSubscriber` flag that comes from the subscription status:

```typescript
// In ChatInterface.tsx
const { credits, isSubscriber, updateFromResponse } = useCredits();

// ...

{!isSubscriber && (
  <p className="mt-2 text-sm text-gray-600">
    {credits > 0 ? `${credits} credits remaining` : 'No credits remaining'}
  </p>
)}
```

## Conclusion

Based on this comprehensive analysis of the RIA Hunter frontend codebase, we can identify several key insights:

1. **API Configuration**: The application primarily uses relative URLs for API calls, with API routes in Next.js acting as proxies to the backend. This architecture can potentially lead to issues if the frontend's `/api/*` routes shadow backend endpoints.

2. **Streaming Implementation**: The application implements two different methods for streaming chat:
   - A POST-based streaming implementation using the Fetch API
   - A GET-based implementation using EventSource
   
   The primary implementation used is the POST method.

3. **Authentication**: The application uses Supabase for authentication and stores the access token in sessionStorage. There's no explicit token refresh mechanism for expired tokens.

4. **Credits System**: 
   - The current system provides 2 free credits to anonymous users
   - Credits are tracked in localStorage with server verification
   - To increase freebies to 15, the fallback constants in useCredits.ts would need to be updated

5. **Error Handling**: The application uses Axiom for logging, but there's limited user-facing error diagnostics beyond basic error messages.

6. **Caching**: API routes explicitly disable caching with appropriate headers, reducing the risk of stale responses.

These findings provide valuable context for addressing the current issues and implementing the planned increase to 15 free credits for anonymous users.

The `isSubscriber` flag is set based on the response from `/api/subscription-status`:
```typescript
const status = await getSubscriptionStatus(session);
const credits = status.credits;
const isSubscriber = status.isSubscriber;
```

## E) Error reporting & diagnostics

### 41. What is `hook.js` that logs "Streaming error … 405"? Which library and config?
There's no direct reference to a `hook.js` file in the examined codebase. However, the application appears to use Axiom for logging based on the imports in `next.config.js`:

```javascript
const { withAxiom } = require('next-axiom');
// ...
// Wrap with Axiom
module.exports = withAxiom(nextConfig);
```

Streaming errors are logged directly in the console:
```typescript
// In apiClient.askStream
console.error('Failed to parse SSE data:', e);
// ...

// In ChatInterface.tsx
console.error('Streaming error:', error);
```

### 42. Is Sentry (or similar) enabled? DSN, environment names, and release tagging?
There's no clear evidence of Sentry being enabled in the main application code. However, there is a reference to a Sentry server config in the standalone app:

```
ria-hunter-standalone/apps/riahunter/sentry.server.config.js
```

Axiom appears to be the primary error tracking solution as indicated by the Next.js configuration.

### 43. Do we log the resolved URL + method for failed requests (to catch relative vs absolute mistakes)?
There is some logging of request details on failures, particularly in the `/api/ask` route:

```typescript
console.error('[ask-proxy:error-json]', {
  errorId,
  backendBaseUrl,
  tried: { apiUrl },
  status: resp.status,
  raw,
});
```

However, this appears to be more focused on debugging the proxy itself rather than catching relative vs. absolute URL issues.

### 44. Do we capture backend request IDs (if any) and surface them to users?
Yes, the application captures and passes through request IDs:

```typescript
// From /app/api/ask/route.ts
// Correlation id
const reqHeaders = await nextHeaders();
const incomingReqId = (reqHeaders as any)?.get?.('x-request-id') || undefined;
const requestId = incomingReqId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ...

let resp = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(authHeader ? { Authorization: authHeader } : {}),
    'x-request-id': requestId,
  },
  // ...
});
```

And error responses include the request ID:
```typescript
return NextResponse.json(
  { error: 'Upstream ask service failed', errorId, status: resp.status, backend: backendBaseUrl, details: raw },
  { status: [401, 402].includes(resp.status) ? resp.status : 500 }
);
```

### 45. Are 401/405/5xx errors grouped with session/user identifiers for triage?
There is some error grouping by user in the logs, but it's not comprehensive. In the subscription status route, there are extensive logs that include user information:

```typescript
console.log('Subscription status response:', response);
// ...where response includes userId and userEmail
```

For API errors, the request ID is used for correlation, but explicit user session information isn't always included in error logs.

### 46. Is there a dev/diagnostic toggle to show verbose network info in the UI?
There doesn't appear to be a specific dev/diagnostic toggle for showing verbose network information in the UI. However, there are some debug routes that might provide diagnostic information:

- `/api/debug/health`
- `/api/debug-profile`
- `/api/debug-subscription`

## F) Build, cache & deployment

### 47. Vercel project/alias for the frontend and mapping of env vars by env (dev/preview/prod).
Based on the configuration and environment files:

- **Vercel Project**: ria-hunter-app
- **Production Domain**: ria-hunter.app
- **Preview Domain**: ria-hunter.vercel.app
- **Environment Variables**:
  - Production: Set in Vercel project settings
  - Preview/Dev: Potentially using different values based on branch deployments
  - Local: Defined in env.local

The key environment variables that differ between environments are:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 48. Any CDN/Next.js caching that could cache `/api/*` (e.g., `fetch` defaults, route segment configs)?
There's no evidence of CDN or Next.js caching specifically for `/api/*` routes. In fact, there are explicit measures to avoid caching API responses:

```typescript
// In /app/api/ask-stream/route.ts
return new Response(resp.body, {
  status: resp.status,
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  }
});
```

And in API fetch calls:
```typescript
fetch(apiUrl, {
  // ...
  cache: 'no-store',
});
```

### 49. Do pages/components that trigger chat use `dynamic = 'force-dynamic'` or `cache: 'no-store'`?
Yes, API routes use `cache: 'no-store'` to prevent caching:

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

The streaming route also explicitly sets cache headers:
```typescript
return new Response(resp.body, {
  status: resp.status,
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  }
});
```

### 50. Any frontend feature flags that can disable chat or credits UI? List names and current values.
There don't appear to be explicit feature flags for disabling the chat or credits UI. The application does handle different states based on:

1. User authentication status
2. Credit availability
3. Subscription status

But these are dynamic states rather than feature flags.

The closest thing to a feature flag might be the conditional rendering based on subscription and credit status:
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

Based on this comprehensive analysis of the RIA Hunter frontend codebase, we can identify several key insights:

1. **API Configuration**: The application primarily uses relative URLs for API calls, with API routes in Next.js acting as proxies to the backend. This architecture can potentially lead to issues if the frontend's `/api/*` routes shadow backend endpoints.

2. **Streaming Implementation**: The application implements two different methods for streaming chat:
   - A POST-based streaming implementation using the Fetch API
   - A GET-based implementation using EventSource
   
   The primary implementation used is the POST method.

3. **Authentication**: The application uses Supabase for authentication and stores the access token in sessionStorage. There's no explicit token refresh mechanism for expired tokens.

4. **Credits System**: 
   - The current system provides 2 free credits to anonymous users
   - Credits are tracked in localStorage with server verification
   - To increase freebies to 15, the fallback constants in useCredits.ts would need to be updated

5. **Error Handling**: The application uses Axiom for logging, but there's limited user-facing error diagnostics beyond basic error messages.

6. **Caching**: API routes explicitly disable caching with appropriate headers, reducing the risk of stale responses.

These findings provide valuable context for addressing the current issues and implementing the planned increase to 15 free credits for anonymous users.
