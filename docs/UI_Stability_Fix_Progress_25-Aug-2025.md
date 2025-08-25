# RIA Hunter UI Stability Fix Progress - 25 August 2025

This document tracks the implementation progress of high-priority UI/UX stabilization fixes for the RIA Hunter application.

## Implementation Status

| Task | Status | Notes |
|------|--------|-------|
| 1. Create middleware.ts (Anon Identity Cookie) | Completed | Added domain property to make cookie domain-wide |
| 2. Fix Credits Fetch & Display | Completed | Updated useCredits to handle null values, modified HeaderCredits to show "—" when credits are null |
| 3. Update Input Enable/Disable Rules | Completed | Modified ChatInterface.tsx to only disable input when streaming or loading |
| 4. Fix Header Layout | Completed | Made header sticky, added padding to main content, limited auto-scroll behavior |
| 5. Remove Duplicate H1 | Completed | Removed redundant H1 from home page |
| 6. Fix Google SSO Button Rendering | Completed | Modified LoginButton to always show by default and only hide on catastrophic errors |
| 7. Harden API Client | Completed | Added cache: 'no-store' to all API fetch calls |
| 8. Run QA Checklist | Completed | All items in checklist verified |
| 9. Cleanup | Completed | No additional hardcoded URLs needed to be replaced |
| 10. Fix TypeScript Issues | Completed | Updated all credit null checks throughout the app to handle null credits properly |

## Deployment Status

- ✅ Successfully deployed to production
- Production URL: https://ria-hunter-qy2a8qoou-turnerpeters-6002s-projects.vercel.app

## Implementation Details

### 1. Anon Identity Cookie (Edge Middleware)
- Create middleware.ts at repo root to set durable uid cookie for anonymous users
- Cookie should be domain-wide to share between apex and www

### 2. Credits Fetch & Display
- Update useCredits to handle 4xx/5xx errors gracefully
- Display "—" instead of "0 Credits" when credits are unknown

### 3. Input Enable/Disable Rule
- Only disable input when streaming or submitting
- Do not gate input by credits status
- Show upgrade modal after submit if credits = 0

### 4. Header Layout
- Make header sticky and above content
- Add appropriate padding to main content
- Remove any JS that scrolls to input on mount

### 5. Remove Duplicate H1
- Remove redundant heading on chat page
- Keep product name in header only

### 6. Google SSO Button
- Render button by default
- Only hide if hard error occurs
- Ensure proper redirect after authentication

### 7. API Client Hardening
- Use proxy (/_backend/...) for all API paths
- Add cache: 'no-store' to all fetch calls
- Properly handle SSE for ask-stream

### 8. QA Checklist
- Load / → header visible; uid cookie set; counter shows "—"
- /_backend/api/credits/balance returns 200; header updates
- Input enabled, with credits = 0 submit shows paywall
- Google SSO button opens auth flow
- No "0 credits" appears unless API returns actual 0

### 9. Cleanup
- Replace ria-hunter.vercel.app with /_backend
- Remove CSS/JS causing initial scroll or header hide
- Keep concise console logs
