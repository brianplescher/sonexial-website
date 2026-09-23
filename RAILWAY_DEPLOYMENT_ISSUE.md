# Railway Deployment — Diagnosis & Fix Plan

**Date:** 2026-09-24
**Status:** ⚠️ Deployed, but the wrong app is running + required env vars are missing.

---

## What I Found

### 1. Two different backends exist in this project

| | `agent/` (JavaScript) | `sonexial/` (Python FastAPI) |
|---|---|---|
| Language | Node / Express | Python 3.12 / FastAPI |
| On GitHub (`origin/main`) | ✅ Yes | ❌ **No — never pushed** |
| LLM provider | **Anthropic Claude** ⛔ | Qwen via Together AI ✅ |
| Database | SQLite (ephemeral on Railway) | PostgreSQL ✅ |
| Dockerfile | ❌ None | ✅ Yes (`sonexial/Dockerfile`) |
| Health endpoint | `/api/health` | `/health` |

The brief explicitly **rejects Anthropic models** and requires **Qwen via Together AI**.
Only the Python `sonexial/` backend meets the spec — and it is not on GitHub yet.

### 2. Railway is currently serving the STATIC WEBSITE, not any API

I tested the live URL:

```
GET https://sonexial-website-production.up.railway.app/health      → 404 "Dead Signal" HTML page
GET https://sonexial-website-production.up.railway.app/api/health  → 404 "Dead Signal" HTML page
GET https://sonexial.com/api/health                                → proxied to Railway → same 404
```

The `404.html` page from the website repo is being served, which means Railway built
the repo as a static site (or ran the wrong start command). No Node or Python process
is actually answering requests.

**Likely cause:** The service was created from the repo root with no builder override.
Railway's static detection picked up the plain HTML/CSS/JS files at the repo root.

### 3. Your variables don't match either backend

You said you added **Together AI + Resend keys**. But the code currently on GitHub
(`agent/.env.example`) expects:

```
ANTHROPIC_API_KEY=...        ← you did NOT add this (and per the brief, you shouldn't)
RESEND_API_KEY=...           ← ✅ you have this
OWNER_EMAIL=...              ← ❓ check
ADMIN_TOKEN=...              ← ❓ check
NETLIFY_WEBHOOK_SECRET=...   ← ❓ check
```

The Python backend instead needs:

```
DATABASE_URL, SECRET_KEY, OPS_BEARER_TOKEN, TOGETHER_API_KEY, RESEND_API_KEY,
OPERATOR_EMAIL, SUPPORT_EMAIL, QWEN_PITCH_MODEL, QWEN_CONTENT_MODEL, ...
```

So even if the right process were running, it would crash on missing config.

---

## Recommended Fix (Option A — matches the project brief)

Deploy the **Python FastAPI backend** (`sonexial/`) to Railway. It uses Qwen/Together AI
(your keys), Postgres (Railway plugin), and satisfies all constraints.

### Step 1 — Push the sonexial/ folder to GitHub
It exists locally but was never pushed. (Run from your machine where git auth works:)
```bash
cd <your local copy>/workspace
git push origin main
```

### Step 2 — Point Railway at the right subdirectory
In Railway dashboard → your service → **Settings → Build**:
- **Root Directory:** `sonexial`
- **Builder:** `Dockerfile` (it will auto-detect `sonexial/Dockerfile`)
- Start command comes from the Dockerfile: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

### Step 3 — Add a Postgres database
Project → New → Database → PostgreSQL. Railway injects `DATABASE_URL` automatically.
(If it gives `postgres://`, change it to `postgresql+asyncpg://` in the variable value.)

### Step 4 — Set variables (Variables tab, one at a time)
```
APP_ENV=production
APP_BASE_URL=https://sonexial-website-production.up.railway.app
SECRET_KEY=<openssl rand -hex 32>
OPS_BEARER_TOKEN=<openssl rand -hex 32>
TOGETHER_API_KEY=<your key>          ← already added ✅
RESEND_API_KEY=<your key>            ← already added ✅
OPERATOR_EMAIL=brian@sonexial.com
SUPPORT_EMAIL=support@sonexial.com
QWEN_PITCH_MODEL=Qwen/Qwen2.5-72B-Instruct-Turbo
QWEN_CONTENT_MODEL=Qwen/Qwen2.5-Coder-32B-Instruct
SCANNER_PUBLIC=true
LLM_MONTHLY_BUDGET_USD=15
STORAGE_BACKEND=local
LOCAL_STORAGE_DIR=/tmp/storage
```
(Stripe/GitHub/Netlify vars can be left blank for now — the app warns but doesn't fail.)

### Step 5 — Redeploy and verify
```bash
curl https://sonexial-website-production.up.railway.app/health
# expect: {"status":"healthy", ...}
```

### Step 6 — Confirm Netlify proxy still works
```bash
curl https://sonexial.com/api/health
```
(The `_redirects` rule already proxies `/api/*` → Railway `/api/:splat`. NOTE: the
Python backend serves `/health`, not `/api/health` — either add an `/api` prefix in
FastAPI later, or update `_redirects` to `https://...railway.app/:splat 200` for a
dedicated API path. We can adjust once the backend is green.)

---

## Option B — Quick & dirty (NOT recommended)

Keep the existing JS `agent/` service but fix its build: set Root Directory to `agent`,
add a `Procfile` or start command `node src/index.js`, and supply `ANTHROPIC_API_KEY`.
This would work in ~15 minutes but violates the brief (no Anthropic, no SQLite persistence,
no job queue, no scanner rubric). Only choose this as a temporary stopgap.

---

## Open Questions for Operator
1. Which option do you want? (A = spec-compliant Python; B = stopgap JS)
2. Can you run `git push origin main` from your laptop? The `sonexial/` backend only
   exists in my local workspace until that happens.
3. Please paste the actual Railway **Deploy Logs** error so I can confirm the exact
   failure (my diagnosis is based on probing the live URL).
