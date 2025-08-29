# ⚠️ DEPRECATED API PATHS NOTICE

> **IMPORTANT: As of August 29, 2025, the `/_backend` path structure has been deprecated.**

This document serves as a central notice that all references to `/_backend` paths in documentation, code examples, and other files within this repository should be considered **outdated and deprecated**.

## Affected Documentation Files

The following documentation files contain references to the deprecated `/_backend` path structure:

- `credit_Frontend_overhaul_claude_lift_v2_27-Aug-2025.md`
- `Q&A_Claude_27-Aug-2025.md`
- `UI_Stability_Fix_Progress_25-Aug-2025.md`
- `frontend_tasks_from_claude_26-Aug-2025.md`
- `blang-finish-FRONTEND-26-aug-2025.md`
- `Hardening_for_Master_AI_Agent_25th_August_2025.md`
- `CLAUD Q&A August 27.md`

## Current API Path Structure

All API endpoints are now served under the standard `/api/*` path structure:

```javascript
// ✅ CORRECT - Current API paths
fetch('/api/ask', {...})
fetch('/api/v1/ria/profile/123', {...})
fetch('/api/session/status', {...})
```

## Implementation

The application now uses Next.js rewrites to forward requests from the frontend to the backend:

```javascript
// In next.config.js
{
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://ria-hunter.vercel.app/api/:path*'
      }
    ]
  }
}
```

The API client (`app/lib/api/client.ts`) uses `/api` as its base URL.

## Historical Context

The `/_backend` path structure was originally used to proxy requests from the frontend to the backend. This was replaced with the standard Next.js API routing pattern for better compatibility and maintainability.

This notice is added to prevent confusion for future developers or AI agents working with this codebase.
