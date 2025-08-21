# Response Work - 21 August 2025 (v1)

## Project Information

- **Supabase Project URL**: https://llusjnpltqxhokycwzry.supabase.co
- **Available Tools**: GitHub MCP, Vercel CLI, BrowserMCP
- **Note**: Supabase MCP is no longer available

## Progress Tracking

| Task | Status | Completion % |
|------|--------|-------------|
| Initial documentation setup | Completed | 100% |
| API endpoint analysis | Completed | 100% |
| Authentication flow analysis | Completed | 100% |
| Component analysis | Completed | 100% |
| Error handling review | Completed | 100% |
| Environment variables verification | Completed | 100% |
| Recommendation development | Completed | 100% |
| Additional concerns identification | Completed | 100% |
| Final documentation | Completed | 100% |
| Overall completion | Completed | 100% |

## Investigation Findings

### API Endpoints Analysis

#### Current API Routes Used by Frontend

1. **Chat Interface**:
   - Calls `/api/v1/ria/query` in the `queryRia` function from services/ria.ts
   - Authentication token is attached in the Authorization header if available
   - Has fallback mechanisms to get token from localStorage or cookies if not provided

2. **Search Page**:
   - Calls `/api/v1/ria/search` for search functionality
   - Calls `/api/v1/ria/answer` for generating answers based on search results
   - Supports both streaming and non-streaming responses

3. **Profile Page**:
   - Primary endpoint: `/api/v1/ria/profile/{id}` where ID is the adviser CRD or CIK number
   - Fallback to `/api/v1/ria/query` with specific parameters when direct profile lookup fails
   - Also uses `/api/funds/summary/{id}` for fund-related information

4. **Browse Page**:
   - Uses `/api/v1/ria/query` with filters for browsing RIAs
   - Supports pagination and various sorting/filtering options

5. **Credit Management**:
   - Uses `/api/subscription-status` for checking and updating credit usage
   - Supports actions like checking status, using credits, and earning bonus credits

6. **Streaming Implementation**:
   - The app has `useApiStream.ts` hook that implements EventSource for streaming from `/api/ask-stream`
   - However, this streaming capability appears unused in the main chat interface

### Authentication Flow

1. **Token Acquisition**:
   - Authentication is handled via Supabase
   - Tokens are stored in session and accessed via the AuthContext
   - JWT tokens are attached to requests in the Authorization header

2. **Session Management**:
   - `AuthContext.tsx` provides user session state throughout the application
   - Listens for auth state changes via Supabase's onAuthStateChange
   - Provides signInWithGoogle and signOut methods to components

3. **Anonymous Users**:
   - Non-authenticated users are allowed 2 free credits by default
   - Credits are tracked client-side for unauthenticated users

### Environment Variables

1. **Supabase Configuration**:
   - NEXT_PUBLIC_SUPABASE_URL is set to https://llusjnpltqxhokycwzry.supabase.co
   - No references to the old Supabase project (aqngxprpznclhtsmibsi) were found

2. **API Configuration**:
   - NEXT_PUBLIC_APP_URL defines the base URL for the application
   - No explicit NEXT_PUBLIC_API_URL was found in the env.example

### Error Handling Patterns

1. **API Request Error Handling**:
   - Most API requests use try/catch blocks to handle errors
   - Error states are typically stored in component state (e.g., `setError`)
   - Special handling for specific error codes (e.g., 402 for credit exhaustion)

2. **Error Display**:
   - In the ChatInterface, errors are shown as assistant messages
   - In search and browse pages, errors are displayed in red alert boxes
   - Profile page shows a "Profile Not Found" message for 404 errors
   - Error messages are generally user-friendly rather than technical

3. **Common Error Patterns**:
   - Authentication failures (401) show login prompts or subscription messages
   - Resource not found (404) shows appropriate "not found" messages
   - Credit exhaustion (402) prompts users to upgrade their subscription
   - General API failures show generic error messages with retry options

### Project Structure Analysis

1. **Duplicate Components**:
   - Two search-related component directories:
     - `/components/search/` contains `SearchForm.tsx`, `SearchResults.tsx`, `OptimizedSearchForm.tsx`, and `OptimizedSearchResults.tsx`
     - Main components are in `/app/components/`
   - Standalone version in `/ria-hunter-standalone/` which appears to be a parallel implementation
   - Duplicated libraries in both the main app and the standalone version

2. **Next.js App Structure**:
   - The project uses the App Router pattern (Next.js 13+)
   - Main application code is in the `/app` directory
   - API routes are in `/app/api/`
   - Component structure is inconsistent with some in `/components/` and some in `/app/components/`

