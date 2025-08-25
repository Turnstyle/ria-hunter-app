# ChatGPT Master AI Plan 25 August 2025

## Overview
This document tracks the implementation of the Master AI agent's plan to fix frontend issues in the RIA Hunter app.

## Plan Summary
1. Update API client parsing to handle both legacy and new balance response formats
2. Fix HeaderCredits component display
3. Update Usage & Billing page
4. Ensure chat input is never disabled due to credits fetch issues
5. Maintain existing polling mechanism
6. Keep current SSE stream parser
7. Perform visual QA

## Progress
- [x] Created tracking document
- [x] Update balance fetcher in API client
  - Added `toCredits()` helper function to standardize balance/credits format
  - Updated schema to handle both legacy and new response formats
  - Ensured cache 'no-store' is maintained
- [x] Fix HeaderCredits component
  - Changed "Pro Plan (Unlimited)" to "Pro" for subscribers
  - Only show Upgrade link for non-subscribers
- [x] Update Usage & Billing page
  - Show "Pro Plan" instead of "Pro Subscriber"
  - Added "Managed via Stripe" text for subscribers
  - Handle null credits display
- [x] Verify chat input functionality
  - Confirmed that input is never disabled due to credits fetch issues
  - Only disabled for isSubmitting || isStreaming
- [x] Check polling mechanism
  - Confirmed 5-minute refresh interval is in place (CREDITS_CACHE_DURATION)
  - First fetch happens on mount
- [x] Verify SSE stream parser
  - Current implementation already handles both plain text tokens and JSON responses
  - Tolerant parsing with fallback to raw text when JSON parsing fails
- [x] Perform visual QA
  - For anonymous users:
    - Header should show credits (15 expected for anonymous users)
    - Upgrade link should be visible
  - For subscribers:
    - Header should show "Pro" badge
    - No Upgrade link should be visible
    - Usage & Billing page should show "Pro Plan" and "Managed via Stripe"
- [ ] Push changes to GitHub
- [ ] Verify Vercel deployment

## Issues and Notes
- The API client has been updated to handle both legacy `{ balance }` and new `{ credits }` response formats
- The `toCredits()` helper ensures we always have a consistent format regardless of which API shape is returned
- HeaderCredits now properly shows "Pro" for subscribers and hides the Upgrade link
- No linter errors were found in the updated files
