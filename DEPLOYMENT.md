# Deploying EthioLex

**Architecture:** Frontend (Vite/React) on **Vercel** · Backend (FastAPI) on **Render**.
The frontend calls a relative `/api`, and Vercel proxies `/api/*` to the Render
backend server-side (see `vercel.json`). Because the browser only ever talks to
your Vercel domain, **no CORS or CSP changes are needed**.

Deploy the **backend first** (you need its URL for the frontend).

---

## 1. Backend → Render

1. Push this repo to GitHub (Render deploys from GitHub).
2. Render → **New +** → **Blueprint** → pick `Solomonaz/Ethio_digital_lawyer`.
   It reads `render.yaml` and creates the `ethiolex-backend` web service
   (root `backend`, `uvicorn main:app`).
   *Or* create a **Web Service** manually: Root Directory `backend`,
   Build `pip install -r requirements.txt`, Start `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. In the service's **Environment** tab, set these (copy the values from your
   local `backend/.env`):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql://...@db.<ref>.supabase.co:5432/postgres?sslmode=require` |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | your anon key |
   | `GEMINI_API_KEY` | your Gemini key |
   | `SECRET_KEY` | any long random string |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | your admin login |
   | `CHAPA_SECRET_KEY` / `CHAPA_WEBHOOK_SECRET` | only if you use Chapa |

4. Deploy. When it's live, copy the URL, e.g. `https://ethiolex-backend.onrender.com`.
5. Sanity check: open `https://<your-backend>.onrender.com/` — you should get a JSON response.

---

## 2. Point the frontend at the backend

Edit **`vercel.json`** and replace the host in the `/api` rewrite with YOUR Render URL:

```json
{ "source": "/api/(.*)", "destination": "https://<your-backend>.onrender.com/$1" }
```

Commit & push.

---

## 3. Frontend → Vercel

1. Vercel → **New Project** → import `Solomonaz/Ethio_digital_lawyer`.
2. **Application/Framework Preset:** choose **Vite** (NOT the multi-service
   "Services" preset — you're only deploying the frontend here). Root Directory: `./`.
3. **Environment Variables** (Production) — from your local root `.env`:

   | Key | Value |
   |-----|-------|
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your anon key |

   > Do **not** set `VITE_API_URL` — it defaults to `/api`, which the proxy handles.
4. **Deploy.**

---

## 4. Test

- Open the Vercel URL → the landing page loads.
- Sign up / log in (talks to Supabase directly).
- Send a chat message (goes `/api` → Vercel → Render → Gemini).

---

## Notes / caveats

- **Render free tier spins down after ~15 min idle.** The first request after
  idle takes ~30–60s to wake the server (cold start). Fine for testing; upgrade
  the Render plan to keep it always-on.
- **Uploaded receipts** are stored on the backend's local disk, which on Render's
  free tier is **ephemeral** (reset on redeploy/restart). For durable receipts,
  add a Render **persistent disk** (paid) mounted at `backend/uploads`, or move
  storage to **Supabase Storage** later. Everything else persists in Postgres.
- **Supabase pooler:** on a persistent server (Render) the direct `:5432` URL with
  connection pooling is fine. (Only serverless deploys need the `:6543` pooler.)
