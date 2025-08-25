# Credits Format Standardization

## Changes Made

1. **Standardized on `{ credits, isSubscriber }` format**:
   - Updated the `CreditBalance` interface in `app/lib/credits-ledger.ts` to include both `credits` and `balance` (for backwards compatibility)
   - Modified the `getCreditsStatus` function to return both fields
   - Updated the `getCreditsDebugInfo` function to include both fields

2. **Updated API Endpoints**:
   - Modified `/api/credits/balance/route.ts` to return both `credits` and `balance`
   - Updated `/api/credits/deduct/route.ts` to use `credits` as the primary field while maintaining `remaining` for backwards compatibility

3. **Updated UI Components**:
   - Modified `app/components/credits/CreditsDebug.tsx` to display credits correctly

## Verification

- HeaderCredits component correctly shows "Pro" and hides the "Upgrade" button for subscribers
- Usage & Billing page correctly displays "Managed via Stripe" for subscribers when `isSubscriber` is true
- Balance shape now standardizes on `{ credits, isSubscriber }` format while maintaining backwards compatibility with `{ balance }`

## Future Work

Long-term, the application should phase out the use of the `balance` field entirely, but for now, it's maintained for compatibility.
