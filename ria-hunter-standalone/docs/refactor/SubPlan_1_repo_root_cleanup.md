# SP‑1 – Repository Root Cleanup

*(GitHub repo: ****Turnstyle/ria-hunter-app**** | Username: ****Turnstyle****)*

## Goal

Flatten the project hierarchy by moving all code from `ria-hunter-standalone/` to the repository root, remove the obsolete `AppFoundation/` directory, lift configuration files one level up, and ensure Vercel builds successfully from the root.

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
3. **File Edits** – Use Cursor editor. For environment files:
   ```powershell
   echo "KEY=VALUE" >> .env.local
   ```
4. **Plan Updates** – Before every commit, add a brief note in the **Status** section at the bottom of this file.

### Tool Usage

- **GitHub Multi‑Commit PR (MCP)** preferred.
  1. If MCP fails, read error & adjust.
  2. If MCP fails again, use raw `git` commands (`git add`, `git commit`, `git push`).
  3. If a command hangs, notify user and wait.
- **Browser MCP** – Only for quick documentation searches if needed.

---

## Detailed Task Breakdown

1. **Create work branch**
   ```powershell
   git checkout -b refactor/root-cleanup
   ```
2. **Move source code**
   - Drag all content of `ria-hunter-standalone/` to repo root.
   - Overwrite root `.gitignore`, `package.json`, etc., with versions from `ria-hunter-standalone/` if newer.
3. **Delete obsolete folders**
   - Remove `AppFoundation/` entirely.
   - Remove now‑empty `ria-hunter-standalone/`.
4. **Fix path references**
   - Update `tsconfig.json` `{ "compilerOptions": { "baseUrl": "." } }` if relative paths changed.
   - Edit any import aliases in source (use Cursor global find‑replace if needed).
   - Update `next.config.js` `output: 'standalone'` path if present.
5. **Adjust scripts** in `package.json` (if they reference sub‑folders, change to root paths).
6. **Run local build**
   ```powershell
   npm install
   npm run build
   ```
   Confirm Next.js builds without errors.
7. **Commit changes**
   ```powershell
   git add .
   git commit -m "chore: flatten repo root and remove legacy folders"
   git push --set-upstream origin refactor/root-cleanup
   ```
8. **Open PR** via MCP for review and merge.

---

## Troubleshooting Guide

| Symptom                     | Cause                    | Fix                                                             |
| --------------------------- | ------------------------ | --------------------------------------------------------------- |
| `Cannot find module` errors | Import paths broken      | Run global find‑replace or update `tsconfig.paths`              |
| Vercel build fails          | Wrong project root       | In Vercel dashboard, set **Root Directory** to `/` and Redeploy |
| Missing env vars locally    | `.env.local` not at root | Move/rename `.env.local` to repo root                           |
| Assets 404 after deploy     | `public/` path moved     | Ensure `public/` resides at root                                |

---

## Documentation Links

- **Next.js Configuration** – [https://nextjs.org/docs](https://nextjs.org/docs)
- **Vercel Project Root Setting** – [https://vercel.com/docs/project-configuration](https://vercel.com/docs/project-configuration)

---

## Status

*(Add progress notes here before each commit)*