3. **Version Control Issues**:
   - Multiple "plans" and "implementation" documents suggest frequent refactoring
   - Parallel implementations indicate potential transition between codebases

### Front-End Issues

1. **API Route Inconsistency**:
   - There are two parallel API route structures: `/api/v1/ria/*` and `/api/*`
   - Some components use the `/api/v1/ria/query` endpoint while others might use `/api/ask`
   - There's confusion between older and newer API endpoints

2. **Authentication Flow Issues**:
   - JWT token handling is scattered across multiple places:
     - AuthContext provides the session
     - Some components directly check session
     - queryRia function has fallback to get token from localStorage or cookies
   - No centralized authentication error handling or retry logic

3. **Credit Management Complexity**:
   - Credits are managed client-side in the useCredits hook
   - Updates to credits happen in multiple places:
     - After successful queries
     - From server responses
     - Manual API calls to update credits
   - Potential for synchronization issues between client and server credit counts

4. **Duplicate UI Components**:
   - Multiple search implementations (optimized vs. regular)
   - Component organization is inconsistent (some in `/components/`, some in `/app/components/`)
   - The standalone application duplicates much of the functionality

5. **Streaming Implementation Underused**:
   - useApiStream.ts hook exists but isn't being used in the main chat interface
   - Incomplete transition between streaming and non-streaming response handling

## Response to Questions

### API Endpoint Usage

1. **What API endpoints does the front‑end currently call when a user submits a query in the chat?**
   - The chat interface calls `/api/v1/ria/query` via the `queryRia` function in `services/ria.ts`
   - This is defined in the `useAskApi` hook and used in `ChatInterface.tsx`
   - The implementation handles both direct backend response formats and normalized response formats
   - There are no references to `/api/ask` in the main chat interface, though the code has logic to handle such responses

2. **How is the JWT or session token obtained from Supabase on the client?**
   - Tokens are obtained through the `AuthContext` provider (defined in `app/contexts/AuthContext.tsx`)
   - The hook `useAuth()` provides access to the session token via `session.access_token`
   - In the `queryRia` function, there's a fallback mechanism that tries to get the token from:
     - The session passed as a parameter
     - localStorage (`sb-auth-token`)
     - Cookies (`sb-access-token`)
   - This token is attached to API requests in the Authorization header as `Bearer ${authToken}`

3. **Why do unauthenticated requests to /api/v1/ria/query result in a 401 Unauthorized?**
   - The backend is likely configured to require authentication for these endpoints
   - For non-logged-in users, the front-end sets default credits (2) but doesn't have an authentication token
   - The API should either accept unauthenticated requests for the free tier or implement a guest token mechanism

4. **Describe the ChatInterface component's query submission flow.**
   - User input is captured in the `input` state
   - When the form is submitted, the `handleSubmit` function calls `sendQuery`
   - The `sendQuery` function:
     - Creates a user message and a placeholder assistant message
     - Calls `askQuestion` from the `useAskApi` hook which calls `queryRia`
     - Processes the response and updates the placeholder message with the result
     - Catches errors and displays appropriate error messages
   - The error "I encountered an error processing your request" is generated in the catch block as a fallback error message

5. **How does the profile page fetch adviser data?**
   - The profile page first tries to fetch data from `/api/v1/ria/profile/${id}`
   - If that fails, it falls back to `/api/v1/ria/query` with specific parameters
   - The ID parameter comes from the URL via `useParams()`
   - ID 0 might be requested as a placeholder value or default case, which appears invalid
   - Fund data is separately fetched from `/api/funds/summary/${id}`

6. **Identify any components or pages still calling the deprecated /api/ask route.**
   - The main component flow doesn't directly call `/api/ask`
   - However, the `useApiStream.ts` hook references `/api/ask-stream`
   - In `services/ria.ts`, there's code to handle response formats from `/api/ask`
   - This suggests a transition away from `/api/ask` to `/api/v1/ria/query` is in progress

7. **How does the front‑end handle credit counting and subscription status?**
   - Credit management is handled by the `useCredits` hook in `app/hooks/useCredits.ts`
   - It tracks:
     - Current credit count (`credits` state)
     - Subscription status (`isSubscriber` state)
     - Loading state (`isLoadingCredits` state)
   - Credits are updated:
     - After API queries via `updateFromQueryResponse`
     - Manual decrements via `decrementCredits`
     - Bonus credits via `earnCredits`
   - There are potential sync issues since credits are managed both client and server-side

