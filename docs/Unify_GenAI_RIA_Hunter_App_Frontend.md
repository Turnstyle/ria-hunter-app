## **RIA-Hunter: Unified Architecture Overhaul & Integration Plan (v3)**

### **1\. Executive Summary & Mission Briefing**

**Current Situation:** The RIA-Hunter platform is struggling due to a fundamental architectural conflict. It's a system with a "divided brain," split across two repositories: ria-hunter (the backend) and ria-hunter-app (the frontend). The backend possesses powerful GenAI capabilities, but the frontend uses its own separate, brittle, and less intelligent search logic. This leads to inconsistent results, a frustrating user experience (e.g., failing on simple queries like "St Louis"), and a maintenance nightmare.

**The Mission:** We will execute a strategic rewiring of the entire system to resolve these issues permanently. This is not a patch; it is a definitive architectural overhaul. We will consolidate all intelligence into a single, authoritative backend service and transform the frontend into a pure, streamlined user interface.

Expected System Capabilities & Example Queries:  
Upon mission completion, the platform will be capable of answering a wide range of user queries with speed and accuracy. The goal is to move from simple keyword matching to true semantic understanding.

* **Simple, Direct Queries:**  
  * "RIAs in St Louis, MO"  
  * "Show me the top 10 largest RIAs in California by AUM"  
  * "What is the contact info for Buckingham Strategic Wealth?"  
* **Complex & Multi-faceted Queries:**  
  * "Find RIAs in Texas with over $1 billion in AUM that specialize in retirement planning for doctors."  
  * "Which firms in the Pacific Northwest work with tech executives and offer private placement investments?"  
* **Nuanced & Conceptual Queries:**  
  * "I'm a startup founder who just sold my company. Which RIAs can help me with sudden wealth management?"  
  * "Advisors that focus on socially responsible investing"  
  * "Which firms have a narrative that mentions a 'holistic approach' to financial planning?"

**Your Roles:** Two specialized AI agents are assigned to this mission. Your roles are distinct, and you must operate strictly within your designated boundaries.

* **ria-hunter-agent (Backend Specialist):** Your sole focus is the ria-hunter repository. You will transform it into a powerful, headless "AI Brain" for the entire application. You are responsible for all data processing, AI logic, database interaction, and API creation. You will not touch the ria-hunter-app repository.  
* **ria-hunter-app-agent (Frontend Specialist):** Your sole focus is the ria-hunter-app repository. You will strip it of all backend logic and transform it into a pure, responsive user interface. You are responsible for all UI components, user interactions, and calling the backend API. You will not touch the ria-hunter repository.

**Operational Protocols & Workflow:**

* **Model Context Protocols (MCPs):** You have access to GithubMCP for repository interactions, SupabaseMCP for database schema verification, and BrowserMCP for end-to-end testing. Use them as required by your assigned tasks.  
* **Version Control:** You will push your changes to GitHub periodically with clear, descriptive commit messages. This ensures our work is saved and versioned.  
* **Deployment:** The Vercel CLI is configured in your environment. After pushing major changes, you will use the Vercel CLI to deploy your respective applications and ensure the deployments succeed in production.  
* **Security & Integrity:**  
  * **Environment Variables are SACROSANCT.** Under no circumstances are you to delete or alter existing environment variables. All necessary API Keys and Secrets are correctly configured and in place.  
  * **The .gitignore file is correctly configured to protect secrets and prevent large files from being committed.** Do not modify it unless explicitly instructed. Your work must not reintroduce previously removed large files to the repository history.

### **2\. Plan for ria-hunter-app-agent (Frontend Specialist)**

YOU ARE THE BEST FRONTEND DEVELOPER IN THE WORLD\!

**Primary Goal (Revised):** Your mission is to **surgically rewire** the ria-hunter-app's data-fetching mechanism while **meticulously preserving the existing User Interface (UI) and User Experience (UX)**. The application's design, component structure, and user credit/billing systems are to remain intact. You will simplify the frontend by delegating all heavy lifting (search, parsing, data processing) to the ria-hunter service, but you will not "throw the baby out with the bathwater" by removing established UI features.

#### **Step 2.1: Surgically Replace Data-Fetching Logic in Search Components**

Your work here is focused *only* on the logic that fetches data, not the visual presentation.

* **File to Modify:** ria-hunter-app/components/search/OptimizedSearchForm.tsx (or the primary search input component).  
* **Action:**  
  1. **Identify the Target Function:** Locate the handleSearch or onSubmit function that is triggered when the user submits a query. This is your only area of operation within this component.  
  2. **Do Not Change JSX:** The JSX/HTML structure of the search form, the results display area, loading spinners, and error messages must **not** be altered. The existing visual components are to be preserved.  
  3. **Replace Internal Logic:** Inside the target function, delete the existing code that calls local API routes (/api/ria-hunter/search, etc.) and performs any client-side data manipulation.  
  4. **Implement New Fetch Call:** Replace the deleted code with a single fetch POST request to the new, centralized API endpoint (process.env.NEXT\_PUBLIC\_RIA\_HUNTER\_API\_URL \+ '/api/v1/ria/query').  
  5. **Pass the User's Query:** The body of the POST request will be simple: JSON.stringify({ query: userInput }), where userInput is the raw text from the search bar.  
  6. **Maintain State Management:** The existing state management logic (isLoading, error, data) should be connected to this new fetch call. Set isLoading to true before the fetch, and set it to false in a finally block. Populate the existing data state variable with the results or the error state variable if the call fails. The UI will then react to these state changes as it was originally designed to do.

