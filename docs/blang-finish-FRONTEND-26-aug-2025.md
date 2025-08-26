---

## **🖥️ PROMPT FOR *FRONTEND* AGENT (paste this verbatim to the frontend agent)**

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

