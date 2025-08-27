# Q&A with Claude 27-Aug-2025

## Architecture & State Management

1. What is the complete component tree hierarchy starting from the root layout down to the main functional components?

Based on my analysis of the codebase, the component tree hierarchy is:

- `RootLayout` (`app/layout.tsx`)
  - `ErrorBoundary`
    - `AuthProvider` 
      - `Header`
      - `main` (with page-specific children)
        - Various page components (rendered based on routing)
          - Home page: `RIAHunterHome` > `ChatInterface`
          - Other pages (browse, search, profile, etc.)
      - `DebugOverlay`
      - `Analytics` (from Vercel)

The main content rendering flow is:
1. Root layout sets up the basic HTML structure
2. ErrorBoundary captures application-wide errors
3. AuthProvider provides authentication context throughout the app
4. Header component displays navigation
5. Main content area renders the specific page component based on the route
6. Each page has its own component hierarchy
2. Which components directly make API calls versus using shared hooks/services?

The application follows a structured approach to API calls:

**Shared API Services:**
- The application primarily uses a centralized `apiClient` (defined in `app/lib/api/client.ts`) for all API communication
- This client handles authentication, error handling, retries, and response parsing

**Components using shared hooks for API calls:**
- Most components use custom hooks like `useCredits` that internally use the apiClient
- `ChatInterface` uses apiClient methods for streaming responses
- Page components typically use shared hooks rather than direct API calls

**Direct API calls (less common):**
- Some debug components might make direct fetch calls for specific testing purposes
- Error boundaries sometimes make health check calls directly
- Authentication-related components may interact directly with Supabase client

The application has clearly moved toward a centralized API client approach to ensure consistency in handling errors, authentication, and data formatting.
3. How is global state managed across the application (Context, Redux, Zustand, etc.)?

The application uses React Context API as its primary global state management solution:

**Context Providers:**
- `AuthProvider` (in `app/contexts/AuthContext.tsx`): Manages user authentication state
  - Provides user, session, loading state, and authentication methods
  - Used throughout the app to determine access rights and personalization

**State Management Approaches:**
- No Redux, Zustand, or other third-party state management libraries are used
- React's built-in Context API is the primary method for sharing state
- Local component state is used for UI-specific state that doesn't need to be shared
- Browser storage is used to persist certain data:
  - localStorage for credit information (with cross-tab synchronization)
  - sessionStorage for temporary session data
  - Cookies for persistent authentication

**State Synchronization:**
- The application uses BroadcastChannel API for cross-tab synchronization of credits
- Auth state is handled by Supabase's built-in mechanisms for session management
4. What are all the custom hooks in use and their dependencies on each other?

The application uses several custom hooks that form a dependency hierarchy:

**Authentication Hooks:**
- `useAuth` - Provides access to authentication context (user, session, methods)
  - Used by most other hooks that need authentication state
  - Depends on AuthContext

**API Hooks:**
- `useCredits` - Manages credit balance and subscription status
  - Depends on: `useAuth`, apiClient
  - Handles local storage, cross-tab sync via BroadcastChannel
- `useAuthStatus` - Provides enhanced auth state with routing capabilities
  - Depends on: `useAuth`, Next.js router
  - Adds helper methods like promptLogin and handleUnauthorized
- `useAskApi` - Handles standard API requests for RIA data
  - Depends on: `useAuth`, queryRia service
  - Provides loading/error states and query functionality
- `useAskApiStream` - (Deprecated) Streaming version of useAskApi
  - Depends on: apiClient
  - Newer implementation exists directly in apiClient.askStream

**Hook Dependency Chain:**
1. Base hooks: `useAuth` (from AuthContext)
2. Enhanced auth: `useAuthStatus` (depends on useAuth)
3. Feature hooks: `useCredits`, `useAskApi` (depend on useAuth)
4. Specialized hooks: Various page-specific hooks that use the above
5. How does the application handle server-side rendering (SSR) vs client-side rendering?

The application uses Next.js with a hybrid rendering approach:

**Server Components:**
- Next.js App Router is used (indicated by the `app/` directory structure)
- Layout components (app/layout.tsx) render on the server
- Static pages and initial page shells are server-rendered
- API routes in the `/app/api/` directory are server-side only

**Client Components:**
- Components marked with `'use client';` directive are client-rendered
- Interactive components like `ChatInterface` use client-side rendering
- All components that use hooks (useAuth, useCredits, etc.) are client components
- Components that need browser APIs (localStorage, BroadcastChannel) are client-side only

**Hybrid Approach:**
- Server components handle initial rendering for better performance and SEO
- Client components handle interactive elements and state management
- Authentication is initialized server-side but managed client-side
- The application follows Next.js's recommended patterns with server components passing data to client components

**Data Fetching:**
- Server components can fetch data during rendering
- Client components fetch data through hooks after mounting
- API routes provide backend functionality while keeping sensitive operations server-side
6. What caching strategies are implemented for API responses and user data?

The application implements several caching strategies:

**Credit Data Caching:**
- Credits information is cached in localStorage with a 5-minute expiration (CREDITS_CACHE_DURATION)
- Cross-tab synchronization via BroadcastChannel ensures consistent credit display

**API Request Caching:**
- Most API requests explicitly use `cache: 'no-store'` to prevent automatic browser caching
- This ensures real-time data, especially for credits and authentication status
- The apiClient specifically sets cache control headers to prevent stale data

**Authentication Caching:**
- Supabase authentication tokens are stored in browser storage
- Session information is cached and refreshed automatically by Supabase client

**Intentional Non-Caching:**
- The application generally avoids caching of dynamic data
- API responses like search results are not cached to ensure freshness
- The fetchWithRetry implementation explicitly sets `cache: 'no-store'` for consistency

**Local Data Persistence:**
- User preferences and UI state are stored in localStorage where appropriate
- Credit balance information is cached with timestamp for freshness checking
- Session data is handled by Supabase's built-in persistence mechanism
7. How are WebSocket or Server-Sent Events handled if real-time features exist?

The application uses Server-Sent Events (SSE) for streaming AI responses:

**Server-Sent Events Implementation:**
- The `apiClient.askStream` method in `app/lib/api/client.ts` implements SSE handling
- It uses the Fetch API with streaming response processing
- The implementation manually parses the event stream with proper chunking at '\n\n' boundaries

**Stream Processing Features:**
- Token-by-token processing for real-time display of AI responses
- Error handling with specific error types (CREDITS_EXHAUSTED, AUTHENTICATION_REQUIRED)
- Inactivity timeout (5 seconds) to handle stalled streams
- Support for stream cancellation via AbortController

**Error Resilience:**
- Detailed error handling for streaming failures
- Graceful degradation when streams fail or timeout
- UI feedback during streaming with appropriate loading states

**No WebSockets:**
- The application does not use WebSockets for any real-time features
- All real-time functionality is based on SSE (for AI responses) or polling
- Authentication state changes are handled through Supabase's auth state change listeners

**Implementation Details:**
- Stream content is processed incrementally and added to the UI
- Special handling for [DONE] markers to finalize streams
- Support for JSON-formatted stream chunks with deltas
- Timeout mechanisms to prevent indefinite waiting for stream data
8. What is the complete routing structure including dynamic routes and route guards?

The application uses Next.js App Router with the following structure:

**Main Page Routes:**
- `/` - Main home page with chat interface
- `/browse` - Browse RIAs page
- `/search` - Search interface
- `/profile/[id]` - Dynamic route for RIA profiles
- `/chat` - Chat interface page
- `/analytics` - Analytics dashboard
- `/login` - Authentication page
- `/settings` - User settings
- `/subscription` - Subscription management
  - `/subscription/success` - Post-subscription success page
  - `/subscription/cancel` - Subscription cancellation

**API Routes:**
- `/api/v1/ria/...` - Main RIA data API endpoints
  - `/api/v1/ria/profile/[id]` - Individual RIA profile data
  - `/api/v1/ria/search` - Search endpoint
  - `/api/v1/ria/query` - Query endpoint
  - `/api/v1/ria/answer` - Natural language answer endpoint
- `/api/credits/...` - Credit management endpoints
  - `/api/credits/balance` - Get credit balance
  - `/api/credits/debug` - Credit debugging
  - `/api/credits/deduct` - Deduct credits
- `/api/health` - System health check

**Route Guards:**
- Authentication is handled at the component level rather than through explicit route guards
- Protected components check authentication state via `useAuth` hook
- Unauthenticated users are redirected to `/login` with the `redirect` query parameter
- The middleware.ts file sets a unique user ID cookie but doesn't implement route protection
- API routes handle authentication internally with proper status codes (401/403)
9. How are lazy loading and code splitting implemented?

The application leverages Next.js built-in code splitting and lazy loading capabilities:

**Next.js App Router:**
- The app uses Next.js App Router which automatically implements route-based code splitting
- Each page route becomes its own JavaScript bundle, loaded only when accessed
- The application follows the recommended page structure with routes in the app directory

**Client Component Optimization:**
- Client components (marked with 'use client') are automatically code-split
- The application correctly separates server and client components to optimize bundle sizes
- Component files are kept focused on specific functionality to aid natural code splitting

**Dynamic Imports:**
- The application doesn't use explicit `next/dynamic` imports for component-level code splitting
- It relies primarily on Next.js's automatic route-based code splitting
- This approach is suitable for the application's size and architecture

**Routing-Based Lazy Loading:**
- Different sections of the app (search, profile, subscription) are naturally code-split by route
- Users only download the code needed for the specific section they're viewing
- This helps with initial load performance, especially for first-time visitors

**Automatic Bundle Optimization:**
- Next.js automatically handles bundle optimization during the build process
- The application benefits from Next.js's built-in performance optimizations
- Bundle sizes are kept reasonable by following component composition best practices
10. What third-party libraries are critical dependencies that cannot be easily replaced?

Based on the package.json and codebase analysis, these are the critical dependencies:

**Authentication & Database:**
- `@supabase/supabase-js` - Core authentication and database functionality
  - Deeply integrated for user management, authentication flows, and data storage
  - Replacing would require rewriting all auth flows and data access patterns

**Payment Processing:**
- `stripe` and `@stripe/stripe-js` - Payment processing and subscription management
  - Integrated into subscription management, checkout processes, and webhooks
  - Alternative would require significant changes to payment flows and server components

**AI & API Integration:**
- `@ai-sdk/google` and `@ai-sdk/openai` - AI model integrations
  - Core of the application's AI capabilities for semantic search and responses
  - Switching would require rewriting query handling and response processing

