# API Path Update Summary

This document summarizes the changes made to align the frontend with the backend changes.

## Changes Made

1. Updated API endpoint paths from `/api/ria/...` to `/api/v1/ria/...` in:
   - `app/search/page.tsx`
   - `app/browse/page.tsx`

2. Updated search parameters to include the new options:
   - Added `match_threshold: 0.6` (default similarity threshold)
   - Added `match_count: 20` (default number of results)
   - Removed `efSearch` parameter (no longer needed with the new API)
   - Maintained existing `hybrid` parameter for hybrid search

## Alignment with Backend Changes

1. **Vector Dimensions**: 
   - The frontend does not directly generate embeddings, so no changes were needed for the 384 to 768 dimension change.
   - All embedding generation is handled by the backend.

2. **API Endpoints**:
   - Updated all endpoints to use the `/api/v1/ria/...` pattern.
   - The main endpoints in use are:
     - `/api/v1/ria/search` - For semantic search
     - `/api/v1/ria/query` - For structured queries
     - `/api/v1/ria/answer` - For generating answers based on search results
     - `/api/v1/ria/profile/:id` - For retrieving profile details

3. **Authentication**:
   - No changes were needed for authentication as the frontend already uses Supabase authentication.

## Additional Notes

1. The hybrid search toggle in the UI is preserved, allowing users to combine vector similarity with text search for better results with proper names.

2. The current parameters (`match_threshold`, `match_count`, etc.) are set to their default values. These could be exposed via advanced search settings in the future if desired.

3. No embedding-related code was found in the frontend that needed updating from 384 to 768 dimensions, as the backend handles all embedding generation.

## Testing Recommendations

Before deploying to production, test:

1. Standard search functionality with various query types
2. The hybrid search toggle behavior
3. Authentication and credit deduction
4. Profile retrieval by ID
5. Browse functionality with filters

## Next Steps

Monitor for any errors in the network tab when calling these API endpoints. If errors occur, check:

1. Authentication token transmission
2. Parameter formatting
3. Response handling for any format changes

The backend team confirmed that the core functionality remains the same, but with improved semantic search capabilities from the corrected dimension handling.
