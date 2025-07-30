# RIA Hunter App – Front‑End Master Refactor Plan

*(GitHub repo: ****Turnstyle/ria-hunter-app**** | Username: ****Turnstyle****)*

## Goal

Clean up the repository structure, connect the UI to the new backend APIs, and guarantee zero‑friction Vercel deployments.

---

## Sub‑Plans

| ID   | File                      | Purpose                                                                              | Model Label        |
| ---- | ------------------------- | ------------------------------------------------------------------------------------ | ------------------ |
| SP‑1 | `01_repo_root_cleanup.md` | Flatten folder hierarchy, fix `.gitignore`, and ensure Vercel builds from repo root. | *(default model)*  |
| SP‑2 | `02_smart_search_ui.md`   | Implement Search bar → calls `/api/ask`, render results card with AI summary.        | *Opus Without Max* |
| SP‑3 | `03_env_and_deploy.md`    | Configure env vars, scripts, and Vercel project settings for seamless CI/CD.         | *(default model)*  |

> **Context for other agents**\
> – Backend work lives in **Turnstyle/ria-hunter**; this front‑end relies on those endpoints only.\
> – Do **not** attempt database writes; read‑only via REST/GraphQL.

---

## AI Agent Instructions

### Environment

| Item           | Setting                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| **IDE**        | Cursor                                                                                  |
| **Terminal**   | Windows PowerShell                                                                      |
| **Assumption** | Nothing is installed. Verify with:`python --version`, `node --version`, `git --version` |

### Execution Instructions

1. **Autonomy** – Act independently; ask only if blocked or if secrets are missing.
2. **Commands** – Run each PowerShell command separately (no `&&` or `;`).
3. **File Edits** – Use Cursor editor. For env files:
   ```powershell
   echo "KEY=VALUE" >> .env.local
   ```
4. **Plan Updates** – Before each commit, add a brief note in **Status** of the active sub‑plan.

### Tool Usage

- **GitHub Multi‑Commit PR (MCP)** preferred.
  1. On MCP error, analyse and adjust.
  2. On second failure, use raw `git` commands.
  3. If a command hangs, notify user and wait.
- **Browser MCP** only for documentation searches.

---

## High‑Level Task Breakdown

1. **Flatten repo root** – Move all code from `ria-hunter-standalone/` to root, delete `AppFoundation/`, lift configs (.gitignore, package.json).
2. **Update imports & paths** – Adjust `tsconfig`, `next.config.js`, and any aliases affected by move.
3. **Integrate API** – Replace mock data calls with `fetch('/api/ask')`.
4. **Add result card** – Show AI answer, sources, and basic firm info.
5. **Deploy checks** – Ensure `vercel build` succeeds locally; set project root `/` in Vercel dashboard.
6. **CI setup** – Verify GitHub → Vercel automatic deployments.

---

## Troubleshooting Guide

| Symptom                  | Cause                 | Fix                                       |
| ------------------------ | --------------------- | ----------------------------------------- |
| Build fails on Vercel    | Wrong project root    | Set root to `/` in Vercel settings        |
| 404 API errors           | Backend URL wrong     | Add `NEXT_PUBLIC_API_URL` in `.env.local` |
| Module resolution errors | Path aliases outdated | Update `tsconfig.paths`                   |
| `Module not found: sass` | Missing deps          | `npm install sass`                        |

---

## Documentation Links