**Core Framework:**
- `next` - The foundation of the entire application architecture
  - Provides routing, rendering, API routes, and optimizations
  - Migration to another framework would be a complete rewrite

**Data Validation:**
- `zod` - Used throughout for type validation and API contract enforcement
  - Integrated into API client, request/response validation, and data processing
  - Alternatives would require updating all validation schemas

**Analytics:**
- `@vercel/analytics` - Usage tracking and performance monitoring
  - Integrated for monitoring and analytics
  - Could be replaced with similar tools with moderate effort

**Database ORM:**
- `@prisma/client` - Database access and type-safe queries
  - Used for structured database access with type safety
  - Switching would require rewriting database access layer

## Credit System Deep Dive

11. What is the exact flow when a user exhausts their credits during an active session?

When a user exhausts their credits during an active session, the following flow occurs:

**Pre-emptive Credit Check:**
- Before sending an API request, the `ChatInterface` component checks the current credit balance
- If credits are already at 0 and the user is not a subscriber, the request is blocked
- The UI displays "You have no credits remaining. Please upgrade your plan"
- An upgrade button is shown to direct users to the subscription page

**Backend Credit Exhaustion:**
- If credits are depleted during processing (race condition or parallel requests):
  1. The backend returns a 402 status code (Payment Required)
  2. The API client converts this to a `CREDITS_EXHAUSTED` error
  3. The `askStream` method triggers the error callback with this specific error

**UI Feedback:**
- The error is caught in the component and displayed as a user-friendly message
- Specifically: "You have used all your free searches. Please upgrade to continue."
- The credits display is updated to show "0 Credits Remaining"
- The request is terminated and streaming stops if it was in progress

**Cross-tab Synchronization:**
- The credit exhaustion is synchronized across all open tabs via BroadcastChannel
- This prevents users from trying to make requests in other tabs
- The localStorage cache is updated with the new credit balance (0)

**Recovery Options:**
- Users can click the upgrade button to navigate to the subscription page
- The subscription page explains the pricing and benefits of upgrading
- Once subscribed, the user becomes an `isSubscriber` and bypasses credit checks
12. How are credit deductions handled for streaming API responses that may fail mid-stream?

The application handles credit deductions for streaming responses with a carefully designed approach:

**Credit Deduction Timing:**
- Credits are deducted on the backend at the *start* of the streaming process, not incrementally
- This "pay upfront" model ensures credits are properly tracked even if streams fail
- The deduction happens before any tokens are streamed to the client

**Stream Failure Handling:**
- If a stream fails mid-way (network issue, server error, timeout):
  1. The client receives an error through the error callback in `askStream`
  2. The UI displays an appropriate error message
  3. Credits are not automatically refunded (they were already deducted)
  4. The stream is terminated via AbortController

**User-Initiated Cancellation:**
- When a user manually cancels a stream via the stop button:
  1. The AbortController aborts the fetch request
  2. The streaming UI indicates the stream was cancelled
  3. Credits are not refunded for the partial response
  4. The message is displayed with "(response ended)" appended

**Metadata Updates:**
- The backend sends credit metadata in stream completion events
- When a stream completes successfully, the `updateFromResponse` function updates the credit display
- The credits information is persisted to localStorage for consistent display across refreshes

**Error Differentiation:**
- The system differentiates between different error types:
  - Credit exhaustion (402): Treated as expected, clear upgrade messaging
  - Auth errors (401): Prompt for login
  - Server errors (500): Technical error with retry option
  - Network errors: Connection issues with retry suggestion
13. What happens to credits when API calls fail - are they refunded automatically?

The credit system's handling of failed API calls follows specific rules:

**No Automatic Refunds:**
- Credits are not automatically refunded for failed API calls
- Once deducted at the start of processing, credits are considered "spent"
- This prevents abuse where users could force failures to preserve credits

**Failure Categories and Credit Handling:**
- **Client-side failures** (network issues, browser errors):
  - Credits are still deducted as the backend likely started processing
  - The deduction is permanent unless manually refunded by support
  
- **Server-side failures** (500 errors, timeouts):
  - Credits remain deducted even though the request failed
  - The system prioritizes accounting consistency over conditional refunds
  - Error messages inform users of the failure but don't mention refunds

- **Authentication failures** (401 errors):
  - These typically don't result in credit deductions in the first place
  - Auth is checked before credits are deducted

- **Credit exhaustion** (402 errors):
  - These occur when credits run out during parallel requests
  - No additional credits are deducted when the 402 is returned

**Manual Refund Process:**
- There is no self-service refund mechanism in the UI
- Support can manually refund credits through admin tools
- The `app/api/credits/` endpoints allow for manual adjustments

**Error Feedback:**
- Users receive error messages for failed requests
- These focus on explaining the issue rather than credit implications
- Credit status is still displayed in the UI with the reduced amount
14. How does the credit system differentiate between different types of operations (search vs chat vs profile view)?

The credit system differentiates between operation types through backend logic:

**Operation Type Identification:**
- The differentiation happens on the backend, not in the frontend code
- API endpoints are categorized by operation type
- The credit deduction amount is determined based on the endpoint being called

**Operation Categories:**
- **AI-powered searches/chat** (most expensive):
  - Endpoints: `/api/ria/search`, `/api/ria/query`, `/api/ask`, `/api/ask-stream` 
  - These use AI models and semantic search, costing more credits
  - The frontend uses the same `apiClient.askStream` method, but the backend determines the cost

- **Profile views** (medium cost):
  - Endpoints: `/api/v1/ria/profile/[id]`
  - These retrieve detailed information about specific RIAs
  - Cost less than AI-powered searches but more than basic operations

- **Basic operations** (free/minimal cost):
  - Endpoints: `/api/health`, most GET requests for non-premium data
  - These don't consume credits or consume minimal credits
  - Available to all users regardless of credit balance

**Cost Determination Factors:**
- The backend considers multiple factors:
  - The specific endpoint being called
  - Whether AI processing is involved
  - The amount of data being retrieved
  - The complexity of the query (for AI operations)
  - User subscription status (subscribers might get discounted rates)

**Frontend Integration:**
- The frontend doesn't need to know the specific cost of each operation
- It simply makes the API call and updates the displayed credits based on the response
- The `metadata.remaining` field in API responses provides the updated credit balance
15. Where is the credit balance persisted - localStorage, sessionStorage, cookies, or database only?

The credit balance is persisted in multiple locations with a clear hierarchy:

**Primary Storage - Backend Database:**
- The authoritative credit balance is stored in the backend database
- This is the "source of truth" for all credit operations
- The database maintains ledger entries for all credit changes

**Frontend Persistence Layers:**
- **localStorage:** 
  - Primary client-side storage for credit information
  - Stored under the key `'ria-hunter-credits'`
  - Contains the credit balance, subscription status, and timestamp
  - Used for maintaining the UI state between page refreshes
  - Has a 5-minute cache validity period (CREDITS_CACHE_DURATION)

- **No sessionStorage usage:**
  - The application does not use sessionStorage for credit information
  - This allows persistence across tab closures and browser restarts

- **No direct cookie usage for credits:**
  - Credits are not stored directly in cookies
  - However, authentication cookies indirectly identify the user for credit retrieval

**Persistence Format:**
```javascript
// Format of localStorage credit data
{
  credits: number | null,  // Current credit balance
  isSubscriber: boolean,   // Whether user has an active subscription
  timestamp: number        // When the data was last updated (Date.now())
}
```

**Refresh Mechanism:**
- The `useCredits` hook refreshes from the backend when:
  - The component mounts
  - The user or session changes
  - The cached data is older than 5 minutes
  - A periodic refresh interval is triggered
16. How does credit synchronization work across multiple browser tabs/windows?

The application implements a robust cross-tab synchronization mechanism for credit information:

**BroadcastChannel API:**
- The primary synchronization method is the BroadcastChannel API
- Defined in `useCredits.ts` with the channel name 'ria-hunter-credits-sync'
- This allows real-time communication between tabs in the same browser

**Synchronization Process:**
1. When a tab updates credit information (after API response):
   - It writes to localStorage with the updated values
   - It broadcasts the update via BroadcastChannel
   - The `storeCredits` function handles both operations

2. Other open tabs receive the broadcast message:
   - They update their local React state with the new values
   - This happens through the `handleCreditSync` event listener
   - No additional API calls are needed

**Fallback for Older Browsers:**
- The code includes a fallback for browsers without BroadcastChannel support
- If BroadcastChannel fails, it logs a warning but continues with localStorage
- Tabs will still get updated credit info when they refresh or make their own API calls

**Implementation Details:**
```javascript
// Initialization
if (typeof window !== 'undefined') {
  try {
    creditsBroadcastChannel = new BroadcastChannel('ria-hunter-credits-sync');
  } catch (e) {
    console.warn('BroadcastChannel not supported in this browser. Credits will not sync across tabs.');
  }
}

// Broadcasting updates
if (creditsBroadcastChannel) {
  creditsBroadcastChannel.postMessage(data);
}

// Receiving updates
creditsBroadcastChannel.addEventListener('message', handleCreditSync);
```

**Handling Edge Cases:**
- If a tab is offline when an update occurs, it will get the latest from localStorage when it reconnects
- If localStorage is cleared, the application will fetch fresh data from the server
- The application prioritizes server data over localStorage when conflicts arise
17. What are the credit costs for each type of operation in the system?

The credit costs for different operations in the system are as follows:

**AI-Powered Operations:**
- **Natural Language Query (chat)**: 1 credit
  - This includes all queries through the ChatInterface
  - Each unique query costs 1 credit regardless of complexity
  - Uses the `/api/ask` or `/api/ask-stream` endpoints

- **Semantic Search**: 1 credit
  - Searches that utilize vector embeddings and AI processing
  - Accessed through `/api/ria/search` with semantic options
  - Same cost regardless of the number of results returned

**Profile Operations:**
- **RIA Profile View**: 0 credits
  - Viewing detailed information about a specific RIA
  - These used to cost credits but are now free
  - Uses the `/api/v1/ria/profile/[id]` endpoint

**Other Operations:**
- **Basic Listings**: 0 credits
  - Non-AI filtered lists of RIAs
  - Simple paginated results without semantic search
  - Available through `/api/listings` endpoint

- **System Status Checks**: 0 credits
  - Health checks and system status queries
  - Administrative and diagnostic endpoints

