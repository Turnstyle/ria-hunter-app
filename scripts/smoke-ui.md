# RIA Hunter UI Smoke Tests

These smoke tests verify that the UI works correctly for both anonymous and authenticated users.

## Prerequisites

- Application deployed at https://ria-hunter.app
- Chrome DevTools or equivalent browser developer tools
- Access to an email inbox for magic link sign-in tests

## Test 1: Anonymous User Experience

1. **Open the application logged out**
   - Navigate to https://ria-hunter.app in an incognito/private window
   - Ensure you're not signed in (no user menu in header)

2. **Verify credits display**
   - Header should show "15 Credits Remaining"
   - Credits should NOT show "Loading..." for more than 2 seconds
   - "Upgrade" link should be visible next to credits

3. **Check console for API calls**
   - Open DevTools Console (F12)
   - Look for `GET /api/credits/balance`
   - Expected: Status 200 with `{ credits: 15, isSubscriber: false }`
   - Fallback: If status 401, header should still show "15 Credits" (client-side fallback)

## Test 2: Authentication Flow

1. **Send magic link**
   - Click the `Sign In` button in the header
   - Enter your email address and submit the form
   - Open the email and follow the magic link back to the app

2. **Verify Pro status (for subscribers)**
   - If account has Stripe subscription:
     - Header should show "Pro" badge with green color
     - "Unlimited" text should appear
     - "Upgrade" link should be hidden
     - "Manage" link should be visible
   - If free account:
     - Header should show credit count
     - "Upgrade" link should remain visible

3. **Credits refresh after auth**
   - Credits should update within 1-2 seconds after sign-in
   - Console should show successful `GET /api/credits/balance` call

## Test 3: Chat Streaming

1. **Ask a question**
   - Type: "Show me the top 5 RIAs in California"
   - Click send or press Enter

2. **Verify streaming behavior**
   - Text should appear token by token
   - Loading spinner should appear during generation
   - Spinner should stop when response completes

3. **Check for [DONE] marker**
   - In DevTools Console, look for: `[askStream] Received [DONE] marker`
   - Spinner should stop immediately after [DONE] is received
   - If no [DONE] received within 5 seconds of last token, spinner should stop anyway

## Test 4: Debug Overlay (Optional)

1. **Enable debug mode**
   - Open DevTools Console
   - Type: `localStorage.debug = "1"`
   - Refresh the page

2. **Verify overlay displays**
   - Black overlay should appear in bottom-right corner
   - Should show: authState, credits, isSubscriber, Balance API status
   - Should update "[DONE]: Observed ✓" when streaming completes

3. **Disable debug mode**
   - Click X button on overlay, or
   - In console: `localStorage.removeItem('debug')`

## Test 5: Error Handling

1. **Test with no credits (if possible)**
   - Use up free credits or use test account with 0 credits
   - Try to send a message
   - Should see error: "You have no credits remaining. Please upgrade your plan."
   - "Upgrade Plan" link should appear in error message

2. **Test network interruption**
   - Start a chat query
   - Turn off network (DevTools > Network > Offline)
   - Should see appropriate error message
   - Spinner should stop

## Expected Results Summary

✅ Anonymous users see "15 Credits Remaining"  
✅ Pro subscribers see "Pro" badge and "Unlimited"  
✅ Streaming shows text token-by-token  
✅ Spinner stops on [DONE] or after 5s timeout  
✅ Credits update after authentication  
✅ Debug overlay shows accurate state (when enabled)  
✅ Errors are handled gracefully without breaking UI  

## Common Issues and Solutions

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Credits show "null" or "—" | API endpoint returning 401 | Check backend logs, verify auth cookies |
| Spinner never stops | [DONE] marker not sent | Check backend SSE implementation |
| "Pro" not showing for subscriber | Webhook not processing | Check Stripe webhook logs |
| Debug overlay not appearing | localStorage not set correctly | Ensure `localStorage.debug = "1"` |

## Reporting Issues

When reporting issues, please include:
1. Browser and version
2. Authenticated or anonymous state
3. Console error messages
4. Network tab showing failed requests
5. Screenshot of the issue

---

Last updated: 2025-08-26
