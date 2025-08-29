# API Path Deprecation Notice

**Date: August 29, 2025**

## `/_backend` Path Structure Deprecated

The `/_backend` path structure previously used for API calls has been **completely deprecated** as of August 29, 2025.

### Details:

- **Old structure** (DEPRECATED): `/_backend/api/*`
- **New structure** (CURRENT): `/api/*`

All API endpoints have been consolidated to use the standard Next.js API routing pattern with paths under `/api/*`. The backend no longer serves any endpoints under the `/_backend` prefix.

### Implementation:

- Frontend proxy in `next.config.js` routes all `/api/*` requests to the backend service
- API client (`app/lib/api/client.ts`) now uses `/api` as base URL
- All documentation and implementations should reference the new path structure

### Warning:

Historical documentation files in this repository might still reference the old `/_backend` path structure. These references should be considered outdated. Always use the current `/api/*` pattern for all API requests.

This notice has been added to prevent confusion for future developers or AI agents working with this codebase.