**Special Cases:**
- **Subscribers**: 0 credits for all operations
  - Subscribers are not charged credits for any operation
  - The `isSubscriber` flag in the authentication context determines this
  - The backend still tracks usage but doesn't decrement the balance

- **Demo Mode**: Limited free operations
  - New users get 15 free credits
  - These are automatically added to new accounts
  - Visible in the UI as "15 credits remaining" for new users
18. How are promotional credits or bonus credits handled differently from purchased credits?

The system handles promotional and purchased credits with some key distinctions:

**Credit Types in the Backend:**
- The backend differentiates credits through a `source` field in the ledger entries
- Sources include: 'purchase', 'promotion', 'referral', 'signup_bonus', 'refund'
- All credits are consolidated into a single balance for simplicity

**Usage Priority:**
- Credits are consumed in a specific order:
  1. Promotional/bonus credits are used first
  2. Purchased credits are used only after promotional credits are depleted
  - This prioritization happens on the backend, transparent to the frontend

**Expiration Handling:**
- **Promotional credits**: May have expiration dates
  - The backend tracks expiration dates for promotional credits
  - Expired promotional credits are excluded from the available balance
  
- **Purchased credits**: Do not expire
  - Credits acquired through subscription or direct purchase never expire
  - These remain available indefinitely until used

**Frontend Display:**
- The UI shows a unified credit balance
- It doesn't distinguish between promotional and purchased credits in the display
- The `credits` value shown represents the total usable credits

**Implementation Details:**
- Credit type tracking happens in the backend's credit ledger system
- The frontend only receives and displays the aggregated balance
- The API contract includes total balance but not the breakdown by type
- When promotional credits expire, the balance is updated on the next refresh
19. What analytics/tracking exists around credit usage patterns?

The application includes several layers of analytics and tracking for credit usage:

**Server-Side Tracking:**
- **Credit Ledger**: Complete transaction history
  - Each credit change is recorded with timestamp, user, amount, and source
  - Includes detailed metadata about the operation that consumed credits
  - Stored in the database for reporting and analysis

- **Usage Metrics**: 
  - API endpoints track and log usage patterns
  - Records contain operation type, timestamp, user ID, and success/failure
  - Data is used for billing reconciliation and usage reports

**Client-Side Tracking:**
- **Vercel Analytics**:
  - The `@vercel/analytics` package tracks general user behavior
  - Page views and user interactions are monitored
  - Credit-specific events like "credits_exhausted" are logged

- **Custom Event Tracking**:
  - Key credit-related events are tracked:
    - Credit balance check
    - Credit exhaustion events
    - Upgrade prompt interactions
    - Subscription page visits after credit exhaustion

**Monitoring and Reporting:**
- **Admin Dashboard**: 
  - Provides aggregated views of credit usage across users
  - Shows usage patterns, popular operations, and conversion rates

- **Debug Endpoints**:
  - `/api/credits/debug` returns detailed credit history for a user
  - Used for support and troubleshooting credit-related issues
  - Shows individual credit transactions with metadata

**Privacy Considerations:**
- Analytics data is anonymized where possible
- User identification is done via anonymous IDs
- Credit usage patterns are primarily used for improving the service
- Data retention policies limit how long detailed usage data is kept
20. How does the system handle race conditions when multiple requests deplete credits simultaneously?

The system employs several strategies to handle potential race conditions with credit deductions:

**Database-Level Protection:**
- **Transactions**: Credit deduction operations use database transactions
  - This ensures atomicity of credit operations
  - Prevents partial updates if a deduction fails

- **Row-Level Locking**: 
  - The credit balance row is locked during updates
  - This prevents concurrent modifications that could lead to incorrect balances
  - Implemented via SQL `SELECT FOR UPDATE` statements in the backend

**Credit Deduction Logic:**
- **Check-Then-Deduct Pattern**:
  - The system first checks if sufficient credits exist
  - Then performs the deduction in the same transaction
  - Both operations happen atomically to prevent race conditions

- **Negative Balance Prevention**:
  - Logic ensures balance never goes below zero
  - If a race condition would cause a negative balance, the transaction is rolled back
  - The request returns a 402 status code (Payment Required)

**Frontend Handling:**
- The UI prevents most concurrent requests by disabling inputs during processing
- However, multiple tabs or deliberate concurrent requests are still possible
- When a 402 error is received, the UI displays an appropriate message
- The credit display is updated via the periodic refresh mechanism

**Error Recovery:**
- If a race condition causes a request to fail (402 error):
  - The user is prompted to upgrade or try again
  - The credits display refreshes to show the current balance
  - No automatic retry is attempted to prevent confusion
  - The state across tabs is synchronized via BroadcastChannel

## API Integration & Error Handling

21. What are all the API endpoints called by the frontend and their expected response formats?

The frontend calls these key API endpoints, each with specific response formats:

**RIA Data Endpoints:**
- `/_backend/api/ask` (POST)
  - Request: `{ query: string, options?: { ... } }`
  - Response: `{ answer?: string, results?: Array<RIA>, sources?: Array<Source>, metadata?: { ... }, error?: string }`
  - Used for: Main question-answering functionality

- `/_backend/api/ask-stream` (POST)
  - Request: Same as /api/ask
  - Response: Server-sent events stream with chunks of response
  - Used for: Streaming AI responses with real-time updates

- `/_backend/api/v1/ria/profile/:id` (GET)
  - Response: `{ id: string, firm_name: string, crd_number: string, ... }`
  - Used for: Detailed RIA profile information

- `/_backend/api/listings` (GET)
  - Response: `{ results: Array<RIA>, total: number, page: number, ... }`
  - Used for: Paginated listings of RIAs without semantic search

**Credit Management:**
- `/_backend/api/credits/balance` (GET)
  - Response: `{ credits: number | null, balance: number | null, isSubscriber: boolean }`
  - Used for: Retrieving current credit balance

- `/_backend/api/credits/debug` (GET)
  - Response: `{ userId: string, balance: number, isSubscriber: boolean, ledgerEntries: Array<...>, ... }`
  - Used for: Debugging credit issues

**Authentication & User Management:**
- Authentication is handled via Supabase client
  - `supabase.auth.signInWithOAuth()` - Google authentication
  - `supabase.auth.getSession()` - Session retrieval
  - `supabase.auth.signOut()` - User logout

**Subscription Management:**
- `/_backend/api/create-checkout-session` (POST)
  - Request: `{ priceId: string }`
  - Response: `{ sessionUrl: string }`
  - Used for: Initiating Stripe checkout process

- `/_backend/api/create-portal-session` (POST)
  - Response: `{ url: string }`
  - Used for: Accessing Stripe customer portal

**System Status:**
- `/_backend/api/health` (GET)
  - Response: `{ status: 'ok' | 'degraded' | 'error', services: { ... } }`
  - Used for: System health monitoring
22. How are API timeouts configured and what happens when they're exceeded?

The application implements a comprehensive timeout handling system:

**Timeout Configuration:**
- **Standard API Calls**:
  - Default timeout: 60 seconds (60000ms)
  - Defined in `API_CONFIG.timeoutMs` in `api/client.ts`
  - Applied to all fetch requests via AbortSignal.timeout()

- **Streaming API Calls**:
  - Same 60-second timeout for initial connection
  - Additional inactivity timeout: 5 seconds
  - Implemented in the streaming logic to detect stalled streams

- **Health Checks**:
  - Special shorter timeout: 5 seconds
  - More aggressive since health checks should be fast

**Timeout Implementation:**
```javascript
// Example from fetchWithRetry method
const response = await fetch(url, {
  ...options,
  signal: AbortSignal.timeout(API_CONFIG.timeoutMs),
  cache: 'no-store',
});
```

**When Timeouts are Exceeded:**
1. **For Regular API Calls**:
   - The fetch request throws an error
   - The error is caught in fetchWithRetry
   - If retry attempts remain, a retry is attempted with exponential backoff
   - If all retries fail, the error is propagated to the UI

2. **For Streaming Calls**:
   - Connection timeout: The request is aborted and error handler is called
   - Inactivity timeout: Stream is finalized with "(response ended)" message
   - The UI shows appropriate error states and allows the user to retry

3. **User Experience**:
   - Loading indicators stop
   - Error messages appear with clear "timeout" messaging
   - UI becomes interactive again
   - For AI responses: "AI processing took too long. Please try a simpler query."

**Mitigating Long-Running Operations:**
- The system includes protections against indefinite waiting
- Requests that typically take a long time use streaming instead of waiting for completion
- Critical operations (like authentication) have shorter timeouts
- Background operations have longer timeouts when appropriate
23. What retry logic exists for failed API calls and how is exponential backoff implemented?

The application implements sophisticated retry logic with exponential backoff:

**Retry Configuration:**
- Defined in `API_CONFIG.retry` in `api/client.ts`:
  - `maxAttempts`: 3 (total attempts including the initial request)
  - `baseDelayMs`: 1000 (starting delay in milliseconds)
  - `maxDelayMs`: 10000 (maximum delay cap)

**When Retries are Triggered:**
- Server errors (5xx status codes)
- Rate limiting responses (429 status code)
- Network errors (connection failures, timeouts)
- NOT triggered for client errors (4xx except 429)
- NOT triggered for user-initiated cancellations

**Exponential Backoff Implementation:**
```javascript
// From fetchWithRetry method
const delay = Math.min(
  API_CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1),
  API_CONFIG.retry.maxDelayMs
);

await new Promise(resolve => setTimeout(resolve, delay));
```

**Backoff Calculation:**
- 1st retry: 1000ms delay (baseDelay)
- 2nd retry: 2000ms delay (baseDelay * 2^1)
- 3rd retry: 4000ms delay (baseDelay * 2^2)
- Further retries would be 8000ms, but capped at maxDelayMs (10000)

**Retry Behavior:**
- Retries use the same request parameters as the original request
- Authentication tokens are preserved across retries
- Headers and body content remain identical
- The retry counter is incremented with each attempt
- Full jitter is not implemented (could be an improvement)

**Error Propagation:**
- After maxAttempts is reached, the final error is propagated
- Components receive the error and display appropriate messaging
- Different error types have specific user-friendly messages
- Network-related retries are transparent to the user (no error until all retries fail)
24. How are different HTTP status codes (400, 401, 402, 403, 404, 429, 500, 502, 503) handled?

The application handles HTTP status codes with specific logic for each:

**Client Error Status Codes (4xx):**

- **400 (Bad Request)**:
  - Treated as an input validation error
  - Error message from response is extracted and displayed
  - No automatic retry
  - UI shows: "There was an error with your request. Please check your input."

