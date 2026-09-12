# Deployment Guide — ForestGuard (Vercel + Render)

Two-tier deployment: the **Next.js frontend** runs on **Vercel** and the
**FastAPI/ML backend** runs on **Render**. The frontend proxies every `/api/*`
and `/health` request to the Render service through a Next.js rewrite, so the
browser only ever talks to your Vercel domain (no CORS issues — the backend
also allows all origins as a fallback).

```
browser ──> Vercel (Next.js SPA) ──rewrite /api/* & /health──> Render (FastAPI :$PORT)
                                                                 │
                                                     SQLite + joblib artefacts
                                                     shipped in the repo (fast boot)
```

## What is already prepared in the repo

| File | Purpose |
|---|---|
| `requirements.txt` | Pinned Python deps for the backend |
| `render.yaml` | Render blueprint (backend web service) |
| `vercel.json` | Vercel build config (Bun) |
| `next.config.ts` | `/api/*` + `/health` rewrites driven by `BACKEND_URL` |
| `dataset/`, `server/database/forestguard.db`, `server/models/` | data + trained models committed so boot is instant (no retrain on cold start) |

## 1. Backend — Render

**Option A — render.yaml (auto)**
1. Push this repo to GitHub.
2. Render Dashboard → **New → Blueprint** → select the repo (Render detects
   `render.yaml`) → **Apply**. That creates the web service with the correct
   build/start commands.

**Option B — dashboard (manual)**
1. **New → Web Service** → connect the repo.
2. *Runtime:* `Python 3` · *Build command:* `pip install -r requirements.txt`
3. *Start command:* `uvicorn server.app:app --host 0.0.0.0 --port $PORT`
4. *Health check path:* `/health`
5. *Instance type:* Free is fine.

Backend URL will be `https://forestguard-backend.onrender.com`.

> Note: Render's free plan has ephemeral disk. Because the repo ships the
> SQLite DB and joblib models, every cold start boots instantly. If you ever
> delete those files, the backend re-seeds and retrains automatically on
> startup (~2.5 min).

## 2. Frontend — Vercel

1. Vercel → **Add New Project** → import the same repo.
2. Vercel auto-detects the Next.js framework and `bun.lock` (Bun is
   supported; `vercel.json` pins `installCommand: bun install`).
3. Add the environment variable:

   ```
   BACKEND_URL = https://forestguard-backend.onrender.com
   ```

   (Build-time and preview/production environments — the rewrite target is
   baked in at build time.)
4. **Deploy.** The `build` script (`next build` + standalone copy) runs with
   `typescript.ignoreBuildErrors` already enabled.

Your app is live at `https://<project>.vercel.app`.

## 3. Verify the wiring

```bash
# backend itself
curl -s https://forestguard-backend.onrender.com/health
# -> {"status":"ok","service":"forestguard-ai",...,"models_trained":true,...}

# through the Vercel frontend proxy
curl -s https://<project>.vercel.app/health
curl -s https://<project>.vercel.app/api/dataset/info
```

Then open the deployed site and try **Model Prediction** (rf_top13 sends
exactly 13 features) to confirm end-to-end inference.

## 4. Local development is unchanged

Without `BACKEND_URL`, `next.config.ts` falls back to
`http://127.0.0.1:3010`, so:

```bash
python3 -m uvicorn server.app:app --host 0.0.0.0 --port 3010   # backend
bun run dev                                                    # frontend :3000
```