8. **What environment variables are referenced in the Next.js app?**
   - The main Supabase variables:
     - NEXT_PUBLIC_SUPABASE_URL (set to https://llusjnpltqxhokycwzry.supabase.co)
     - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - Application URLs:
     - NEXT_PUBLIC_APP_URL
   - Other variables in env.example:
     - AI_PROVIDER
     - STRIPE_SECRET_KEY
     - STRIPE_WEBHOOK_SECRET
     - STRIPE_PRICE_ID
     - GOOGLE_PROJECT_ID
     - GOOGLE_APPLICATION_CREDENTIALS_JSON
   - No references to the old Supabase project were found

9. **Examine the Browse and Analytics pages.**
   - The Browse page (`app/browse/page.tsx`):
     - Calls `/api/v1/ria/query` with filter parameters
     - Supports various filters like fund type, AUM range, location, etc.
     - Implements pagination of results
   - We couldn't fully analyze the Analytics page, but it likely uses similar API endpoints

10. **Are there multiple versions of the app within the repo?**
    - Yes, there are multiple versions:
      - The main app in the root directory
      - A standalone version in `/ria-hunter-standalone/`
    - Duplicated components:
      - `/components/search/` vs in-app components
      - Multiple search implementations
    - The main app in the root appears to be the canonical version deployed to Vercel

11. **How is error handling implemented for API requests?**
    - Error handling uses try/catch blocks around API calls
    - Error messages are stored in component state and displayed in the UI
    - Specific error handling for HTTP status codes:
      - 401 (Unauthorized) - Login prompts
      - 402 (Payment Required) - Subscription upgrade prompts
      - 404 (Not Found) - "Not found" messages
    - Errors are displayed via:
      - Alert boxes (red error boxes in search/browse)
      - Assistant messages (in chat)
      - Error text under forms

12. **Describe the implementation of streaming responses.**
    - The app has a `useApiStream.ts` hook that implements streaming using EventSource
    - The search page has code to handle streaming responses from `/api/v1/ria/answer`
    - However, the main chat interface doesn't use streaming
    - There seems to be an incomplete transition to streaming functionality

13. **How does the front‑end conditionally render different UI states?**
    - The UI state is controlled by:
      - Authentication state from `useAuth()`
      - Credit state from `useCredits()`
    - For signed-in subscribers:
      - Shows "Pro Plan (Unlimited)" in the header
      - Doesn't limit queries
    - For signed-in free users:
      - Shows remaining credits
      - Limits queries based on credit count
    - For signed-out users:
      - Shows a default of 2 free credits
      - Prompts login/upgrade after credits are used

14. **Where is the natural language answer formatting handled?**
    - In the chat interface, formatting happens in the `generateAnswerFromResults` function
    - It takes raw results and formats them into a natural language response
    - The search page handles answer formatting in multiple ways:
      - For streaming, it incrementally builds the answer
      - For non-streaming, it uses the parsed JSON response
    - There's no specialized formatter component; each UI handles its own formatting

15. **Are there any leftover environment variables referencing the old Supabase project?**
    - No references to the old Supabase project (aqngxprpznclhtsmibsi) were found in the codebase
    - All Supabase references appear to point to the new project URL

16. **Investigate any misuse of the /api/v1 path in the front‑end.**
    - The `/api/v1/ria/*` convention seems to be the newer pattern, replacing older `/api/*` routes
    - The planned overhaul mentions `/api/search` and `/api/answer` endpoints
    - The current implementation uses `/api/v1/ria/search` and `/api/v1/ria/answer` instead
    - This inconsistency suggests a deviation from the original plan or multiple refactorings

17. **How does the front‑end handle profiles that are not found?**
    - When a profile is not found (API returns 404):
      - The profile page shows a "Profile Not Found" message
      - There's no automatic redirect; the error state is handled in-place
      - The error logic is in the `fetchProfile` function's catch block

18. **Are there UI components for LinkedIn share bonuses and billing management?**
    - There is code for earning bonus credits in the `useCredits` hook
    - The upgrade UI is implemented in `UpgradeButton.tsx`
    - There's subscription management in the settings page
    - These components should still function if the backend APIs work correctly

19. **Describe the current Tailwind/Styling setup.**
    - The app uses Tailwind CSS for styling
    - Custom color classes use secondary-* and primary-* prefixes
    - There's some inconsistency in styling between older and newer components
    - The styling approach is utility-first with few custom CSS files

20. **Propose how the front‑end should be modified to work with the new backend architecture.**
    - Standardize on a single API pattern, either `/api/v1/ria/*` or the planned `/api/*` endpoints
    - Implement proper token management with refresh logic
    - Centralize error handling and add retry mechanisms
    - Complete the streaming implementation for the chat interface
    - Consolidate duplicate components and remove the parallel implementations
    - Standardize credit management to ensure client-server synchronization

## Additional Concerns

Beyond the issues identified in the questions, here are five critical concerns that should be addressed:

1. **Vercel Deployment Protection Conflict with API Routes**
   - When Vercel Deployment Protection is enabled (specifically "Vercel Authentication"), it blocks API routes with HTML authentication pages instead of allowing direct API access
   - This causes API calls to return 404s or authentication HTML instead of JSON responses
   - Solution: Disable "Vercel Authentication" and "Password Protection" for both frontend and backend projects in Project Settings > Deployment Protection

2. **Inconsistent Token Refresh Mechanism**
   - The application lacks a proper token refresh mechanism when tokens expire
   - This can lead to sudden authentication failures during user sessions
   - A centralized token management system with automatic refresh capability should be implemented
   - The current fallback mechanisms in `queryRia` are ad-hoc solutions that don't properly handle expired tokens

3. **Tech Debt from Multiple Refactorings**
   - The codebase shows signs of multiple incomplete refactorings
   - Legacy code, duplicate implementations, and inconsistent patterns suggest rushed changes
   - A comprehensive technical debt inventory should be conducted
   - The parallel app structure in `/ria-hunter-standalone/` should be either fully integrated or removed

4. **Missing Integration Tests**
   - While there are some unit tests (e.g., `route.test.ts` files), comprehensive integration tests are missing
   - The API route changes and front-end refactorings lack proper test coverage
   - This makes it difficult to confidently make changes without risking regressions
   - A testing strategy focusing on key user flows should be implemented

5. **Inconsistent Error Boundary Implementation**
   - React Error Boundaries are not consistently implemented across the application
   - The global error handler (`global-error.js`) exists but may not catch all component-level failures
   - Errors in async operations might not be properly captured
   - A comprehensive error handling strategy with proper error boundaries would improve reliability

## Response to Second Set of Questions

1. **Where in the frontend code are requests made to /api/v1/ria/search?**
   - The primary file making these requests is `/app/search/page.tsx`
   - The search page calls `/api/v1/ria/search` in the `handleSearch` function
   - Query parameters include:
     - query: The processed user input (lowercased and trimmed)
     - hybrid: A boolean flag for hybrid search mode
     - match_threshold: Set to 0.6 (default similarity threshold)
     - match_count: Set to 20 (default number of results)

2. **Does the chat interface still call /api/v1/ria/query?**
   - Yes, the chat interface exclusively calls `/api/v1/ria/query`
   - The POST request is sent in the `queryRia` function in `app/services/ria.ts`
   - The body includes `{ query: string }` and a bearer token is attached if available

3. **What is the current implementation for adding a JWT or bearer token to API requests?**
   - The token is obtained from the AuthContext via `useAuth()` hook
   - In `services/ria.ts`, the `queryRia` function:
     - Takes an optional `authToken` parameter
     - Falls back to localStorage and cookies if the token isn't provided
     - Attaches the token via `'Authorization': 'Bearer ${authToken}'` header

4. **How does the frontend handle anonymous users who are allowed two free queries?**
   - In the `useCredits` hook:
     - If no user or session is found, it sets `credits = 2` by default
     - For unauthenticated users, credits are tracked client-side only
     - These credits are decremented after queries in various components
     - No server-side tracking for anonymous users was found

5. **Identify all locations where the profile page fetches adviser data.**
   - In `/app/profile/[id]/page.tsx`, the `fetchProfile` function:
     - First tries `/api/v1/ria/profile/${id}` directly
     - Falls back to `/api/v1/ria/query` with specific parameters if the direct request fails
     - Makes a separate call to `/api/funds/summary/${id}` for fund data
   - The ID is derived from the URL parameters using `useParams()`
   - Calls to `/api/v1/ria/profile/0` could occur if 0 is passed as a URL parameter

6. **Are there environment variables that specify which API base URL to call?**
   - The environment includes `NEXT_PUBLIC_APP_URL` which defines the application base URL
   - No explicit `NEXT_PUBLIC_API_URL` was found in the env.example file
   - API calls are made using relative paths (e.g., `/api/v1/ria/query`) rather than absolute URLs
   - This means API calls target the same domain as the application

7. **Where are errors from API calls surfaced in the UI?**
   - In ChatInterface.tsx:
     - Errors are displayed as assistant messages in the chat interface
     - The "Query failed:" message comes from `services/ria.ts` when response.ok is false
   - In search/browse pages:
     - Errors are shown in red alert boxes with the error message
   - The profile page shows a dedicated "Profile Not Found" error state

8. **Does the frontend implement retry or fallback logic when a request returns 401 unauthorized?**
   - No automatic retry logic for 401 errors was found
   - The profile page has fallback logic to try a different endpoint when the primary one fails
   - A proper authentication retry mechanism (refresh token) is missing
   - Recommendation: Implement a centralized interceptor that handles token refresh and retries

9. **Examine any code that references the old narrative field instead of narrative_text.**
   - No direct references to a field called "narrative" were found in the frontend components
   - The current implementation appears to use properly normalized data structures
   - In the profile component, all data fields are explicitly mapped from the API response

10. **Check whether any vector dimensionality assumptions remain in the frontend.**
    - No explicit references to vector dimensions (384 or otherwise) were found in the frontend code
    - The frontend appears properly abstracted from the implementation details of the vector search
    - Vector search details seem to be handled entirely on the backend

11. **Identify how the browse page obtains its data.**
    - The browse page calls `/api/v1/ria/query` in the `handleSearch` function
    - It sends various filter parameters such as:
      - fundType, aumRange, state, location, vcActivity
      - sortBy, sortOrder, page, limit
    - Results are displayed in a grid with pagination controls

12. **How are credits and subscription status displayed differently depending on login state?**
    - In HeaderCredits.tsx and useCredits.ts:
      - For subscribers: Shows "Pro Plan (Unlimited)"
      - For free users with credits: Shows "X Credits Remaining"
      - For free users with no credits: Shows upgrade prompt
    - This logic depends on the `isSubscriber` and `credits` states from useCredits

13. **What code handles updating the credit count after a query?**
    - In the search page, the `decrementCredits` function is called after a successful search
    - In the chat interface, the `updateFromQueryResponse` function updates credits based on API response
    - Credits are synchronized with the server via POST requests to `/api/subscription-status`

14. **Locate any places where /api/ask-stream is referenced.**
    - The `useApiStream.ts` hook references `/api/ask-stream` for streaming responses
    - However, this streaming capability doesn't appear to be actively used in the chat interface
    - The search page implements its own streaming logic for `/api/v1/ria/answer`

15. **Where is the natural language response from the backend inserted into the DOM?**
    - In ChatInterface.tsx:
      - Responses are formatted by `generateAnswerFromResults` and inserted into chat messages
    - In search/page.tsx:
      - Streaming responses are built incrementally via `setStreamingAnswer`
      - Non-streaming responses are displayed directly from `answerResult.answer`
    - The AssistantMessage component renders the formatted content

16. **Are there duplication or outdated pages that are causing confusion?**
    - Yes, there are multiple duplications:
      - Search components in both `/components/search/` and `/app/components/`
      - The standalone app in `/ria-hunter-standalone/` duplicates functionality
      - Multiple API route versions (`/api/v1/ria/*` vs `/api/*`)
    - These duplications likely cause confusion and maintenance issues

17. **Check all fetch calls for the presence of cache: 'no-store'.**
    - The subscription status check uses `cache: 'no-store'` to prevent caching
    - The funds data fetch in the profile page also uses `cache: 'no-store'`
    - Most other API calls don't specify cache behavior, which could lead to inconsistent data
    - Recommendation: Standardize caching strategy across all API calls

18. **What global state or context providers are used to share user or session information?**
    - The primary context is `AuthContext` in `app/contexts/AuthContext.tsx`
    - It provides user session state throughout the application via the `useAuth` hook
    - There's no global state management library (Redux, Zustand, etc.)
    - Some state (like credits) is managed in hooks and passed down via props

19. **Provide a roadmap to migrate the frontend from /api/v1/ria/query to /api/ask and /api/v1/ria/search.**
    - Step 1: Create adapter functions that support both old and new endpoints
    - Step 2: Update the queryRia function to optionally use the new endpoints
    - Step 3: Add feature flags to control which endpoints are used
    - Step 4: Gradually migrate each component to use the new endpoints
    - Step 5: Update response handling logic to match the new response formats
    - Step 6: Remove legacy endpoint support once migration is complete

20. **Suggest improvements to the error messages shown to users.**
    - Implement context-aware error messages (e.g., network vs. auth vs. data errors)
    - Add recovery actions to error states (retry buttons, troubleshooting tips)
    - Standardize error handling across all components
    - Implement toast notifications for transient errors
    - Create an error reporting system to collect and analyze frontend errors