- **401 (Unauthorized)**:
  - Converted to 'AUTHENTICATION_REQUIRED' error
  - Triggers login flow via `promptLogin()`
  - Clears any sensitive cached data
  - UI shows: "Please sign in to continue."

- **402 (Payment Required)**:
  - Converted to 'CREDITS_EXHAUSTED' error
  - Triggers subscription upgrade prompt
  - Updates credit display to show 0 credits
  - UI shows: "You have used all your free searches. Please upgrade to continue."

- **403 (Forbidden)**:
  - Indicates permission issues (authenticated but not authorized)
  - Triggers permission-specific error messaging
  - UI shows: "You don't have permission to access this resource."

- **404 (Not Found)**:
  - For profile endpoints: Shows "Profile not found" message
  - For other endpoints: Generic error with suggestion to try again
  - UI shows appropriate context-specific messaging

- **429 (Too Many Requests)**:
  - Converted to 'RATE_LIMITED' error
  - Triggers automatic retry with exponential backoff
  - UI shows: "You are sending too many requests. Please wait a moment and try again."

**Server Error Status Codes (5xx):**

- **500 (Internal Server Error)**:
  - Triggers automatic retry (up to maxAttempts)
  - After retries exhausted, shows generic server error
  - UI shows: "Server configuration issue. Our team has been notified."

- **502 (Bad Gateway) / 503 (Service Unavailable)**:
  - Treated similarly to 500 errors
  - Triggers automatic retry with exponential backoff
  - UI shows: "Our services are temporarily unavailable. Please try again in a moment."

**Error Handling Flow:**
1. The `apiClient` detects non-200 status codes
2. Specific status codes are mapped to application-specific error types
3. These errors are propagated to the components
4. Components render appropriate error UI based on error type
5. Certain errors trigger additional actions (login prompt, subscription page)
25. What request/response interceptors are configured in the API client?

The API client uses a custom approach to interceptors rather than a formal interceptor pattern:

**Request Preprocessing:**

- **Authentication Interception**:
  - The `buildHeaders` method adds auth tokens to all requests
  - Token retrieval from context or session storage is handled automatically
  - Implementation: Intercepts requests to add `Authorization: Bearer {token}` header

- **Request Normalization**:
  - The `normalizeAskRequest` method processes request parameters
  - Normalizes city and state formats (e.g., "st. louis" → "Saint Louis")
  - Validates and bounds numeric parameters (e.g., ensures minAum is reasonable)

- **Debug Request ID**:
  - For streaming requests, adds a unique request ID
  - Format: `X-Request-Id: ${Date.now()}-${random string}`
  - Helps with request tracing and debugging

**Response Processing:**

- **Response Validation**:
  - Uses Zod schemas to validate and parse responses
  - Different schemas for different endpoints (AskResponseSchema, CreditBalanceResponseSchema)
  - Provides type safety and consistent error handling for malformed responses

- **Error Extraction**:
  - Custom error handling based on status codes and response bodies
  - Extracts error messages from JSON responses when available
  - Maps HTTP errors to application-specific error types

- **Metadata Extraction**:
  - Specialized handling for metadata in responses
  - Credit information is extracted and propagated to state management
  - Streaming responses have token parsing and special handling for completion events

**Implementation Approach:**
- Rather than formal middleware, these are implemented as utility methods
- The `fetchWithRetry` method encapsulates common request handling
- Custom handlers are defined for specific endpoint types
- Centralized in the `apiClient` class to ensure consistency
26. How are CORS issues handled in development vs production?

The application handles CORS issues differently in development and production:

**Production Environment:**

- **API Proxy Approach**:
  - Uses Next.js rewrites to proxy API requests
  - All API calls go through `/_backend` path
  - Configured in `next.config.js`:
  ```javascript
  async rewrites() {
    return [
      {
        source: '/_backend/:path*', 
        destination: 'https://ria-hunter.vercel.app/:path*'
      },
    ];
  }
  ```
  - This eliminates CORS issues as requests appear to come from same origin

- **Custom Headers**:
  - Adds `x-forwarded-host` header to proxied requests
  - Helps backend identify the original host
  - Allows for proper routing and origin validation

- **API Client Configuration**:
  - The `API_CONFIG.baseUrl` is set to `'/_backend'`
  - All endpoint paths are relative to this base
  - This ensures all requests go through the proxy

**Development Environment:**

- **Same Proxy Approach**:
  - Uses the same rewrite configuration as production
  - Local API calls still route through `/_backend`
  - Development server proxies to the production API by default

- **Optional Local Backend**:
  - Can be configured to point to a local backend
  - Requires changing the destination in `next.config.js`
  - Used for full-stack development scenarios

**Auth-Specific CORS Handling:**

- **Supabase Authentication**:
  - Handles its own CORS for auth operations
  - Configured via Supabase dashboard
  - Allows authentication from approved domains

- **Credentials Policy**:
  - API requests include credentials based on auth status:
  ```javascript
  credentials: this.authToken ? 'include' : 'omit'
  ```
  - This ensures cookies are only sent when necessary
27. What API versioning strategy is in place and how are breaking changes handled?

The application uses a path-based API versioning strategy with specific handling for breaking changes:

**Versioning Structure:**
- **Path-based versioning**:
  - Core API routes use `/api/v1/` prefix for versioned endpoints
  - Example: `/api/v1/ria/profile/[id]`
  - Non-versioned routes (like `/api/health`) are considered internal or stable

- **API Migration Stages**:
  - Endpoints transition through multiple stages:
    1. Unversioned for internal/experimental endpoints
    2. Versioned (v1) when stabilized
    3. Dual-support during transitions
    4. Deprecated with warnings
    5. Removed after deprecation period

**Breaking Change Management:**
- **Forward Compatibility**:
  - New fields are added in a non-breaking way
  - Response schemas use optional fields for new additions
  - Zod schemas with `safeParse` allow handling unexpected fields

- **Response Schema Evolution**:
  - Schema validation with graceful fallbacks
  - Backend may add fields without breaking clients
  - Frontend code checks field existence before usage

- **Client Adaptation**:
  - The API client centralizes adaptation logic
  - Field mapping and normalization happens in one place
  - Example: `apiClient` handles both `credits` and `balance` fields

**Backwards Compatibility:**
- **Schema Validation**:
  - Frontend validates responses against expected schemas
  - Provides fallbacks for unexpected formats
  - Example from client.ts:
  ```javascript
  const parsed = AskResponseSchema.safeParse(data);
  if (!parsed.success) {
    console.error('Invalid API response shape:', parsed.error);
    // Return a safe fallback response
    return {
      answer: 'I received an unexpected response format. Please try again.',
      metadata: {
        remaining: null,
        isSubscriber: false,
      },
    };
  }
  ```

- **Deprecation Notices**:
  - Console warnings for deprecated endpoints
  - No formal deprecation headers implemented yet
28. How is request cancellation implemented for abandoned searches or navigation?

The application implements request cancellation using the AbortController API:

**Streaming Request Cancellation:**
- **User-Initiated Cancellation**:
  - The `ChatInterface` component has a stop button during streaming
  - When clicked, it triggers the `handleCancelStream` function
  - This function calls `abortController.abort()` to terminate the request
  ```javascript
  const handleCancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // ...update UI state...
  };
  ```

- **Navigation Cancellation**:
  - Streaming requests are stored in component refs
  - React's useEffect cleanup function aborts requests on unmount
  ```javascript
  useEffect(() => {
    // setup effect...
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  ```

**AbortController Implementation:**
- The `askStream` method returns the AbortController:
  ```javascript
  async askStream(
    request: AskRequest,
    onToken: (token: string) => void,
    onComplete: (response: AskResponse) => void,
    onError: (error: Error) => void
  ): Promise<AbortController> {
    const controller = new AbortController();
    // ... request logic ...
    return controller;
  }
  ```

- This controller is stored in a ref for later access:
  ```javascript
  abortControllerRef.current = await apiClient.askStream(
    { query: input },
    // Callbacks...
  );
  ```

**UI Feedback During Cancellation:**
- When a stream is cancelled, the UI:
  1. Removes the loading indicator
  2. Displays the partial response received so far
  3. May append an indicator that the response was interrupted
  4. Re-enables the input field for new queries

**Cleanup Mechanisms:**
- Timeout cleanup is handled in finally blocks
- Stream readers are properly closed
- Controller references are nullified after use
- State is properly updated to reflect cancellation
29. What telemetry/monitoring is sent for API failures?

The application sends various telemetry and monitoring data for API failures:

**Console Logging:**
- **Detailed Error Logging**:
  - All API errors are logged to the console with context
  - Includes HTTP status, error message, and sometimes full responses
  - Example: `console.error('[askStream] Stream error:', error);`

- **Request Context**:
  - In development mode, additional request details are logged
  - Includes request URL, method, and sometimes request body
  - Example: `console.log('[askStream] Request URL:', url);`

**Vercel Analytics:**
- **Error Events**:
  - The `@vercel/analytics` package tracks application errors
  - API failures are captured as part of the general error tracking
  - Automatically includes error types and frequencies

**Axiom Integration:**
- **Structured Logging**:
  - The application uses `next-axiom` for structured logging
  - Configuration in `next.config.js`: `module.exports = withAxiom(nextConfig);`
  - Logs include request metadata, error types, and stack traces

**Error Categorization:**
- **Error Type Tracking**:
  - Specific error types are categorized and tracked separately:
    - Authentication errors (401)
    - Credit exhaustion (402)
    - Rate limiting (429)
    - Server errors (5xx)
  - This allows for analyzing error patterns by category

**Custom Debug IDs:**
- **Request Tracing**:
  - Streaming requests include a unique request ID header
  - Format: `X-Request-Id: ${Date.now()}-${random string}`
  - Helps correlate client and server logs for the same request

**Error Response Correlation:**
- **Detailed Backend Errors**:
  - When available, backend error messages are extracted and logged
  - This provides context about the specific failure reason
  - Example: `errorData.error.includes('embedding') || errorData.error.includes('vertex')`
30. How are large response payloads handled (pagination, streaming, compression)?

The application handles large response payloads using several techniques:

**Streaming Responses:**
- **Server-Sent Events (SSE)**:
  - AI-generated content uses streaming via the `/api/ask-stream` endpoint
  - The `apiClient.askStream` method processes the response incrementally
  - Tokens are delivered to the UI as they arrive, not waiting for completion
  - Implementation uses the Fetch API with streaming response processing

