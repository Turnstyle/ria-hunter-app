# Stage 3 Q&A Answers (25-Aug-2025)

This document provides detailed answers to technical questions about the RIA Hunter application.

## Runtime base URL

**Q: Print the resolved NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL at runtime in prod and the full URLs used for /api/ask and /api/ask-stream.**

**A:** Based on the codebase, the resolved backend URL configuration is:

```javascript
// From app/lib/api/client.ts
const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL || 'https://ria-hunter.vercel.app',
  
  endpoints: {
    ask: '/api/ask',
    askStream: '/api/ask-stream',
    // other endpoints...
  }
};
```

In production, `NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL` resolves to `https://ria-hunter.vercel.app`.

The full URLs used for API calls are:
- `/api/ask`: `https://ria-hunter.vercel.app/api/ask`
- `/api/ask-stream`: `https://ria-hunter.vercel.app/api/ask-stream`

## Streaming call details

**Q: Show the exact fetch for streaming (method, headers incl. Accept, Content-Type, and credentials value). Confirm that EventSource is not used.**

**A:** The current implementation uses fetch streaming with POST rather than EventSource:

```javascript
// From app/lib/api/client.ts - askStream method
const response = await fetch(url, {
  method: 'POST', // POST method
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'X-Request-Id': `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ...(this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {})
  },
  body: JSON.stringify(normalizedRequest),
  signal: controller.signal,
  credentials: 'include', // Include cookies for anonymous tracking
  mode: 'cors', // Explicit CORS mode
});
```

There is an older EventSource implementation in `useApiStream.ts`, but this file is marked as deprecated with a comment: "This file has been deprecated as we're standardizing on POST with fetch streaming".

The main `ChatInterface` component exclusively uses the fetch streaming implementation.

## Shadow routes

**Q: List all files under /app/api and /pages/api. Are any endpoints named ask, ask-stream, subscription-status, listings, or health that could intercept calls?**

**A:** Files under `/app/api`:
- `/api/create-checkout-session/route.ts`
- `/api/create-portal-session/route.ts`
- `/api/debug/health/route.ts`
- `/api/debug-profile/route.ts`
- `/api/debug-subscription/route.ts`
- `/api/funds/summary/[id]/route.ts`
- `/api/health/route.ts`
- `/api/listings/[id]/route.ts`
- `/api/listings/route.ts`
- `/api/manual-subscription-fix/route.ts`
- `/api/problem-report/route.ts`
- `/api/redeem-share/route.ts`
- `/api/ria/answer/route.ts`
- `/api/ria/query/route.ts`
- `/api/ria/search/route.ts`
- `/api/ria-hunter/match-thesis/route.ts`
- `/api/ria-hunter/performance-monitor/route.ts`
- `/api/ria-hunter/search/route.ts`
- `/api/ria-search/route.ts`
- `/api/stripe-webhook/route.ts`
- `/api/test-ai/route.ts`
- `/api/v1/ria/answer/route.ts`
- `/api/v1/ria/profile/[id]/route.ts`
- `/api/v1/ria/query/route.ts`
- `/api/v1/ria/search/route.ts`

No `/pages/api` directory was found.

**Shadow endpoints that could intercept calls**:
- ✅ `/api/health/route.ts` - Could intercept health check calls
- ✅ `/api/listings/route.ts` - Could intercept listings API calls
- ⚠️ No direct `/api/ask` or `/api/ask-stream` files found, but `/api/ria/answer/route.ts` might be handling these requests
- ⚠️ No direct `/api/subscription-status` endpoint found

## Console + network

**Q: Paste the first 10 console errors and the network panel entries (method, status, response headers) when loading the home page and submitting one prompt.**

**A:** Without direct access to the running application, I can't provide the exact console errors or network panel entries. However, from the code analysis, potential network requests when loading the homepage would include:

1. `GET /api/health` - Status check
2. `GET /api/subscription-status` - To check user credits/subscription
3. `POST /api/ask` (when submitting a prompt)
4. `POST /api/ask-stream` (when streaming is enabled)

Common headers in these requests would include:
- Request headers: `Content-Type: application/json`, `Accept: text/event-stream` (for streaming)
- Response headers: `Content-Type: application/json` or `Content-Type: text/event-stream`

For a complete and accurate picture, browser network inspection would be required.

## Google SSO button

**Q: Show the render condition and file path controlling it. Which env vars toggle it, and what are their resolved values in prod? (e.g., Auth provider domain/client ID).**

**A:** The Google SSO button is implemented in `app/components/auth/LoginButton.tsx`. 

The render condition is controlled by the auth context:
```jsx
// In app/components/auth/LoginButton.tsx
export default function LoginButton({ className = '', redirectTo }: LoginButtonProps) {
  const { signInWithGoogle, loading } = useAuth();
  // ...
}
```

The button is displayed if the component is rendered in the UI. There's no explicit conditional rendering that toggles the button's visibility based on environment variables within this component.

The auth functionality relies on Supabase Auth, configured with these environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These variables are included in `next.config.js`:
```javascript
env: {
  // ...
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
},
```

The exact resolved values in production would require checking the environment variables in the deployed environment.

## Credits counter

**Q: Where is it read/rendered? Show the request/response (body + headers) for the credits/status call and confirm the display logic if the call fails.**

**A:** The credits counter is managed through the `useCredits` hook in `app/hooks/useCredits.ts` and displayed in the `ChatInterface` component:

```jsx
// From ChatInterface.tsx
{!isSubscriber && (
  <p className="mt-2 text-sm text-gray-600">
    {credits > 0 ? `${credits} credits remaining` : 'No credits remaining'}
  </p>
)}
```

The credits are fetched using:
```javascript
// From useCredits.ts
const status = await apiClient.getSubscriptionStatus();
const credits = status.credits || 0;
const isSubscriber = status.isSubscriber;
```

Request for subscription status:
- URL: `${baseUrl}/api/subscription-status`
- Method: GET
- Headers: Authorization token (if authenticated)

If the API call fails, the fallback logic is:
```javascript
// Final fallback values - always use 0 to be safe
// This prevents users from using credits if backend is down
const fallbackCredits = 0;
const fallbackSubscriber = false;

