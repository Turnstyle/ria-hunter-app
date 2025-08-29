# IMPORTANT: Backend Path Structure Deprecation Notice

**Date: August 29, 2025**

## All references to `/_backend` paths are now DEPRECATED

Any documentation, code examples, or references to the `/_backend` path structure in this repository should be considered **outdated and deprecated**.

### Current API Path Structure

The application now uses standard Next.js API routing with all endpoints under the `/api/*` path structure:

```javascript
// ✅ CORRECT - Current API paths
fetch('/api/ask', {...})                // Main search endpoint
fetch('/api/session/status', {...})     // Session status
fetch('/api/credits/balance', {...})    // Credit balance
```

### Deprecated Path Structure

The following path structure is **no longer supported**:

```javascript
// ❌ DEPRECATED - Do not use
fetch('/_backend/api/ask', {...})                // Outdated
fetch('/_backend/api/session/status', {...})     // Outdated
fetch('/_backend/api/credits/balance', {...})    // Outdated
```

## Implementation Details

The API consolidation was completed on August 29, 2025:
1. Frontend uses Next.js rewrites to forward `/api/*` requests to the backend
2. Backend serves all endpoints at standard `/api/*` paths
3. API client uses `/api` as its base URL
4. No endpoints are served under `/_backend` prefix

This notice is added to prevent confusion for future developers or AI agents working with this codebase.