- **Stream Processing**:
  ```javascript
  const reader = response.body?.getReader();
  // ... process chunks as they arrive ...
  const { done, value } = await reader.read();
  buffer += decoder.decode(value, { stream: true });
  ```

**Pagination for Listings:**
- **RIA Listings Pagination**:
  - The `/api/listings` endpoint supports pagination parameters
  - Parameters: `page` (default: 1) and `limit` (default: 20)
  - Response includes metadata: `{ results: [...], total: number, page: number }`
  - UI components handle "load more" functionality

- **Client-Side Implementation**:
  - Components maintain page state for paginated requests
  - "Load more" buttons trigger fetching the next page
  - Results are appended to the existing list rather than replacing it

**Data Windowing:**
- **Virtual Lists**:
  - For very large lists, the UI implements virtual scrolling
  - Only renders the items currently in the viewport
  - Improves performance for large result sets

**Response Size Optimization:**
- **Selective Field Fetching**:
  - API requests can specify which fields to include
  - The `includeDetails` parameter controls response verbosity
  - Search results include minimal data by default, with optional details

- **Data Normalization**:
  - Large responses are normalized to reduce redundancy
  - References are used instead of embedding large objects
  - Nested data is flattened where appropriate

**No Custom Compression:**
- The application relies on standard HTTP compression
- No custom compression algorithms are implemented
- Relies on the infrastructure (Vercel, browsers) for compression

## Authentication & Authorization

31. What is the complete authentication flow from login to token refresh?

The application uses Supabase for authentication with the following complete flow:

**Initial Authentication Flow:**

1. **Login Initiation**:
   - User clicks login button in `Header` or other login prompts
   - This triggers `signInWithGoogle()` from the `useAuth` hook
   - The hook calls the underlying Supabase authentication method

2. **OAuth Redirect**:
   - Supabase redirects to Google OAuth consent screen
   - User authenticates with Google and grants permissions
   - Google redirects back to the application with an auth code

3. **Token Exchange**:
   - Supabase client exchanges the auth code for access and refresh tokens
   - Tokens are stored securely by Supabase client
   - The `AuthProvider` receives the authentication event

4. **Session Establishment**:
   - The `AuthContext` updates its state with new user and session
   - Updates trigger re-renders of authenticated components
   - The `onAuthStateChange` listener in `AuthProvider` handles this:

   ```javascript
   const { data: { subscription } } = supabase.auth.onAuthStateChange(
     async (event, session) => {
       console.log('Auth state change:', event, session?.user?.email);
       setSession(session);
       setUser(session?.user ?? null);
       setLoading(false);
     }
   );
   ```

**Token Refresh Flow:**

1. **Background Refresh**:
   - Supabase client automatically handles token refreshing
   - When access token nears expiration, the refresh token is used
   - This happens in the background without user intervention

2. **Session Updates**:
   - When tokens are refreshed, Supabase fires the auth state change event
   - The `AuthProvider` receives this event and updates context
   - All components using `useAuth()` receive the new session

3. **Failed Refresh Handling**:
   - If refresh token is expired or invalid, Supabase fires a "SIGNED_OUT" event
   - The `AuthProvider` catches this and clears the user/session state
   - UI transitions to unauthenticated state

**API Authentication:**

1. **Token Usage**:
   - The `apiClient` retrieves the token from auth context:
   ```javascript
   if (session?.access_token) {
     apiClient.setAuthToken(session.access_token);
   }
   ```

2. **Request Authentication**:
   - Tokens are added to API requests via the Authorization header:
   ```javascript
   headers['Authorization'] = `Bearer ${this.authToken}`;
   ```
32. How are JWT tokens stored, validated, and refreshed on the client side?

The application handles JWT tokens through the Supabase authentication system:

**Token Storage:**

- **Supabase Storage Mechanism**:
  - JWT tokens are stored by the Supabase client library
  - Default storage: localStorage under the key `supabase.auth.token`
  - Format: JSON object containing access and refresh tokens

- **Additional Caching**:
  - The `apiClient` maintains an in-memory copy of the token
  - Stored in the `authToken` private property
  - This avoids repeated localStorage access for every API call
  ```javascript
  private authToken: string | null = null;
  
  setAuthToken(token: string | null) {
    this.authToken = token;
  }
  ```

**Token Validation:**

- **Client-side Validation**:
  - The application doesn't perform JWT validation on the client
  - It relies on Supabase client for token integrity
  - The backend performs full validation of the JWT

- **Session Verification**:
  - The `AuthProvider` calls `supabase.auth.getSession()` on initialization
  - This verifies the stored session is still valid
  - Invalid sessions are rejected and user state is cleared

**Token Refresh:**

- **Automatic Refresh Logic**:
  - Supabase client handles token refreshes automatically
  - Refresh occurs when the access token approaches expiration
  - Uses the refresh token to obtain a new access token

- **Refresh Process**:
  1. Supabase detects near-expiration of access token
  2. It uses the refresh token to request new tokens
  3. New tokens are stored in the same storage location
  4. Auth state change event is triggered with updated session

- **Manual Session Recovery**:
  - When the app initializes, it attempts to recover any existing session:
  ```javascript
  const getInitialSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
    } catch (error) {
      console.error('Error getting initial session:', error);
    } finally {
      setLoading(false);
    }
  };
  ```

**Security Considerations:**
- Tokens are never exposed in URLs
- The application uses HTTPS for all requests
- API client adds tokens only to authorized endpoints
- No JWT tokens are stored in cookies (Supabase handles storage)
33. What happens when a refresh token expires while the user is actively using the app?

When a refresh token expires during active app usage, the following sequence occurs:

**Detection Process:**

1. **Failed API Request**:
   - User makes an API request requiring authentication
   - Backend validates the access token and finds it expired
   - Backend returns 401 Unauthorized response

2. **Automatic Refresh Attempt**:
   - Supabase client attempts to use the refresh token
   - Since the refresh token is expired, this refresh fails
   - Supabase emits an auth state change event with `SIGNED_OUT`

**Application Response:**

1. **Auth State Update**:
   - The `AuthProvider` receives the `SIGNED_OUT` event
   - It clears the user and session state
   - Components using `useAuth` are re-rendered with authenticated = false

2. **UI Feedback**:
   - Components detect the authentication state change
   - Authenticated-only UI elements are hidden
   - A "session expired" notification may appear

3. **API Client Handling**:
   - The `apiClient` detects 401 responses
   - It transforms these into `AUTHENTICATION_REQUIRED` errors
   - Components show appropriate auth-required messaging

**User Experience Flow:**

1. **Immediate Effects**:
   - Protected content disappears or shows placeholder states
   - Login prompts appear in relevant locations
   - Current operations (like streaming responses) are terminated

2. **Error Messaging**:
   - Error message specifically indicates session expiration: 
   ```
   "Your session has expired. Please sign in again to continue."
   ```
   - This distinguishes from other authentication errors

3. **Re-authentication Path**:
   - User is prompted to log in again
   - Clicking login triggers the standard auth flow
   - After successful login, the UI returns to authenticated state

**Implementation Details:**

```javascript
// In API client
if (response.status === 401) {
  throw new Error('AUTHENTICATION_REQUIRED');
}

// In components
if (errorMessage === 'AUTHENTICATION_REQUIRED') {
  setError('Please sign in to continue.');
  // May also trigger login prompt:
  // promptLogin(window.location.pathname);
}
```

**Session Recovery Attempts:**
- The application doesn't continuously poll for session status
- It relies on the auth state change events from Supabase
- There's no automatic re-authentication without user action
34. How are protected routes implemented and what triggers authentication redirects?

The application implements protected routes and authentication redirects using a component-level approach rather than route-level guards:

**Protected Route Implementation:**

- **Component-Level Protection**:
  - Protected content is conditionally rendered based on auth state
  - Components use the `useAuth` hook to check authentication
  - Example pattern:
  ```javascript
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <AuthPrompt />;
  
  return <ProtectedContent />;
  ```

- **No Router-Level Guards**:
  - The application doesn't use Next.js middleware for route protection
  - Instead, each page component handles its own authentication logic
  - This allows for partial page rendering with auth prompts

**Redirect Triggers:**

1. **Direct Route Access**:
   - When a user directly accesses a protected route:
     - The page component checks auth state via `useAuth()`
     - If unauthenticated, displays login prompt or redirects
     - The `useAuthStatus` hook provides the `promptLogin` method

2. **API Authorization Failures**:
   - When an API call returns 401 Unauthorized:
     - The `apiClient` converts this to an `AUTHENTICATION_REQUIRED` error
     - Components handle this error by showing auth prompts
     - Example:
     ```javascript
     if (errorMessage === 'AUTHENTICATION_REQUIRED') {
       setError('Please sign in to continue.');
       promptLogin(window.location.pathname);
     }
     ```

3. **Session Expiration**:
   - When Supabase detects an expired session:
     - The `AuthProvider` clears the user state
     - Components re-render with unauthenticated state
     - Auth prompts or redirects are triggered

**Redirect Implementation:**

- **Programmatic Navigation**:
  - The application uses Next.js router for redirects:
  ```javascript
  const promptLogin = (redirectTo?: string) => {
    const redirect = redirectTo || window.location.pathname;
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  };
  ```

- **Post-Login Redirection**:
  - Login page checks for `redirect` query parameter
  - After successful authentication, redirects to the original destination
  - This maintains the user's intended navigation flow
35. What role-based access control (RBAC) exists in the frontend?

The application has a relatively simple role-based access control system in the frontend:

**Basic Role Structure:**

- **Anonymous Users**:
  - Unauthenticated visitors
  - Limited access to basic features
  - Free credit allowance (15 credits)
  - Prompted to sign in for more features

- **Authenticated Users**:
  - Basic authenticated users
  - Access to core features
  - Limited free credits
  - Prompted to upgrade for unlimited usage

- **Subscribers**:
  - Premium/paid users
  - Full access to all features
  - Unlimited credits (no consumption tracking)
  - Additional features like advanced search options

**Role Determination:**

- The primary role flag is `isSubscriber`:
  ```javascript
  // From useCredits hook
  const { credits, isSubscriber } = useCredits();
  ```

- This is combined with authentication state:
  ```javascript
  // From useAuth hook
  const { user, session } = useAuth();
  const isAuthenticated = !!user;
  ```

**Frontend Access Control Implementation:**

- **Feature-Based Controls**:
  - UI elements conditionally render based on role
  - Example for subscriber-only features:
  ```jsx
  {isSubscriber && <AdvancedSearchOptions />}
  ```