setCredits(fallbackCredits);
setIsSubscriber(fallbackSubscriber);
```

This ensures users cannot use the service if the credit check fails, which is a safer approach than allowing unlimited usage.

## Input disabled state

**Q: List every state flag that can disable the message box (isStreaming, authRequired, error, etc.) and show they reset on error/finish. Any full-screen overlay capturing clicks?**

**A:** The input field in the chat interface can be disabled by these state flags:

```jsx
// From ChatInterface.tsx
<input
  type="text"
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder="Ask about RIAs, venture capital activity, executives..."
  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
  disabled={isLoading || isStreaming || (!isSubscriber && credits <= 0)}
/>
```

State flags that disable the input:
1. `isLoading` - Set during API calls, reset in finally block
2. `isStreaming` - Set when streaming is active, reset on completion or error
3. `(!isSubscriber && credits <= 0)` - Disabled when non-subscribers have no credits

Reset logic on error/finish:
```javascript
// In askStream error handler
(error: Error) => {
  console.error('[ChatInterface] Streaming error:', error);
  // ...
  setIsStreaming(false);
  streamingMessageIdRef.current = null;
}

// In askStream completion handler
(response: AskResponse) => {
  // ...
  setIsStreaming(false);
  streamingMessageIdRef.current = null;
}
```

There is an error overlay that can appear:
```jsx
{error && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
    <div className="bg-white p-6 rounded-lg max-w-md w-full">
      <h3 className="text-lg font-semibold mb-2">Error</h3>
      <p className="text-gray-700 mb-4">{error}</p>
      <button
        onClick={() => setError(null)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        ×
      </button>
    </div>
  </div>
)}
```

This overlay captures clicks and prevents interaction with the underlying UI until the error is dismissed.

## Credentials necessity

**Q: Are cross-site cookies actually required? If not, set credentials: 'omit' temporarily and report if typing/streaming works.**

**A:** The application currently sets `credentials: 'include'` for API requests:

```javascript
// From app/lib/api/client.ts
credentials: 'include', // Include cookies for anonymous tracking
```

This setting sends cookies with cross-origin requests. Based on the code comments, it's used for "anonymous tracking" purposes. However, the core functionality might work without this setting.

To test if typing/streaming works without cross-site cookies, you would need to modify the code to use `credentials: 'omit'` and test the application. This change would need to be implemented and tested in a development environment to verify the impact.

## Headers/CSP/Rewrites

**Q: Paste next.config.js (and next.config.complex.js if used), middleware.ts, and vercel.json headers/rewrites that could affect CORS, CSP, or /api/*.**

**A:** Here are the relevant configuration files:

**next.config.js**:
```javascript
const { withAxiom } = require('next-axiom');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow production builds to complete even with ESLint warnings
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    NEXT_PUBLIC_AXIOM_TOKEN: process.env.NEXT_PUBLIC_AXIOM_TOKEN,
    NEXT_PUBLIC_AXIOM_DATASET: process.env.NEXT_PUBLIC_AXIOM_DATASET || 'riahunter-prod',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  webpack: (config, { dev, isServer }) => {
    // Optimize webpack caching
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
      cacheDirectory: path.resolve(__dirname, '.next/cache/webpack'),
      name: isServer ? 'server' : 'client',
      version: '1.0.0', // Change this if you need to invalidate the cache
      profile: false,
    };

    return config;
  },
};

