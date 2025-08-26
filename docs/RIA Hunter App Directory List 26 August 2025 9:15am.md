# RIA Hunter App Directory List (26 August 2025, 9:15am)

This document provides a comprehensive directory listing of the RIA Hunter App project structure to assist AI agents in locating files and understanding the project organization.

## Root Directory Structure

```
/Users/turner/projects/ria-hunter-app/
```

## Top-Level Files and Directories

- `api-path-refactor-summary.md`
- `api-path-update-summary.md`
- `app/` (Next.js application directory)
- `ChatGPT_Master_AI_plan_25_August_2025.md`
- `docs/` (Documentation directory)
- `env.example`
- `env.local`
- `IMPLEMENTATION_README.md`
- `instrumentation.js`
- `jest.config.js`
- `jest.setup.ts`
- `libs/` (Shared libraries)
- `middleware.ts`
- `next-env.d.ts`
- `next.config.complex.js`
- `next.config.js`
- `node_modules/`
- `overhaul_progress.md`
- `package-lock.json`
- `package.json`
- `PERFORMANCE_IMPROVEMENTS.md`
- `postcss.config.js`
- `prisma/` (Database schema and migrations)
  - `schema.prisma`
- `project.json`
- `public/` (Static assets)
- `README.md`
- `ria-hunter-standalone/` (Standalone version)
- `ria-hunter-ui-fixes-summary.md`
- `scripts/` (Utility scripts)
- `standardize-credits-format-summary.md`
- `styles/` (CSS styles)
- `tailwind.config.js`
- `test-db.js`
- `test-ria-hunter.js`
- `tsconfig.json`
- `tsconfig.spec.json`
- `tsconfig.tsbuildinfo`
- `vercel.json`

## Main Application Structure (`app/`)

### API Routes

The API routes are located in `app/api/` with the following structure:

- `app/api/balance/route.ts` - Balance endpoint
- `app/api/create-checkout-session/route.ts` - Stripe checkout session creation
- `app/api/create-portal-session/route.ts` - Stripe portal session creation
- `app/api/credits/` - Credits management
  - `app/api/credits/balance/route.ts` - Credits balance endpoint
  - `app/api/credits/debug/route.ts` - Credits debug endpoint
  - `app/api/credits/refill/route.ts` - Credits refill endpoint
- `app/api/debug/route.ts` - Debug endpoint
- `app/api/debug-profile/route.ts` - Profile debugging
- `app/api/debug-subscription/route.ts` - Subscription debugging
- `app/api/funds/route.ts` - Funds management
- `app/api/health/route.ts` - Health check endpoint
- `app/api/health/status/route.ts` - Detailed health status
- `app/api/listings/` - Listings endpoints
  - `app/api/listings/[id]/route.ts` - Specific listing by ID
  - `app/api/listings/create/route.ts` - Create listing
  - `app/api/listings/update/route.ts` - Update listing
  - `app/api/listings/list/route.ts` - List all listings
- `app/api/manual-subscription-fix/route.ts` - Manual subscription fix
- `app/api/problem-report/route.ts` - Problem reporting
- `app/api/redeem-share/route.ts` - Share redemption
- `app/api/ria/` - RIA-specific endpoints
  - `app/api/ria/profile/route.ts` - RIA profile
  - `app/api/ria/query/route.ts` - RIA query
  - `app/api/ria/search/route.ts` - RIA search
- `app/api/ria-hunter/` - RIA-Hunter specific endpoints
  - `app/api/ria-hunter/ask/route.ts` - Ask endpoint
  - `app/api/ria-hunter/chat/route.ts` - Chat endpoint
  - `app/api/ria-hunter/search/route.ts` - Search endpoint
- `app/api/ria-search/route.ts` - RIA search endpoint
- `app/api/stripe/route.ts` - Stripe integration
- `app/api/stripe-webhook/route.ts` - Stripe webhook handler
- `app/api/test-ai/route.ts` - AI testing
- `app/api/v1/` - V1 API endpoints
  - `app/api/v1/ria/profile/route.ts` - RIA profile (v1)
  - `app/api/v1/ria/query/route.ts` - RIA query (v1)
  - `app/api/v1/ria/search/route.ts` - RIA search (v1)
  - `app/api/v1/subscription/route.ts` - Subscription management (v1)

