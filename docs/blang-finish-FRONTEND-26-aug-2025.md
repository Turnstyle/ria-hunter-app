---

# **🖥️ Frontend Hardening Implementation Report**

**Objective:**  
 Make the UI resilient when unsigned (show the **15 free credits**), correctly display **Pro** for subscribers, and never stick the spinner. Add a debug overlay, absorb 401 gracefully (in case older deployments still 401), and provide smoke checks.

## Implementation Summary (Completed 2025-08-26)

All tasks have been successfully implemented and deployed to production. Here's a detailed breakdown of changes made:

### 1. Credits Fetching for Anonymous Users ✅
- Modified `useCredits` hook to handle anonymous users with 15 free credits
- Added resilient fallback for 401 responses from older deployments
- Implemented automatic retry mechanism for error recovery (2-3 second intervals)
- Updated HeaderCredits component to show "15 Credits" even when API errors occur
- Added null coalescing for all number displays to prevent UI type errors

### 2. Spinner Fixed to Stop Reliably ✅
- Enhanced SSE parser to properly detect and handle `[DONE]` marker
- Added 5-second inactivity timeout to finalize responses even without [DONE]
- Stream state tracking with streamCompleted flag prevents race conditions
- Proper cleanup of timers in all code paths including error cases

### 3. Gobbledygook Text Handling ✅
- Added client-side text normalization for debug mode (activated with `?debug=1`)
- Detects large blocks of text without spaces using regex pattern matching
- Adds spaces between capital letters to improve readability
- Only applied in debug mode to avoid affecting normal user experience

### 4. Debug Overlay Added ✅
- Created new DebugOverlay component
- Toggle with `localStorage.debug = "1"` 
- Shows critical information:
  - Auth state (loading/authenticated/unauthenticated)
  - User ID (truncated for privacy)
  - Credits count
  - Subscriber status
  - Last balance API response code
  - [DONE] marker observation status
- Updates in real-time with cross-component communication

### 5. Smoke Tests Documentation ✅
- Created comprehensive testing guide in `scripts/smoke-ui.md`
- Includes steps for testing:
  - Anonymous user experience
  - Authentication flow
  - Subscriber status
  - Chat streaming
  - Debug overlay
  - Error handling
- Provides expected results and troubleshooting guide

## Technical Notes

- No issues were encountered during implementation
- All changes were thoroughly tested locally before deployment
- The deployment is now live and functioning properly
- Resilience is significantly improved for network errors and API failures
- Tested across Chrome, Firefox, and Safari for compatibility

## Future Enhancements

- Consider adding more detailed network error logging to the debug overlay
- Explore adding automated Playwright/Cypress tests based on the smoke test document
- Performance optimization for StreamReader processing could be further improved

---

## **🖥️ ORIGINAL PROMPT FOR *FRONTEND* AGENT**

**Objective:**  
 Make the UI resilient when unsigned (show the **15 free credits**), correctly display **Pro** for subscribers, and never stick the spinner. Add a debug overlay, absorb 401 gracefully (in case older deployments still 401), and provide smoke checks.

---

### **0\) Repo discovery (don’t skip)**

* Search the code that calls **`/_backend/api/credits/balance`** (e.g., an `api client` or `useCredits` hook). Open it.

* Search the **stream/SSE parser** used by the chat interface. Open it.

* Search where the **header credits** and **“Upgrade / Pro”** badge are rendered. Open them.

---

### **1\) Credits fetching must succeed when unsigned**

**Change in your credits fetcher/hook (the module you opened):**

* Call `GET /_backend/api/credits/balance` **without** requiring a session first.

If the response is **200**, trust it and set:

 setCredits(json.credits ?? 0);

setIsSubscriber(\!\!json.isSubscriber);

*   
* If the response is **401** (for older deployments), treat it as anonymous and **optimistically** set `{ credits: 15, isSubscriber: false }` and schedule a silent refetch in 2–3 seconds.

* Ensure the **header** shows **“15”** for anonymous and renders **“Pro”** (and hides **Upgrade**) when `isSubscriber` is true.

**Unit tiny fix:** If any state setter complains about `number | undefined`, coerce with `?? 0` before setting.

---

### **2\) Spinner must stop every time**

In the **SSE parser** you opened:

* Already handles `{ token: "..." }` and plain text—good. Add one rule:

  * When you receive the line `data: [DONE]` (or the connection ends), finalize the message and **stop the spinner**.

* Add a **5s inactivity timeout** during generation: if no chunks arrive for 5s, finalize anyway with a note like “(response ended)”.

---

### **3\) “Gobbledygook” text ⇒ post‑process or fall back**

* If the server sends a friendly fallback (see backend prompt), just render it.

* If you still detect a **raw context block** (e.g., looks like “Theprovidedcontextonlyincludes…”—no spaces), run a tiny client‑side normalizer **only when `?debug=1` is set**:

  * Replace multiple runs of capitalized words w/o spaces into spaced output as a last resort. (This is debug‑only; normal users should see LLM text.)

---

### **4\) Add a small debug overlay (toggle with `localStorage.debug="1"`)**

* Show: `authState`, `credits`, `isSubscriber`, the last `GET /credits/balance` status code, and whether `[DONE]` was observed on the current stream.

* This speeds up field debugging without opening devtools every time.

---

### **5\) Smoke checks (no network mocking)**

Add `scripts/smoke-ui.md` in the repo with these steps (so anyone can verify):

1. Open `https://ria-hunter.app` **logged out**.

   * Header shows **“15”** and **not** “Pro”.

   * Console shows `GET /_backend/api/credits/balance` **200** (or, if 401 on older deployment, header still shows 15 because of client fallback).

2. Click **Sign in with Google** (use any test account that mapped to a Stripe subscription via webhook).

   * Header switches to **“Pro”** and hides **Upgrade** within 1–2s (after balance refetch).

3. Ask a question.

   * Text appears token by token, ends with **`[DONE]` observed** and spinner stops.

---

### **6\) Deliverables checklist**

* Credits fetcher resilient to anonymous \+ 401 fallback.

* Header correctly shows **15** or **Pro**.

* SSE parser stops spinner on `[DONE]` or idle timeout.

* `scripts/smoke-ui.md` added.

* Optional: simple Cypress/Playwright stub is okay, but don’t block on it.

---

If the agent hits something it can’t locate (e.g., can’t find the real file that maps to a production path), it should **search the repo’s route manifest and codebase** until it finds it rather than inventing a new path. 

