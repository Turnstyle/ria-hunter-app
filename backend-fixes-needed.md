# Backend Fixes Needed for RIA Hunter App

## Context
The frontend is experiencing issues with subscription detection and API calls. A user with email `turnerpeters@gmail.com` has a pro subscription obtained through a Stripe coupon code, but the frontend is not recognizing them as a subscriber.

## Stripe Details for Testing
- Customer ID: `cus_Sp2kjH5XmCfXvK`
- Subscription Item ID: `si_Sp2kFoPi3GCtnr`  
- Coupon ID: `O0Pr166W`
- Coupon Promotion Code API ID: `promo_1RtOPALaDvJs6iuGfa4PtkkG`
- User Email: `turnerpeters@gmail.com`

## Issues to Fix

### 1. Missing API Endpoints
The frontend expects these endpoints to exist at `https://ria-hunter.vercel.app/api/*`:

1. **`/api/ask`** - Main endpoint for RIA searches
   - Should accept POST requests with search queries
   - Should handle browse-type queries with filters
   - Should return RIA results with metadata about subscription status
   - Should handle coupon-based subscriptions properly

2. **`/api/session/status`** - Session status endpoint
   - Should return user's subscription status including coupon-based subscriptions
   - Response format expected:
   ```json
   {
     "searchesRemaining": 5,
     "searchesUsed": 0,
     "isSubscriber": true
   }
   ```

3. **`/api/subscription-status`** - Subscription status endpoint
   - Should properly detect subscriptions obtained via coupon codes
   - Should check both Supabase subscriptions table AND Stripe directly

### 2. Subscription Detection Logic
The backend needs to properly detect subscriptions that were obtained with coupon codes. The logic should:

1. Check the Supabase `subscriptions` table
2. Check the `user_profiles` table for `subscription_status` and `subscription_tier`
3. **IMPORTANT**: Query Stripe directly using the `stripe_customer_id` to check for active subscriptions with discounts/coupons
4. Consider a user as a subscriber if ANY of these conditions are true:
   - Has active subscription in Supabase subscriptions table
   - Has `subscription_status = 'active'` in user_profiles
   - Has `subscription_tier = 'pro'` in user_profiles
   - Has active subscription in Stripe (including those with 100% discount coupons)

### 3. Stripe Webhook Handling
Ensure the Stripe webhook properly handles subscriptions created with coupon codes:
- When a subscription is created with a 100% discount coupon, it should still be recorded in the database
- The `subscriptions` table should be updated even for $0 subscriptions
- The `user_profiles` table should have `subscription_status` set to 'active' and `subscription_tier` set to 'pro'

### 4. API Response Format for `/api/ask`
The endpoint should return data in this format:
```typescript
interface AskResponse {
  answer?: string;
  results?: Array<{
    id: string;
    firm_name?: string;
    crd_number?: string;
    city?: string;
    state?: string;
    aum?: number;
    employee_count?: number;
    website?: string;
    services?: string[];
    fundTypes?: string[];
    vcActivity?: number;
  }>;
  sources?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
  }>;
  metadata?: {
    remaining?: number;
    searchesRemaining?: number;
    searchesUsed?: number;
    isSubscriber?: boolean;
    totalCount?: number;
  };
  totalCount?: number;
}
```

### 5. Browse Query Handling
When the `/api/ask` endpoint receives a query with `type: 'browse'`, it should:
1. Parse the filters from the options object
2. Query the RIA database with those filters
3. Return paginated results
4. Support sorting and filtering by:
   - State
   - City  
   - Fund type
   - AUM range
   - VC activity level

## Testing Steps
1. Deploy the backend fixes
2. Test with the user `turnerpeters@gmail.com` who has a coupon-based subscription
3. Verify that:
   - The browse page loads RIA results
   - The subscription status shows "Pro Plan" instead of "Free Plan"
   - API calls to `/api/ask` succeed
   - The session status correctly identifies the user as a subscriber

## Database Schema Reference
The backend should be using these tables:
- `subscriptions` - Stripe subscription data
- `user_profiles` - User profile data including stripe_customer_id
- `rias` or similar - RIA data for browse/search functionality

## Important Notes
- The frontend is already configured to proxy `/api/*` requests to `https://ria-hunter.vercel.app/api/*`
- The frontend uses the `RIAHunterAPIClient` class which expects these endpoints to exist
- Coupon-based subscriptions (especially 100% discount) need special handling to be recognized properly