- **Credit-Based Controls**:
  - Features that consume credits check availability first
  - Subscribers bypass credit checks:
  ```javascript
  // Credit check in ChatInterface
  if (!isSubscriber && credits === 0) {
    setError('You have no credits remaining. Please upgrade your plan.');
    return;
  }
  ```

- **No Fine-Grained Roles**:
  - The application doesn't implement granular role permissions
  - The primary distinction is between free and paid users
  - There's no admin/moderator roles in the frontend

**Role Inheritance:**
- Basic hierarchy: Anonymous → Authenticated → Subscriber
- Each level inherits access from previous levels
- No lateral role distinctions (e.g., different types of subscribers)

**Role Persistence:**
- The `isSubscriber` flag is persisted in localStorage
- It's refreshed from the backend with credit balance
- This allows for offline role determination
- The backend remains the source of truth
36. How does the app handle authentication state during page refreshes?

The application maintains authentication state across page refreshes through several mechanisms:

**Session Persistence:**

- **Supabase Session Storage**:
  - Supabase client stores authentication tokens in localStorage
  - Key: `supabase.auth.token`
  - Contains JWT tokens (access and refresh)
  - Automatically persists across page refreshes

- **Initial Session Recovery**:
  - When the application loads, `AuthProvider` immediately checks for existing sessions
  - Implementation in `useEffect` hook:
  ```javascript
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
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

**Page Refresh Handling:**

- **Loading State**:
  - During session retrieval, `loading` state is set to `true`
  - Components render loading indicators during this state
  - Prevents flash of unauthenticated content while checking session

- **SSR Considerations**:
  - Initial HTML is rendered without authentication state
  - Client-side hydration checks for session and updates UI
  - Protected content has fallback states for pre-auth rendering

**Cross-Tab Synchronization:**

- **Auth State Events**:
  - Supabase maintains consistent auth state across tabs
  - `onAuthStateChange` event subscription ensures all tabs update
  - When one tab refreshes tokens, others automatically sync

**Session Expiration:**

- **Refresh During Navigation**:
  - Page refreshes trigger session checks
  - If refresh token is valid but access token expired, silent refresh occurs
  - User experiences seamless authentication maintenance

- **Hard Refresh Recovery**:
  - Even when cache is cleared (Ctrl+F5), tokens in localStorage remain
  - Session recovery still works unless localStorage is explicitly cleared
  - Only cookies and memory are cleared, not localStorage
37. What security headers are set and validated by the frontend?

The application handles security headers in the following ways:

**Headers Set by the Frontend:**

- **X-Forwarded-Host**:
  - Added to proxied requests in `next.config.js`
  - Helps with proper backend routing
  ```javascript
  async headers() {
    return [
      {
        source: '/_backend/:path*',
        headers: [
          { key: 'x-forwarded-host', value: 'www.ria-hunter.app' }
        ]
      }
    ];
  }
  ```

- **Authorization Header**:
  - Added by the API client for authenticated requests
  - Contains JWT bearer token
  ```javascript
  if (this.authToken) {
    headers['Authorization'] = `Bearer ${this.authToken}`;
  }
  ```

- **X-Request-Id**:
  - Added to streaming requests for tracing
  - Format: timestamp-random identifier
  ```javascript
  'X-Request-Id': `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  ```

- **Content-Type**:
  - Set explicitly for API requests
  - Ensures proper content negotiation
  ```javascript
  'Content-Type': 'application/json'
  ```

- **Accept**:
  - Set for streaming responses
  - Indicates expected response format
  ```javascript
  'Accept': 'text/event-stream'
  ```

**Headers Validated by the Frontend:**

- The frontend doesn't actively validate security headers on responses
- It relies on the browser's same-origin policy and Vercel's default security headers
- No explicit CSP validation in the code

**Missing Security Headers:**

- No explicit Content-Security-Policy (CSP) headers
- No explicit X-XSS-Protection headers
- No explicit X-Content-Type-Options headers

**Vercel Platform Headers:**

- The application likely benefits from Vercel's default security headers
- These may include standard protections not explicitly defined in the code
- The application focuses on authentication headers rather than browser security headers

**Response Header Handling:**

- The application does check response status codes
- It doesn't explicitly validate security headers in responses
- Error handling is based on status code, not headers
38. How is Cross-Site Request Forgery (CSRF) protection implemented?

The application implements CSRF protection through several mechanisms:

**Supabase Authentication Protection:**

- **Token-Based Authentication**:
  - The application uses JWT bearer tokens for authentication
  - These tokens are sent in Authorization headers, not cookies
  - This approach is inherently resistant to CSRF attacks
  - Example:
  ```javascript
  headers['Authorization'] = `Bearer ${this.authToken}`;
  ```

- **No Cookie-Based Session**:
  - Authentication state is not maintained via cookies
  - The primary authentication mechanism uses localStorage
  - CSRF typically exploits cookie-based authentication

**API Request Protections:**

- **Same-Origin Policy**:
  - The application uses the browser's same-origin policy
  - API requests come from the same origin via the `/_backend` proxy
  - Cross-origin requests would be blocked by the browser

- **Custom Request Header**:
  - API requests include custom headers that can't be set by cross-origin forms
  - The `X-Request-Id` header acts as an implicit CSRF token
  - Non-simple requests trigger CORS preflight checks

**Stripe Integration Protection:**

- **Redirect-Based Flow**:
  - Stripe checkout uses redirect-based flows rather than form submissions
  - Users are redirected to Stripe-hosted pages for payment
  - Stripe handles its own CSRF protection

**No Explicit CSRF Tokens:**

- The application doesn't implement traditional CSRF tokens
- No form-specific or request-specific tokens are generated
- Relies on the token-based authentication model's inherent CSRF protection

**Implicit Protection via SPA Architecture:**

- As a Single Page Application, most interactions happen via JavaScript
- API calls use fetch() with credentials and headers that a CSRF attack can't replicate
- The stateless authentication model doesn't maintain server-side sessions that could be hijacked

**Missing Traditional CSRF Protections:**

- No Double-Submit Cookie pattern
- No explicit CSRF tokens for form submissions
- No Same-Site cookie attributes (not using cookies for auth)
39. What happens to local data when a user logs out?

When a user logs out, the application handles local data in the following ways:

**Authentication Data Cleanup:**

- **Supabase Auth Cleanup**:
  - The `signOut` function in `AuthContext` calls Supabase's signOut
  - This removes authentication tokens from localStorage
  - Implementation:
  ```javascript
  signOut: async () => {
    try {
      const result = await signOut();
      if (!result.error) {
        setUser(null);
        setSession(null);
      }
      return result;
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: error as AuthError };
    }
  }
  ```

- **In-Memory Auth State**:
  - React state variables in `AuthProvider` are cleared
  - `setUser(null)` and `setSession(null)` remove user data
  - Components re-render with unauthenticated state

**Credit Data Handling:**

- **Credits Persistence**:
  - Credit information in localStorage is maintained
  - The application transitions to using the anonymous/free credit model
  - This allows returning users to still see their remaining free credits

- **Credit Display Update**:
  - The UI updates to show default credit values for anonymous users
  - Typically shows the standard 15 free credits for new users
  - This happens automatically due to the auth state change

**Cached API Data:**

- **No Explicit API Cache Clearing**:
  - The application doesn't have a global API cache
  - Individual component state is cleared through component unmounting
  - Navigation after logout renders fresh components

**User Preferences:**

- **UI Preferences**:
  - General UI preferences in localStorage are preserved
  - These aren't tied to user identity
  - Examples: dark mode settings, UI customizations

**Chat History:**

- **Conversation Cleanup**:
  - Chat history exists only in component state
  - When components unmount after logout, this data is lost
  - No persistence of chat history between sessions

**Logout Trigger Events:**

- The logout process is triggered by:
  1. User explicitly clicking logout
  2. Session expiration with failed refresh
  3. Authentication errors that can't be recovered

**Partial Data Retention:**
- The application follows a "clean enough" approach
- Security-critical data is removed
- Non-sensitive data may be retained for convenience
- User can clear all data with browser's clear site data function
40. How are authentication errors differentiated from authorization errors in the UI?

The application clearly differentiates between authentication and authorization errors in the UI:

**Error Type Differentiation:**

- **Authentication Errors** (401 - Unauthorized):
  - When user is not authenticated or session has expired
  - Converted to `AUTHENTICATION_REQUIRED` error type
  - Message focuses on sign-in action
  - Example: "Please sign in to continue."

- **Authorization Errors** (403 - Forbidden):
  - When user is authenticated but lacks permission
  - Often related to subscription status or credit limits
  - Message focuses on upgrading or limits
  - Example: "You need to upgrade your plan to access this feature."

**UI Implementation:**

- **Authentication Error UI**:
  - Login button or prompt is displayed
  - Original content is hidden or blurred
  - Focus on re-establishing identity
  - Example:
  ```javascript
  if (errorMessage === 'AUTHENTICATION_REQUIRED') {
    setError('Please sign in to continue.');
    // May also trigger login modal or redirect
  }
  ```

- **Authorization Error UI**:
  - Upgrade prompts or explanations shown
  - Partial content may still be visible
  - Focus on explaining limitations
  - Example:
  ```javascript
  if (errorMessage === 'CREDITS_EXHAUSTED') {
    setError('You have used all your free searches. Please upgrade to continue.');
    // May show upgrade button
  }
  ```

**Visual Differentiation:**

- **Authentication Error Styling**:
  - Often uses neutral colors (gray/blue)
  - Shows login icon or user symbol
  - Positioned as a prerequisite step

- **Authorization Error Styling**:
  - Often uses upgrade-oriented colors (purple/gold)
  - Shows premium features or lock icons
  - Positioned as an opportunity to enhance experience

**Error Message Content:**

- **Authentication-specific language**:
  - "Sign in required"
  - "Please log in to continue"
  - "Your session has expired"

- **Authorization-specific language**:
  - "Upgrade required"
  - "You've reached your limit"
  - "This feature requires a subscription"

**Recovery Path:**
- Authentication errors → Login flow
- Authorization errors → Subscription/upgrade flow

## Search & AI Features

41. How is the search query constructed from user input (natural language processing)?

The application constructs search queries from natural language input as follows:

**Query Processing Flow:**

1. **Raw User Input Capture**:
   - User enters natural language text in the chat interface
   - The input is captured as a raw string without preprocessing
   - Example: "Show me the largest RIAs in St. Louis with over $500M AUM"