#### **Step 2.2: Preserve User State, Credit, and Billing Systems**

This part of the application is **off-limits for modification**. Your changes to the search functionality should have no impact on these systems.

* **No-Change-Zone:** Do not modify any components or logic related to:  
  * User authentication (login/signup pages, Supabase Auth client).  
  * Displaying user credits (free, earned, or paid).  
  * The Stripe integration for purchasing credits.  
  * The user profile or account management pages.  
* **Your Mandate:** The goal is to make the core search feature smarter, not to re-architect the application's business logic. The user credit system will continue to function as-is, with credit deductions handled by the backend based on the authenticated user ID sent with each request.

#### **Step 2.3: Aggressively Prune Redundant *Backend* API Routes**

The files you are deleting are part of the ria-hunter-app's *internal, now-obsolete backend*. Deleting them will have **no effect on the visible frontend components**. This is a cleanup task to remove unused server-side code from the frontend project.

* **Directories/Files to DELETE from ria-hunter-app:**  
  * app/api/ria-hunter/search/route.ts  
  * app/api/ask/route.ts  
  * app/api/browse-rias/route.ts  
  * app/api/ria-hunter/fast-query/route.ts  
  * app/api/ria-hunter/match-thesis/route.ts  
  * app/api/ria-hunter/profile/\[cik\]/route.ts

#### **Step 2.4: Update Environment Variables for Communication**

The frontend needs to know where the backend lives.

* **File to Modify:** ria-hunter-app/.env.local and ria-hunter-app/env.example.  
* **Action:** Add a new environment variable that points to the deployed ria-hunter service.  
  \# The publicly accessible URL for your deployed ria-hunter service.  
  NEXT\_PUBLIC\_RIA\_HUNTER\_API\_URL="https://your-ria-hunter-service-url.vercel.app"

  *Note: You will get the final URL from the ria-hunter-agent after it completes its first successful deployment.*

#### **Step 2.5: Workflow, Deployment, and Validation**

1. **Implement Step 2.4:** Add the new environment variable to your .env.local and env.example files.  
2. **Implement Step 2.1 & 2.3:** Surgically replace the data-fetching logic and prune the old API routes.  
3. **COMMIT POINT 1:** After the search component is refactored and old files are deleted, commit your changes to GitHub with the message: feat: overhaul search to use centralized v1 API while preserving UI.  
4. **DEPLOY:** Use the Vercel CLI (vercel deploy \--prod) to deploy the ria-hunter-app service.  
5. **Crucial Validation Step:** After your application is deployed, use the BrowserMCP to perform end-to-end testing on the production URL. Your testing must validate that the core issues are resolved and that no UI/UX regressions have been introduced.  
   * **Functional Test Scenarios:**  
     * **Location Normalization:** Query "RIAs in St Louis". The result should be correct.  
     * **Typo Tolerance:** Query "RIAs in Sant Louis". The system should handle the typo gracefully.  
     * **Superlatives:** Query "What are the top 5 largest RIAs in New York?".  
   * **UI/UX Regression Tests:**  
     * Confirm the loading spinner appears during a search.  
     * Confirm an error message is displayed gracefully if the API call fails.  
     * Log in as a test user. Confirm the user's credit balance is still displayed correctly.  
     * Perform a search while logged in and confirm the user experience is unchanged.  
* **Relevant Documentation for ria-hunter-app-agent:**  
  * **Next.js App Router:** [https://nextjs.org/docs/app](https://nextjs.org/docs/app)  
  * **Vercel AI SDK (for reference, though you are removing its direct use):** [https://sdk.vercel.ai/docs](https://sdk.vercel.ai/docs)

#### **Step 2.6: Troubleshooting Guide for ria-hunter-app-agent**

* **If API calls fail with a CORS error:** The backend service is not configured correctly. Notify the ria-hunter-agent. This is not a frontend issue.  
* **If API calls fail with a 404 Not Found error:** Double-check that the NEXT\_PUBLIC\_RIA\_HUNTER\_API\_URL environment variable is set correctly in Vercel and that your fetch call is constructing the URL properly.  
* **If the UI does not update with data, or the layout breaks:**  
  1. Use the browser's Network tab to inspect the API response. Is the data in the expected format (an array of objects)? The structure of the data returned by the new API might be slightly different from the old one.  
  2. Check your component's props and state. Ensure the component that renders the results is receiving the data correctly. You may need to make a minor adjustment to how you access properties on the result objects (e.g., result.firm\_name vs result.name), but you should not change the component's overall structure.  
* **If an end-to-end test fails:** Isolate the problem. Is it a data issue (wrong results from the API) or a rendering issue (correct data, but the UI is broken)? If it's a data issue, report it to the ria-hunter-agent. If it's a rendering issue, debug the specific React component responsible for displaying that data.

This unified plan provides a clear path to a robust, scalable, and intelligent application. Execute your roles with precision. Begin.