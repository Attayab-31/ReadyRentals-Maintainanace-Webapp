# Maintenance Work Order frontend

Vite + React 18 + TypeScript console for the FastAPI work-order API. Managers sign in with JWT. Techs and tenants open `/wo/{token}` with no login.

**Walkthrough of screens, buttons, and status:** [USER_FLOW.md](./USER_FLOW.md).

## Local development

1. Run the API (see the repository root README): `uvicorn app.main:app --reload` on port 8000.
2. In this folder:

```bash
copy .env.example .env
npm install
npm run dev
```

The app is at http://localhost:5173 and calls `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`).

For manager login to work from the Vite origin, the API must list it in `CORS_ORIGINS` (already in the backend `.env.example` as `http://localhost:5173,http://127.0.0.1:5173`). Set `ENABLE_TEST_UI=false` in production; that flag is only for the old same-origin HTML harness.

Worker links shown after create are `${origin}/wo/${token}` — text that URL, not the API host.

## Build

```bash
npm run build
npm run preview
```

`VITE_API_BASE_URL` is baked in at build time.

## Deploy

**Docker (nginx static files + SPA fallback):**

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.com -t wo-web .
docker run -p 8080:80 wo-web
```

**Vercel / Netlify:** import this `frontend/` directory as the project root, set `VITE_API_BASE_URL` in the host’s env vars, and use the SPA rewrite (`/*` → `/index.html`). This is a separately hosted app: the FastAPI `CORS_ORIGINS` setting **must list the real deployed frontend origin explicitly**. Do not use `*` in production (browser clients that send `Authorization` cannot rely on a wildcard origin).

The PWA manifest is for “Add to Home Screen” on a phone. There is no offline cache — every screen talks live to the API.

## Routes

| Path | Audience |
|------|----------|
| `/login` | Manager JWT |
| `/dashboard` | Work order table + filters |
| `/settings/categories` | Manager category creation and archiving |
| `/work-orders/new` | Create + copy/share worker link |
| `/work-orders/:id` | Detail, patch while `assigned`, resend, delete |
| `/wo/:token` | Public worker/tenant flow |
