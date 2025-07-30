# SP‑2 – Smart Search UI Integration

*(GitHub repo: ****Turnstyle/ria-hunter-app**** | Username: ****Turnstyle****)*

## Goal

Add a search bar that sends queries to the backend `/api/ask` endpoint, display results with an AI‑generated summary card, and ensure a smooth loading state.

---

## AI Agent Instructions

### Environment

| Item           | Setting                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| **IDE**        | Cursor                                                                                  |
| **Terminal**   | Windows PowerShell                                                                      |
| **Assumption** | Nothing is installed. Verify with:`python --version`, `node --version`, `git --version` |

### Execution Instructions

1. **Autonomy** – Act independently; ask only if blocked or secrets are missing.
2. **Commands** – Run each PowerShell command separately (no `&&` or `;`).
3. **File Edits** – Use Cursor editor. For env files:
   ```powershell
   echo "NEXT_PUBLIC_API_URL=https://ria-hunter.vercel.app" >> .env.local
   ```
4. **Plan Updates** – Before each commit, record a brief progress note in **Status** at the bottom of this file.

### Tool Usage

- **GitHub Multi‑Commit PR (MCP)** preferred; follow fallback steps on error.
- **Browser MCP** only for quick documentation searches.

---

## Detailed Task Breakdown

1. **Create work branch**
   ```powershell
   git checkout -b feature/smart-search-ui
   ```
2. **Add Search Bar component** `components/SearchBar.tsx`
   ```tsx
   import { useState } from 'react';

   export default function SearchBar({ onResult }: { onResult: (r:any)=>void }) {
     const [q, setQ] = useState('');
     const [loading, setLoading] = useState(false);

     const ask = async () => {
       if (!q) return;
       setLoading(true);
       try {
         const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ask`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ query: q }),
         });
         const data = await res.json();
         onResult(data);
       } finally {
         setLoading(false);
       }
     };

     return (
       <div className="flex gap-2">
         <input
           value={q}
           onChange={e => setQ(e.target.value)}
           placeholder="Ask about RIAs…"
           className="flex-1 border p-2 rounded"
         />
         <button onClick={ask} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
           {loading ? '...' : 'Search'}
         </button>
       </div>
     );
   }
   ```
3. **Add Results Card component** `components/ResultCard.tsx`
   ```tsx
   export default function ResultCard({ answer, sources }: { answer:string; sources:any[] }) {
     return (
       <div className="border p-4 rounded shadow gap-2 flex flex-col">
         <p>{answer}</p>
         <details>
           <summary className="cursor-pointer text-sm text-gray-500">Sources</summary>
           <ul className="list-disc ml-4 text-sm">
             {sources.map((s,i)=>(<li key={i}>{s}</li>))}
           </ul>
         </details>
       </div>
     );
   }
   ```
4. **Wire components into page** `pages/index.tsx`
   ```tsx
   import { useState } from 'react';
   import SearchBar from '../components/SearchBar';
   import ResultCard from '../components/ResultCard';

   export default function Home() {
     const [result, setResult] = useState<any|null>(null);
     return (
       <main className="max-w-2xl mx-auto p-8 flex flex-col gap-4">
         <h1 className="text-2xl font-bold">RIA Hunter</h1>
         <SearchBar onResult={setResult} />
         {result && <ResultCard answer={result.answer} sources={result.sources} />}
       </main>
     );
   }
   ```
5. **Install Tailwind (if missing)**
   ```powershell
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
   Configure `tailwind.config.js` `content` paths to include `./pages/**/*.{js,ts,jsx,tsx}`, `./components/**/*.{js,ts,jsx,tsx}`.
6. **Local test**
   ```powershell
   npm run dev
   ```
   Verify search UI appears and returns data from backend.
7. **Commit**
   ```powershell
   git add .
   git commit -m "feat: smart search UI with AI result card"
   git push --set-upstream origin feature/smart-search-ui
   ```
8. **Open PR** via MCP for review.

---

## Troubleshooting Guide

| Symptom                 | Cause                   | Fix                                                                   |
| ----------------------- | ----------------------- | --------------------------------------------------------------------- |
| 404 from `/api/ask`     | Wrong API URL           | Check `NEXT_PUBLIC_API_URL` in `.env.local`                           |
| CORS error              | Backend missing headers | Add `Access-Control-Allow-Origin` in backend or proxy through Next.js |
| Tailwind styles missing | Config paths wrong      | Update `tailwind.config.js` `content` array                           |
| Build fails on Vercel   | Env var not set         | Add same `NEXT_PUBLIC_API_URL` in Vercel dashboard                    |

---

## Documentation Links

- **Next.js API Routes** – [https://nextjs.org/docs/api-routes/introduction](https://nextjs.org/docs/api-routes/introduction)
- **Tailwind CSS Quickstart** – [https://tailwindcss.com/docs/installation](https://tailwindcss.com/docs/installation)
- **Fetch API** – [https://developer.mozilla.org/en-US/docs/Web/API/Fetch\_API/Using\_Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

---

## Status

*(Add progress notes here before each commit)*

**✅ COMPLETED - July 30, 2025**
- Successfully implemented smart search UI with AI-powered results
- Modified existing SearchForm component to use natural language queries
- Created /api/ask endpoint that bridges to match-thesis API
- Updated SearchResults component to display AI-generated answers with sources
- Configured Tailwind CSS with proper content paths
- Added environment variable configuration
- All tests pass, no linting errors
- Pull request created: [PR #2](https://github.com/Turnstyle/ria-hunter-app/pull/2)
- Ready for SubPlan_3 implementation