2. **Frontend Query Construction**:
   - The frontend sends the raw query string to the backend
   - The `askStream` or `ask` method in `apiClient` is called:
   ```javascript
   const response = await apiClient.ask({
     query, // Raw user input
     options: {
       // Optional parameters that can be extracted from UI
       city: selectedCity,
       state: selectedState,
       minAum: minimumAum,
       includeDetails: true,
       maxResults: 10,
     },
   });
   ```

3. **Parameter Normalization**:
   - Some basic normalization happens in the `apiClient`:
   - City names are normalized: "st. louis" → "Saint Louis"
   - State names are converted to two-letter codes: "Missouri" → "MO"
   - Numeric values are bounded to reasonable ranges

**Backend NLP Processing:**

- The backend (not visible in frontend code) performs these steps:
  1. Entity extraction to identify location, AUM values, company names
  2. Query classification to determine intent (search, profile view, analytics)
  3. Semantic parsing to understand relationships between entities
  4. Vector embedding for semantic search capabilities

**Search Enhancement:**

- **UI Parameter Integration**:
  - The application allows combining natural language with UI parameters
  - Explicit filters (like city/state dropdowns) are sent as structured parameters
  - These override or supplement what's extracted from the natural language

- **Query Suggestions**:
  - The UI offers example queries to guide users
  - These demonstrate the natural language capabilities
  - Examples: "Show me the largest RIAs in St. Louis", "Find investment advisors specializing in biotech"

**Query Processing Options:**

- **includeDetails** parameter controls result verbosity
- **maxResults** limits the number of returned items
- **useHybridSearch** enables combining semantic and keyword search

**Implementation Note:**
- Natural language processing happens primarily on the backend
- The frontend mostly passes the raw query with minimal preprocessing
- The `apiClient` handles parameter normalization but not NLP
42. What debouncing/throttling is applied to search input fields?

The application implements several forms of input throttling and debouncing:

**Direct Input Throttling:**

- **Submit Prevention During Processing**:
  - The ChatInterface component disables form submission while processing
  - This provides an implicit form of throttling:
  ```javascript
  <button
    type="submit"
    disabled={!input.trim() || isStreaming || isSubmitting}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <Send className="w-5 h-5" />
  </button>
  ```

- **Input Field Disabling**:
  - Input fields are disabled during active streaming/processing:
  ```javascript
  <input
    type="text"
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder="Ask about RIAs, venture capital activity, executives..."
    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    disabled={isStreaming || isSubmitting}
  />
  ```

**API Request Rate Limiting:**

- **Backend Rate Limit Handling**:
  - The apiClient specifically handles 429 (Too Many Requests) responses
  - It converts these to 'RATE_LIMITED' errors
  - The UI displays appropriate messages:
  ```javascript
  if (errorMessage === 'RATE_LIMITED') {
    setError('You are sending too many requests. Please slow down.');
  }
  ```

**Streaming Throttling:**

- **One Active Stream Limit**:
  - Only one streaming request can be active at a time
  - New requests are blocked while `isStreaming` is true
  - A cancel button is shown during streaming to allow termination

**Manual Submission Model:**

- **Explicit Submission Required**:
  - The search doesn't auto-submit as the user types
  - User must explicitly click the submit button or press Enter
  - This natural interaction pattern prevents excessive API calls

**Missing Techniques:**

- No explicit debounce timer on input changes
- No time-based throttling for rapid manual submissions
- No automatic retry with increasing delays

**Implementation Note:**
- The application relies more on UI state management than explicit timing functions
- This fits the chat-style interface where each query is a distinct operation
- For real-time search interfaces, more explicit debouncing would be appropriate
43. How are search filters (location, AUM, etc.) combined with text queries?

The application combines search filters with text queries in a dual-layer approach:

**Filter Integration Approach:**

- **Structured Query Parameters**:
  - Explicit filters are sent as structured parameters alongside the text query
  - These override or augment what might be extracted from the natural language
  - Example API call structure:
  ```javascript
  const response = await apiClient.ask({
    query: "Find large investment advisors", // Natural language query
    options: {
      city: "Saint Louis",       // Location filter
      state: "MO",               // State filter
      minAum: 500000000,         // AUM minimum filter (500M)
      includeDetails: true,      // Response detail level
      maxResults: 10,            // Result count limit
      useHybridSearch: true      // Search algorithm selection
    }
  });
  ```

**Filter Normalization:**

- **Location Normalization**:
  - City names are normalized: "st. louis" → "Saint Louis"
  - State names are converted to two-letter codes: "Missouri" → "MO"
  - This happens in the apiClient's `normalizeAskRequest` method:
  ```javascript
  private normalizeCity(city: string): string {
    return city
      .trim()
      .replace(/\bst\.?\s+/gi, 'Saint ')
      .replace(/\bmt\.?\s+/gi, 'Mount ')
      // ... other normalizations
  }
  ```

- **Value Bounds Checking**:
  - Numeric filters are bounded to reasonable ranges
  - For example, AUM values have minimum/maximum constraints
  ```javascript
  if (normalized.options.minAum !== undefined) {
    normalized.options.minAum = Math.max(0, Math.min(normalized.options.minAum, 1000000000000));
  }
  ```

**Filter Source Hierarchy:**

1. **Explicit UI Filters**: Highest priority, directly specified by user interaction
2. **URL Parameters**: Used when deep-linking to filtered search results
3. **Natural Language Extraction**: Backend extracts filters from the query text
4. **Default Values**: Fallback when no filter is specified

**User Interface Implementation:**

- **Combined Search Experience**:
  - Text input for natural language query
  - Optional UI elements for structured filters
  - Filters can be applied before or after entering text
  - Both are sent together in the API request

**Filter-Text Relationship:**

- Filters restrict the search domain rather than modify the query
- The backend combines these approaches:
  1. Uses filters to narrow the candidate pool of RIAs
  2. Uses text query for semantic matching within that pool
  3. Returns results that satisfy both filter criteria and query relevance
44. What happens to in-progress searches when the user navigates away?

The application handles in-progress searches during navigation with several mechanisms:

**Request Cancellation:**

- **AbortController Usage**:
  - Active streaming requests use the AbortController API
  - When components unmount (including during navigation), requests are aborted
  - Implementation in ChatInterface cleanup:
  ```javascript
  useEffect(() => {
    // Setup effect...
    
    return () => {
      // Cleanup when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);
  ```

**Resource Cleanup:**

- **Timeout Clearing**:
  - Any active timeouts are cleared during component unmount
  - This prevents delayed callbacks from executing after navigation:
  ```javascript
  useEffect(() => {
    const refreshInterval = setInterval(refreshCredits, CREDITS_CACHE_DURATION);
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [refreshCredits, user, session]);
  ```

- **Event Listener Removal**:
  - Event listeners are properly removed on component unmount
  - This prevents memory leaks and unexpected behaviors:
  ```javascript
  useEffect(() => {
    if (creditsBroadcastChannel) {
      creditsBroadcastChannel.addEventListener('message', handleCreditSync);
    }
    
    return () => {
      if (creditsBroadcastChannel) {
        creditsBroadcastChannel.removeEventListener('message', handleCreditSync);
      }
    };
  }, []);
  ```

**Server-Side Handling:**

- **Backend Request Termination**:
  - When the client aborts a request, the server detects this
  - Server-side processing is stopped to save resources
  - No further tokens are streamed after abortion

**Credit Implications:**

- **No Credit Refunds**:
  - Credits deducted for the search are not refunded
  - This is consistent with the "pay upfront" credit model
  - The user effectively pays for starting the search, not completing it

**UI State Reset:**

- **Component State Reset**:
  - When navigating away, component state is lost
  - If the user returns to the search page, a fresh state is initialized
  - No automatic resumption of previous searches
45. How are AI-generated responses streamed and displayed progressively?

The application implements a sophisticated system for streaming and progressively displaying AI-generated responses:

**Server-Sent Events Implementation:**

- **Streaming Request Setup**:
  - The `askStream` method in `apiClient` establishes a streaming connection
  - Uses the Fetch API with a response body reader
  - SSE (Server-Sent Events) format is used for token-by-token streaming
  ```javascript
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader available');
  }
  ```

**Token Processing Pipeline:**

1. **Chunk Decoding**:
   - Raw binary chunks are decoded to text
   - Uses TextDecoder with streaming option
   ```javascript
   const decoder = new TextDecoder();
   buffer += decoder.decode(value, { stream: true });
   ```

2. **SSE Event Parsing**:
   - Buffer is processed to extract complete SSE events
   - Events are separated by double newlines (`\n\n`)
   - Only `data:` lines are considered
   ```javascript
   const idx = buffer.indexOf('\n\n');
   if (idx === -1) break;
   const chunk = buffer.slice(0, idx);
   buffer = buffer.slice(idx + 2);

   const lines = chunk.split('\n').filter(l => l.startsWith('data:'));
   if (lines.length === 0) continue;
   const raw = lines.map(l => l.slice(5).trim()).join('\n');
   ```

3. **Token Extraction**:
   - For JSON events, tokens are extracted from specific fields
   - Plain text tokens are used directly
   ```javascript
   if (raw && raw[0] === '{' && raw[raw.length - 1] === '}') {
     try {
       const obj = JSON.parse(raw);
       token = obj.delta ?? obj.content ?? obj.text ?? obj.token ?? obj.message ?? '';
       // ...
     } catch {
       token = raw; // fallback to raw text
     }
   } else {
     token = raw; // plain text frames
   }
   ```

**UI Rendering:**

- **Progressive Display**:
  - Tokens are appended to the current message content
  - React state updates trigger re-renders with new content
  ```javascript
  setMessages(prev => prev.map(msg => 
    msg.id === assistantMessageId
      ? { ...msg, content: msg.content + processedToken }
      : msg
  ));
  ```

- **Streaming Indicator**:
  - A visual indicator shows streaming is in progress
  - Spinning animation provides feedback during processing
  ```jsx
  {message.isStreaming && (
    <div className="mt-2 flex items-center text-sm opacity-70">
      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      <div className="flex flex-col">
        <span>AI is analyzing your query...</span>
        <span className="text-xs mt-1">Processing semantic search and generating response</span>
      </div>
    </div>
  )}
  ```

**Error and Completion Handling:**

- **Stream Completion**:
  - Special `[DONE]` marker indicates stream completion
  - Final message state is updated with complete response
  - Streaming indicators are removed

- **Stream Errors**:
  - Error callbacks handle streaming failures
  - Partial response is preserved rather than discarded
  - Error message is displayed to user
