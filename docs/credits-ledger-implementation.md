# RIA-Hunter Credits Ledger Implementation

This document outlines the implementation of the Credits Ledger system in RIA-Hunter, which follows the principles of stable identity, idempotent operations, and a single source of truth.

## Core Principles

1. **Ledger, not counters** - We use append-only ledger entries with positive and negative deltas, rather than updating a single counter.
2. **Idempotency everywhere** - Every credit operation has a unique idempotency key to prevent duplicate operations.
3. **Single source of truth** - Stripe events create credits; the app consumes them.
4. **Stable identity** - Every request resolves to a deterministic user_id.
5. **Visibility** - Debug endpoints allow inspection of the ledger and related events.

## Key Components

### Database Schema

- `credits_account`: Cache of current balance for quick access
- `credits_ledger`: Append-only log of all credit operations
- `stripe_events`: Record of processed Stripe events

### API Endpoints

- `/api/credits/balance`: Get current credit balance and subscription status
- `/api/credits/deduct`: Deduct credits for an operation (idempotent)
- `/api/credits/debug`: View debug information about credits and Stripe events

### Frontend Components

- `useCredits` hook: React hook for accessing credit information
- `HeaderCredits`: Display credits in the header
- `CreditsDebug`: Component for viewing credit debug information

## Credit Operations

### Adding Credits

Credits can be added from:
- Stripe subscription creation/renewal
- One-time purchases
- Coupon redemptions
- Admin adjustments

### Consuming Credits

Credits are deducted when:
- Making API requests
- Performing queries
- Using premium features

All operations are idempotent, identified by a unique key, and fail gracefully if insufficient credits are available.

## Testing

A comprehensive test script is available at `scripts/test-credits-ledger.js` that verifies:
- Credit additions
- Credit deductions
- Idempotency
- Balance calculations
- Error handling

## Deployment

To deploy the credits ledger system:

1. Run the migration script: `scripts/credits-ledger-migration.sql`
2. Deploy the updated API endpoints and frontend components
3. Verify functionality with the test script

## Debug Access

Access the debug interface at `/credits/debug` to view:
- Current credit balance
- Ledger entries
- Stripe events
- Account status