- **Next.js Docs** – [https://nextjs.org/docs](https://nextjs.org/docs)
- **Vercel Environment Variables** – [https://vercel.com/docs/environment-variables](https://vercel.com/docs/environment-variables)
- **Supabase JS Client** – [https://supabase.com/docs/reference/javascript](https://supabase.com/docs/reference/javascript)

---

## Status

*(Add progress notes here before each commit)*

---

## Helpful info from ai agent in ria-hunter project

Of course. I have conducted a thorough review of the `RIA-Hunter` codebase. Here is a comprehensive guide tailored for the AI agent that will be developing the `ria-hunter-app`.

---

This document provides essential context about the `RIA-Hunter` backend. Understanding this service is crucial for successfully building the `ria-hunter-app` that will consume its APIs.

### 1. High-Level Overview

**Purpose:** The `RIA-Hunter` repository is a self-contained **data and AI backend**. Its primary function is to process SEC filings for Registered Investment Advisers (RIAs), store the data in a Supabase database, and provide an intelligent, natural-language query API.

**Key Technologies:**
*   **Framework:** Next.js (used for its API routes, not for frontend rendering)
*   **Language:** TypeScript
*   **Database:** Supabase (PostgreSQL) with the `pgvector` extension for semantic search.
*   **AI & Data Processing:**
    *   **Google Vertex AI (Document AI):** Extracts structured data from PDF documents (SEC Form ADV).
    *   **Google Vertex AI (Gemini):** Powers the natural language question-answering capabilities.
    *   **Google Vertex AI (Embeddings):** Generates vector embeddings for semantic search.

### 2. Core APIs for `ria-hunter-app`

Your primary interaction with this backend will be through its API endpoints.

#### **Primary Endpoint: `/api/ask`**

This is the most important endpoint for the user-facing application. It allows you to query the entire RIA database using plain English.

*   **Method:** `POST`
*   **Request Body:**
    ```json
    {
      "query": "Your user's natural language question here",
      "limit": 5 // Optional: Number of sources to return (default: 5)
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "answer": "A conversational, AI-generated answer to the user's question.",
      "sources": [
        {
          "firm_name": "Example Advisers LLC",
          "crd_number": "123456",
          "city": "San Francisco",
          "state": "CA",
          "aum": 5000000000
        }
      ]
    }
    ```
*   **Example Queries to Support:**
    *   `"Show me investment advisers in New York."`
    *   `"What are the largest firms in Texas by AUM?"`
    *   `"Find RIAs with more than 100 employees."`
*   **Agent Expectation:** You should build a UI that allows users to type a question into a search box, send it to this endpoint, and then display the `answer` prominently. The `sources` array should be used to show a list of the RIA profiles that the AI used to generate the answer, which adds credibility and allows users to explore the data further.

#### **Supporting Endpoints:**

*   `/api/ria-hunter-waitlist`:
    *   **Method:** `POST`
    - **Purpose**: A standard endpoint for capturing user information (email, name, etc.) for a waitlist.
*   `/api/save-form-data`:
    *   **Method:** `POST`
    - **Purpose**: A generic endpoint for saving data from a contact form.

### 3. Key Data Model: `RIAProfile`

When you receive data from the `/api/ask` endpoint, the `sources` will be partial representations of the main data object, `RIAProfile`. Understanding this model is key.

```typescript
export interface RIAProfile {
  id: string;             // UUID
  firm_name: string;
  crd_number: string;       // Central Registration Depository number
  sec_number?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone?: string;
  website?: string;
  aum?: number;             // Assets Under Management
  employee_count?: number;
  created_at: string;
  updated_at: string;
  narrative_embedding?: number[]; // For internal semantic search
}
```

### 4. Backend Architecture & Standards

*   **Project Structure:** The project is organized logically.
    *   `app/api/`: Contains all API route handlers.
    *   `src/docai/`: Holds the complex data ingestion pipeline. **You will not need to interact with this.** It runs in the background to populate the database.
    *   `src/lib/mapping/`: Contains business logic for standardizing field names from source documents.
    *   `scripts/`: Contains utility scripts, most notably `embed_narratives.ts` for enabling semantic search.
    *   `lib/`: Shared utilities, including the `supabaseClient.ts`.
*   **Coding Standards:**
    *   The entire codebase is strictly typed using **TypeScript**.
    *   It uses modern JavaScript features like `async/await`.
    *   Configuration is managed through environment variables (see `env.example`).
    *   Code is well-documented with JSDoc comments explaining the purpose of functions and modules.

### 5. Important Context for the `ria-hunter-app` Agent

1.  **Trust the Backend:** The backend is designed to be the single source of truth. You do not need to implement any data processing, cleaning, or AI logic in the frontend application. Your role is to build a beautiful and intuitive user interface that makes it easy for users to ask questions and understand the answers.

2.  **Focus on the `/api/ask` Endpoint:** This is the star of the show. The primary user experience of the `ria-hunter-app` will revolve around interacting with this endpoint.

3.  **Displaying Sources is Crucial:** Do not just display the `answer` from the API. The `sources` provide transparency and are a key part of the user experience. You should render them as a list of cards or table rows, allowing users to see which firms the AI's answer was based on.

4.  **No Direct Database Access:** The `ria-hunter-app` should **never** connect directly to the Supabase database. All data access must go through the provided API endpoints. This ensures security and separation of concerns.

5.  **Environment Variables:** The frontend application will likely need its own environment variables to point to the deployed `RIA-Hunter` backend API URL.

By adhering to this guide, you will be well-equipped to build a powerful and effective frontend application that leverages the full capabilities of the `RIA-Hunter` backend.

