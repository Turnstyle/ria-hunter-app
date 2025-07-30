# SP‑3 – Environment & Deploy Automation

*(GitHub repo: ****Turnstyle/ria-hunter-app**** | Username: ****Turnstyle****)*

## Goal

Configure environment variables, project scripts, and Vercel settings so Continuous Integration (CI) and Continuous Deployment/Delivery (CD) run without manual fixes.

---

## AI Agent Instructions

### Environment

| Item           | Setting                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------- |
| **IDE**        | Cursor                                                                                   |
| **Terminal**   | Windows PowerShell                                                                       |
| **Assumption** | Nothing is installed. Verify with: `python --version`, `node --version`, `git --version` |

### Execution Instructions

1. **Autonomy** – Act independently; ask only if blocked or secrets are missing.
2. **Commands** – Execute each PowerShell command separately (no `&&` or `;`).
3. **File Edits** – Use Cursor editor. For env files:
   ```powershell
   echo "KEY=VALUE" >> .env.local
   ```
4. **Plan Updates** – Log progress in **Status** before each commit.

### Tool Usage

- **GitHub Multi‑Commit PR (MCP)** preferred; fall back to raw `git` on repeated failure.
- **Browser MCP** only for quick doc look‑ups.

---

## Detailed Task Breakdown

1. **Create work branch**
   ```powershell
   git checkout -b chore/env-and-deploy
   ```
2. **Add sample env files**
   - Create `.env.example` with required keys:
     ```env
     NEXT_PUBLIC_API_URL=https://ria-hunter.vercel.app
     ```
   - Ensure `.env.local` is git‑ignored but added locally with same keys.
3. **Update **``** scripts**
   ```jsonc
   {
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start",
       "lint": "next lint"
     }
   }
   ```
4. **Create **`` at repo root:
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": ".next",
     "framework": "nextjs"
   }
   ```
5. **Set project root in Vercel**
   - Run:
     ```powershell
     npx vercel link --prod
     ```
   - Choose current directory as root.
6. **Add GitHub → Vercel integration instructions** in `README.md` (CI/CD checkbox, auto‑deploy on push to `main`).
7. **Local verification**
   ```powershell
   npm install
   npm run build
   ```
   Confirm build completes with no missing env vars.
8. **Commit & Push**
   ```powershell
   git add .
   git commit -m "chore: env setup and vercel config for CI/CD"
   git push --set-upstream origin chore/env-and-deploy
   ```
9. **Open PR** via MCP for review and merge.

---

## Troubleshooting Guide

| Symptom                                               | Cause                       | Fix                                                                  |
| ----------------------------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` undefined at runtime            | Env vars missing on Vercel  | Add same vars in Vercel dashboard > Settings > Environment Variables |
| Vercel build fails with no output dir                 | Wrong `vercel.json` path    | Ensure file is at repo root with correct casing                      |
| GitHub push triggers but Vercel shows “No Build Step” | Vercel project root mis‑set | In Vercel settings, set Root Directory to `/`                        |
| Local `npm run build` fails                           | Missing dependencies        | `npm install` then retry                                             |

---

## Documentation Links

- **Vercel Project Configuration** – [https://vercel.com/docs/project-configuration](https://vercel.com/docs/project-configuration)
- **Next.js Deployment** – [https://nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)
- **Environment Variables on Vercel** – [https://vercel.com/docs/environment-variables](https://vercel.com/docs/environment-variables)

---

## Status

*(Add progress notes here before each commit)*