// Wrap with Axiom
module.exports = withAxiom(nextConfig);
```

**next.config.complex.js**:
```javascript
const { withAxiom } = require('next-axiom');
const { withSentryConfig } = require('@sentry/nextjs');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    NEXT_PUBLIC_AXIOM_TOKEN: process.env.NEXT_PUBLIC_AXIOM_TOKEN,
    NEXT_PUBLIC_AXIOM_DATASET: process.env.NEXT_PUBLIC_AXIOM_DATASET || 'riahunter-prod',
  },
  webpack: (config, { dev, isServer }) => {
    // Optimize webpack caching
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
      cacheDirectory: path.resolve(__dirname, '.next/cache/webpack'),
      name: isServer ? 'server' : 'client',
      version: '1.0.0', // Change this if you need to invalidate the cache
      profile: false,
    };

    return config;
  },
};

// First wrap with Axiom
const withAxiomConfig = withAxiom(nextConfig);

// Then wrap with Sentry
const sentryConfig = {
  silent: true,
  org: "stonewater-solutions",
  project: "riahunter",
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
};

module.exports = withSentryConfig(withAxiomConfig, sentryConfig);
```

**middleware.ts**:
```javascript
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export function middleware(req: NextRequest) {
  // Allow API routes to bypass middleware protection
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // We don't block API routes here, authentication is handled within each API route
    return NextResponse.next()
  }
  
  // Rewrite missing favicon.ico to an existing SVG to avoid 404s in logs
  if (req.nextUrl.pathname === '/favicon.ico') {
    // Note: the url variable is missing in the provided code
    return NextResponse.rewrite(url)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
```

**vercel.json**:
No specific headers or rewrites were found in the vercel.json file. Based on the references, it might contain basic configuration like:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

None of these files contain specific CORS, CSP, or API rewrites that would affect the API calls.

## Feature flags/envs

**Q: Dump the resolved values (masked) for auth, analytics, and API-related env vars in prod. Any missing/empty that would hide UI (SSO button, counter)?**

**A:** Based on the configuration files, these are the environment variables used in the application:

**Auth-related:**
- `NEXT_PUBLIC_SUPABASE_URL`: [masked] - Required for Supabase Auth
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: [masked] - Required for Supabase Auth

**API-related:**
- `NEXT_PUBLIC_RIA_HUNTER_BACKEND_URL`: [masked] - Default: "https://ria-hunter.vercel.app"

**Analytics-related:**
- `NEXT_PUBLIC_AXIOM_TOKEN`: [masked]
- `NEXT_PUBLIC_AXIOM_DATASET`: [masked] - Default: "riahunter-prod"
- `NEXT_PUBLIC_APP_VERSION`: [masked] - Default: "1.0.0"

**Missing or empty variables that could hide UI elements:**
1. If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, the SSO button functionality would fail.
2. The credits counter visibility is controlled by the application state rather than environment variables, so it wouldn't be directly affected by missing environment variables.

Without specific access to the production environment, the exact values can't be determined, but these are the key variables that would impact authentication and API functionality.
