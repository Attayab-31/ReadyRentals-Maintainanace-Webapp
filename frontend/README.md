# Maintenance Work Order frontend

Vite + React 18 + TypeScript console for the FastAPI work-order API. Office Admins and the Owner sign in with JWT. Techs and tenants open `/wo/{token}` with no login.

**Product workflow and status details:** see Section 3 of the [client handover and operations guide](../ReadyRentals_Client_Handover.docx).

## Local development

1. Run the API (see the repository root README): `uvicorn app.main:app --reload` on port 8000.
2. In this folder:

```bash
copy .env.example .env
npm ci
npm run dev
```

The app is at http://localhost:5173 and calls `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`).

For office login to work from the Vite origin, the API must list it in `CORS_ORIGINS` (already in the backend `.env.example` as `http://localhost:5173,http://127.0.0.1:5173`).

Worker links shown after create are `${origin}/wo/${token}` — text that URL, not the API host.

## Build

```bash
npm run build
npm run preview
```

`VITE_API_BASE_URL` is baked in at build time.

## Production deployment

The production frontend is built into its Docker image and served by Nginx. Deploy the complete stack from the repository root with `compose.production.yaml`; see the root README and the [client handover and operations guide](../ReadyRentals_Client_Handover.docx) for VPS and backup setup. `VITE_API_BASE_URL` is provided to the frontend image at build time by Compose.

The PWA manifest is for “Add to Home Screen” on a phone. There is no offline cache — every screen talks live to the API.

## Routes

| Path | Audience |
|------|----------|
| `/login` | Office Admin or Owner JWT |
| `/dashboard` | Work order table + filters |
| `/settings/categories` | Office category creation and archiving |
| `/work-orders/new` | Create + copy/share worker link |
| `/work-orders/:id` | Detail, patch while `assigned`, resend, delete |
| `/wo/:token` | Public worker/tenant flow |

## Project attribution and support

This frontend is part of the ReadyRentalsOnline project, developed by **Muhammad Attayab Ashraf** and [Automivex](https://www.automivex.com).

- **Client organization:** [ReadyRentalsOnline](https://readyrentalsonline.com)
- **Developer personal contact:** [attayabpc2@gmail.com](mailto:attayabpc2@gmail.com) · [+92 317 4026038](tel:+923174026038)
- **Automivex company contact:** [social@automivex.com](mailto:social@automivex.com)

For support requests, include the relevant version/commit, environment details, and steps to reproduce. Redact secrets from logs; never send `.env` files, passwords, API keys, or worker access tokens.