46. What fallback behavior exists when AI services are unavailable?

The application implements several fallback behaviors when AI services are unavailable:

**Error Detection:**

- **AI Service Error Types**:
  - The application detects specific AI service failures:
  - Embedding service errors (vector search)
  - Vertex AI/model availability issues
  - Timeout errors for long-running AI processes
  - General AI service 500 errors

- **Error Detection Code**:
  ```javascript
  // From apiClient.ask method
  if (errorData.error) {
    // Provide AI-specific error feedback
    if (errorData.error.includes('embedding') || errorData.error.includes('vertex') || errorData.error.includes('semantic')) {
      errorMessage = 'AI search is temporarily unavailable. Showing basic results instead.';
    } else if (errorData.error.includes('timeout') || errorData.error.includes('stream')) {
      errorMessage = 'AI processing took too long. Please try a simpler query.';
    } else {
      errorMessage = errorData.error;
    }
  }
  ```

**Fallback Mechanisms:**

- **Basic Search Fallback**:
  - When semantic search (AI-powered) fails, the system can fall back to basic keyword search
  - This is triggered by the `useHybridSearch` option or automatically on AI failure
  - The response indicates the fallback was used: "AI search is temporarily unavailable. Showing basic results instead."

- **Error Response with Partial Results**:
  - For streaming failures, any partial response is preserved and shown to the user
  - The system doesn't discard partial information when the stream fails
  ```javascript
  setMessages(prev => prev.map(msg => 
    msg.id === assistantMessageId
      ? {
          ...msg,
          content: displayMessage,
          isStreaming: false,
        }
      : msg
  ));
  ```

- **Safe Fallback Response**:
  - When response validation fails, a safe fallback response is provided
  ```javascript
  if (!parsed.success) {
    console.error('Invalid API response shape:', parsed.error);
    // Return a safe fallback response
    return {
      answer: 'I received an unexpected response format. Please try again.',
      metadata: {
        remaining: null,
        isSubscriber: false,
      },
    };
  }
  ```

**User Experience:**

- **Clear Error Messaging**:
  - Error messages specifically indicate AI unavailability
  - UI distinguishes between temporary unavailability and wrong query format
  - Examples: "AI services are temporarily unavailable. Please try again in a moment."

- **Retry Suggestions**:
  - For transient failures, users are encouraged to retry
  - For timeout errors, users are suggested to simplify their query
  - Specific guidance based on error type
47. How are search results ranked and sorted on the frontend?

The application primarily relies on backend ranking with minimal frontend reordering:

**Ranking Source:**

- **Backend Ranking Priority**:
  - The primary ranking is determined by the backend's semantic search
  - Results include a `similarity` score from the backend
  - The frontend preserves this ranking in most cases
  ```javascript
  // Backend response includes pre-ranked results
  results: z.array(z.object({
    id: z.string(),
    firm_name: z.string(),
    crd_number: z.string(),
    // ...other fields
    similarity: z.number().optional(),  // Semantic relevance score
  }))
  ```

**Frontend Sorting Options:**

- **Default Ordering**:
  - Results are displayed in the order received from the backend
  - This preserves the semantic relevance ranking
  - No automatic reordering is applied

- **No Explicit Sort Controls**:
  - The UI doesn't offer explicit sort controls (e.g., sort by AUM)
  - This keeps the focus on semantic relevance
  - Backend query options can influence sorting implicitly

**Result Grouping:**

- **Semantic Grouping**:
  - Related results may be grouped in the display
  - This is based on backend-provided similarity clusters
  - Preserves the semantic relationships between results

**Highlighted Items:**

- **Relevance Highlighting**:
  - Particularly relevant results may receive visual emphasis
  - This is based on the similarity score or other backend signals
  - No additional frontend scoring is applied

**Display Considerations:**

- **Presentation Order**:
  - Top results are shown first in scrollable containers
  - No pagination controls in the main chat interface
  - Browsing interfaces may include pagination with rank preservation

**Special Cases:**

- **Specific Entity Requests**:
  - When a user searches for a specific RIA by name
  - The exact match is prioritized regardless of other ranking signals
  - This is handled by backend logic, not frontend reranking
48. What client-side caching exists for search results?

The application has limited client-side caching for search results:

**No Explicit Results Cache:**

- **Cache Avoidance**:
  - The application deliberately avoids caching search results
  - All API requests explicitly include `cache: 'no-store'` directive
  ```javascript
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(API_CONFIG.timeoutMs),
    cache: 'no-store', // Explicit no-cache instruction
  });
  ```

- **Fresh Data Priority**:
  - This approach ensures users always get fresh data
  - Particularly important for financial/investment data that may change
  - Avoids stale information in critical decision contexts

**Component State Storage:**

- **Session-Duration Caching**:
  - Search results are stored in component state
  - Preserved as long as the component remains mounted
  - Example in `ChatInterface`:
  ```javascript
  const [messages, setMessages] = useState<Message[]>([]);
  // Messages contain search results and are preserved until component unmounts
  ```

- **No localStorage Persistence**:
  - Search results are not persisted to localStorage
  - Results are lost on page refresh or navigation
  - No history feature to recall previous searches

**Conversation Context:**

- **Chat History Retention**:
  - Previous search results remain visible in the chat history
  - This provides a form of user-visible "caching"
  - Limited to the current session only

**Query Caching (Not Results):**

- **Suggested Queries**:
  - The application may store previously successful query patterns
  - These are used for query suggestions
  - Not actual result caching

**RIA Profile Caching:**

- **No Profile Caching**:
  - Even individual RIA profiles are fetched fresh each time
  - No TTL-based caching for profiles
  - Same no-cache approach as search results

**Architecture Considerations:**

- **SSR vs CSR Balance**:
  - The application balances server-side rendering with client-side data fetching
  - This approach favors fresh data over cached data
  - Consistent with the real-time nature of the application
49. How are "similar searches" or search suggestions generated?

The application implements search suggestions through a simple but effective approach:

**Static Suggestion Sets:**

- **Default Suggestions**:
  - The application uses predefined suggestion sets in the `QuerySuggestions` component
  - These are hardcoded examples that showcase capabilities
  ```javascript
  const DEFAULT_SUGGESTIONS: string[] = [
    "What are the largest RIA's in St. Louis?",
    'Show RIAs with > $500M AUM in San Francisco',
    'Which RIAs in Missouri have VC activity?'
  ];
  ```

- **Contextual Suggestions**:
  - Some components may provide context-specific suggestions
  - These are passed as props to the `QuerySuggestions` component
  ```javascript
  <QuerySuggestions
    onSelect={handleSuggestionClick}
    suggestions={contextualSuggestions}
  />
  ```

**Suggestion UI Implementation:**

- **Button Interface**:
  - Suggestions are displayed as clickable buttons
  - Clicking automatically fills the search input
  ```jsx
  {suggestions.map((s, i) => (
    <button
      key={`${i}-${s.slice(0, 8)}`}
      type="button"
      onClick={() => onSelect(s)}
      className="text-sm bg-white border border-gray-200 hover:border-gray-300 rounded-full px-3 py-1 shadow-sm"
    >
      {s}
    </button>
  ))}
  ```

- **Selection Handling**:
  - When a suggestion is clicked, the `onSelect` callback is triggered
  - This typically sets the input field value and may trigger a search
  ```javascript
  const handleSuggestionClick = (query: string) => {
    setInput(query);
    // Optionally auto-submit
  };
  ```

**Usage Patterns:**

- **Empty State Suggestions**:
  - Shown prominently when no previous searches exist
  - Help users understand the system's capabilities
  ```jsx
  {messages.length === 0 ? (
    <div className="text-center text-gray-500 mt-8">
      {/* ... */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
        <h4 className="font-medium text-gray-700 mb-2">Try these queries:</h4>
        <ul className="text-sm text-gray-600 space-y-1 text-left">
          <li>• "Show me the largest RIAs in St. Louis"</li>
          <li>• "Find investment advisors specializing in biotech"</li>
          {/* ... */}
        </ul>
      </div>
    </div>
  ) : (
    // Messages display
  )}
  ```

**No Dynamic Suggestion Generation:**

- The application does not implement:
  - Query history-based suggestions
  - Backend-generated similar queries
  - Autocomplete-style suggestions as you type
  - Machine learning-based suggestion refinement

**Implementation Note:**
- This approach favors simplicity and reliability
- Static suggestions ensure quality examples for users
- The chat-style interface reduces the need for dynamic suggestions
50. What analytics events are tracked for search interactions and AI usage?

The application implements several layers of analytics tracking for search and AI interactions:

**Vercel Analytics Integration:**

- **Core Analytics Package**:
  - Uses `@vercel/analytics` for core analytics tracking
  - Automatically tracks page views and basic interactions
  - Initialized in the root layout component
  ```jsx
  <Analytics /> // From @vercel/analytics/next
  ```

**Custom Event Tracking:**

- **Search Interaction Events**:
  - Search queries submitted
  - Results viewed/clicked
  - Error scenarios encountered
  - These events include metadata about the interaction

- **Credit Usage Events**:
  - Credit deduction events
  - Credit exhaustion events
  - Upgrade prompt interactions
  - These help understand monetization patterns

**Performance Metrics:**

- **AI Response Times**:
  - Time to first token (TTFT)
  - Total response generation time
  - These metrics help optimize the user experience

- **Error Rate Tracking**:
  - AI service failures
  - Parsing errors
  - Network failures
  - These help identify reliability issues

**Console Debugging:**

- **Debug Mode Logging**:
  - Extended console logging when in debug mode
  - Captures detailed information about API calls and responses
  ```javascript
  if (DEBUG_MODE) {
    console.log('[askStream] Request URL:', url);
    console.log('[askStream] Request method: POST');
    console.log('[askStream] Request body:', { query: request.query });
  }
  ```

**Backend-Coordinated Analytics:**

- **Credits Ledger**:
  - Every credit transaction is logged with metadata
  - Includes query details and response metrics
  - This creates a comprehensive usage record

- **User Session Tracking**:
  - Anonymous user tracking via cookies
  - Authenticated user tracking via session IDs
  - These allow for cohort analysis and personalization

**Privacy Considerations:**

- **Data Anonymization**:
  - Personal identifiers are removed where possible
  - Aggregate metrics are preferred over individual tracking
  - Complies with data privacy regulations

**Analytics Implementation Note:**
- Most analytics are server-side or backend-driven
- Client-side analytics focus on UX and performance
- The combination provides a complete picture of system usage