### Page Routes

- `app/analytics/page.tsx` - Analytics page
- `app/browse/page.tsx` - Browse page
- `app/chat/page.tsx` - Chat interface
- `app/credits/debug/page.tsx` - Credits debug page
- `app/login/page.tsx` - Login page
- `app/page.tsx` - Home page
- `app/profile/page.tsx` - Profile page
- `app/profile/[id]/page.tsx` - User profile page
- `app/search/page.tsx` - Search page
- `app/settings/page.tsx` - Settings page
- `app/subscription/cancel/page.tsx` - Subscription cancellation
- `app/subscription/success/page.tsx` - Subscription success
- `app/test-api/page.tsx` - API testing
- `app/test-auth/page.tsx` - Auth testing
- `app/usage-billing/page.tsx` - Usage and billing

### Components

- `app/components/AssistantMessage.tsx` - Assistant message component
- `app/components/auth/` - Authentication components
  - `LoginButton.tsx`
  - `LogoutButton.tsx`
  - `ProfileDropdown.tsx`
- `app/components/ChatInterface.tsx` - Chat interface component
- `app/components/credits/` - Credits-related components
  - `HeaderCredits.tsx` - Header credits display
  - `ManageCredits.tsx` - Credits management
  - `PurchaseCredits.tsx` - Credits purchase
- `app/components/dev/DebugPanel.tsx` - Developer debug panel
- `app/components/ErrorBoundary.tsx` - Error boundary component
- `app/components/ErrorDisplay.tsx` - Error display component
- `app/components/layout/Header.tsx` - Header component
- `app/components/QuerySuggestions.tsx` - Query suggestions
- `app/components/subscription/` - Subscription components
  - `SubscriptionDetails.tsx` - Subscription details
  - `UpgradeButton.tsx` - Upgrade button
- `app/components/support/ProblemReportForm.tsx` - Problem report form
- `app/components/SystemStatus.tsx` - System status component

### Contexts

- `app/contexts/AuthContext.tsx` - Authentication context provider

### Hooks

- `app/hooks/useApi.ts` - API hook
- `app/hooks/useApiStream.ts` - API streaming hook
- `app/hooks/useAuthStatus.ts` - Auth status hook
- `app/hooks/useCredits.ts` - Credits management hook

### Library Files

- `app/lib/api/client.ts` - API client
- `app/lib/auth-helpers.ts` - Authentication helpers
- `app/lib/credits-ledger.ts` - Credits ledger implementation
- `app/lib/database.ts` - Database utilities
- `app/lib/data-helpers.ts` - Data helpers
- `app/lib/error-handling.ts` - Error handling utilities
- `app/lib/logging.ts` - Logging utilities
- `app/lib/metrics.ts` - Metrics collection
- `app/lib/pricing.ts` - Pricing utilities
- `app/lib/supabase-browser.ts` - Supabase browser client
- `app/lib/supabase-server.ts` - Supabase server client
- `app/lib/subscription-helpers.ts` - Subscription helpers
- `app/lib/ui-helpers.ts` - UI helper functions
- `app/lib/validators.ts` - Validation utilities

### Services

- `app/services/ria.ts` - RIA service integration

## Libs Directory (`libs/`)

- `libs/schemas/src/` - Shared schemas
- `libs/supabase/` - Supabase client libraries

## Documentation (`docs/`)

Contains various documentation files about implementation plans, fixes, and other project-related information.

## Scripts (`scripts/`)

- `scripts/credits-ledger-migration.sql` - SQL for credits ledger migration
- `scripts/optimize-database.sql` - Database optimization SQL
- `scripts/test-credits-ledger.js` - Credits ledger testing script

## Prisma (`prisma/`)

- `prisma/schema.prisma` - Prisma database schema

## Public (`public/`)

Contains static assets like favicons and images.
