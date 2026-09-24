# Maintenance Work Order API

FastAPI backend that replaces the paper property-maintenance work order. Office Admins and the Owner authenticate with JWT. Field techs and tenants use a **capability token** embedded in a shareable `/wo/{token}` link (no account). After both signatures the API generates a WeasyPrint PDF that mirrors the paper form and emails it to the appropriate office recipient.

## Project tree

```
.
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/001_initial.py      # schema + 7 default categories + SLA priorities
├── alembic.ini
├── app/
│   ├── main.py
│   ├── config.py
│   ├── db.py
│   ├── models.py
│   ├── schemas.py
│   ├── security.py
│   ├── seed.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── work_orders.py
│   │   ├── categories.py
│   │   └── worker.py
│   ├── services/
│   │   ├── storage.py               # local disk or S3-compatible
│   │   ├── pdf.py
│   │   ├── notifications.py         # SMTP / SendGrid / log; optional Twilio SMS
│   │   └── work_orders.py
│   └── templates/
│       ├── work_order.html
│       └── work_order.css
├── tests/
│   ├── conftest.py                  # SQLite in-memory
│   ├── test_auth.py
│   └── test_lifecycle.py
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt
├── pyproject.toml
└── .env.example
```

The production Compose stack and its environment template live at the repository root. Run `docker compose` from that root, not from `backend/`.

## SLA priorities (lookup table, not hardcoded)

| code       | hour_target |
|------------|-------------|
| emergency  | 4           |
| urgent     | 24          |
| standard   | 72          |

`duration_minutes` = `end_time - start_time`. `within_target` is true when duration ≤ `hour_target * 60`.

Default checklist categories: Interior Surfaces, Exterior Roof, Mechanical Equipment, Concrete Components, Handrails/Guardrails, Tub/Plumbing, Other.

## Status lifecycle

`assigned` → `/start` → `in_progress` → `/complete` → `completed_pending_signoff` (or `incomplete_needs_return` if any item is unresolved or a return date / explanation is provided) → both `/sign` calls → `signed_off` (PDF + email).

Rules:

- `/start` only from `assigned` (cannot start twice)
- `/complete` only from `in_progress`
- `/sign` only after complete; each signer (tenant, tech) exactly once
- Writes lock after `signed_off`; the worker token remains valid for read/reprint

## Local development

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env   # Unix: cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

WeasyPrint needs Pango/Cairo. On Debian/Ubuntu they are installed in the Docker image. On Windows, prefer Docker for PDF generation; tests mock PDF bytes so `pytest` does not require system libraries.

For local Windows development without Docker, install the GTK3 x64 runtime
required by WeasyPrint, then restart every Uvicorn process:

```powershell
winget install --id tschoonj.GTKForWindows --source winget
```

The runtime provides `libgobject-2.0-0.dll`. A quick verification is:

```powershell
.\.venv\Scripts\python.exe -c "from weasyprint import HTML; print(len(HTML(string='<p>ok</p>').write_pdf()))"
```

OpenAPI: http://localhost:8000/docs

## React frontend

The production UI lives in `frontend/` (Vite + React). The production Docker stack puts the UI and API behind Caddy on separate subdomains.

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

- UI: http://localhost:5173
- API: `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`)
- Office account JWT login: `/login` -> `/dashboard`
- Worker/tenant: `/wo/{token}` (no `Authorization` header; the URL token is the capability)

**CORS:** FastAPI `CORS_ORIGINS` must list the frontend origin explicitly (`http://localhost:5173` in development). Production Compose sets the configured HTTPS app origin. Wildcard origins are not enabled.

Product workflow and status details: see Section 3 of the [client handover and operations guide](../ReadyRentals_Client_Handover.docx).

Register the Owner account once with `OWNER_CODE`. The Owner can then create office Admin accounts from the app.

## Production Docker stack

Run these commands from the repository root. Configure `.env.production` from `.env.production.example` first.

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

The stack includes Caddy, frontend, API, and PostgreSQL. Only Caddy publishes ports; PostgreSQL and the API are private Docker services. PostgreSQL and uploaded files use named persistent volumes. See the root README for deployment and the [client handover and operations guide](../ReadyRentals_Client_Handover.docx) for backup and recovery procedures.

## Tests

```bash
pytest -q
```

Uses SQLite in-memory (`StaticPool`) and covers the full status lifecycle plus auth, filters, and lock rules.

## Environment

See `.env.example`. Important variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLAlchemy URL; SQLite is for local development, production Compose uses PostgreSQL |
| `JWT_SECRET` | Office-account JWT signing key |
| `PUBLIC_BASE_URL` | Origin used in worker share links |
| `STORAGE_BACKEND` / `STORAGE_LOCAL_DIR` | Local file storage; production uses the Docker uploads volume |
| `SMTP_*` / `EMAIL_BACKEND` | Completed-PDF email; production uses SMTP |
| `OWNER_CODE` | Secret required for first owner registration |

## Curl examples

Assume the API is at `http://localhost:8000`. Register the first Owner in the React app with `OWNER_CODE`, then use that account's credentials for office API requests below.

### Health

```bash
curl -s http://localhost:8000/health
```

### Auth — `POST /auth/login`

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"YOUR_OWNER_EMAIL\",\"password\":\"YOUR_OWNER_PASSWORD\"}"
```

Export the token:

```bash
export TOKEN='<access_token>'
export AUTH="Authorization: Bearer $TOKEN"
```

### Checklist categories — `GET /checklist-categories`

```bash
curl -s http://localhost:8000/checklist-categories -H "$AUTH"
```

### Checklist categories — `POST /checklist-categories`

```bash
curl -s -X POST http://localhost:8000/checklist-categories \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"name\":\"Windows\"}"
```

### Create work order — `POST /work-orders`

Creates the WO + line items, generates `worker_access_token`, texts/logs the shareable link.

```bash
curl -s -X POST http://localhost:8000/work-orders \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{
    \"assigned_to_name\": \"Alex Tech\",
    \"assigned_to_phone\": \"+15555550100\",
    \"date_assigned\": \"2026-09-17\",
    \"service_address\": \"101 Maple St, Springfield\",
    \"tenant_names\": \"Jamie Tenant\",
    \"tenant_phone\": \"+15555550200\",
    \"priority\": \"urgent\",
    \"service_date\": \"2026-09-17\",
    \"items\": [
      {\"category\": \"Interior Surfaces\", \"details\": \"Patch living room wall\"},
      {\"category\": \"Tub/Plumbing\", \"details\": \"Replace tub caulk\"}
    ]
  }"
```

```bash
export WO_ID='<id>'
export WO_TOKEN='<worker_access_token>'
```

The shareable worker link is `http://localhost:8000/wo/$WO_TOKEN`.

### List / filter — `GET /work-orders`

```bash
curl -s "http://localhost:8000/work-orders" -H "$AUTH"

curl -s "http://localhost:8000/work-orders?status=assigned&address=Maple" -H "$AUTH"

curl -s "http://localhost:8000/work-orders?overdue=true" -H "$AUTH"

curl -s "http://localhost:8000/work-orders?date_from=2026-09-01&date_to=2026-09-30" -H "$AUTH"
```

### Get one — `GET /work-orders/{id}`

```bash
curl -s http://localhost:8000/work-orders/$WO_ID -H "$AUTH"
```

### Update (only while `assigned`) — `PATCH /work-orders/{id}`

```bash
curl -s -X PATCH http://localhost:8000/work-orders/$WO_ID \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"assigned_to_name\":\"Alexandra Tech\"}"
```

### Resend worker link — `POST /work-orders/{id}/resend`

```bash
curl -s -X POST http://localhost:8000/work-orders/$WO_ID/resend -H "$AUTH"
```

### Worker view — `GET /wo/{token}`

Returns only fields appropriate for the current status (no login).

```bash
curl -s http://localhost:8000/wo/$WO_TOKEN
```

### Start job — `POST /wo/{token}/start`

```bash
curl -s -X POST http://localhost:8000/wo/$WO_TOKEN/start
```

### Update a line item — `PATCH /wo/{token}/items/{item_id}`

```bash
export ITEM_ID='<item_id>'
curl -s -X PATCH http://localhost:8000/wo/$WO_TOKEN/items/$ITEM_ID \
  -H "Content-Type: application/json" \
  -d "{\"details\":\"Patched and painted\",\"resolved\":true}"
```

### Upload before/after photo — `POST /wo/{token}/items/{item_id}/photo`

```bash
curl -s -X POST "http://localhost:8000/wo/$WO_TOKEN/items/$ITEM_ID/photo?slot=before" \
  -F "file=@before.jpg"

curl -s -X POST "http://localhost:8000/wo/$WO_TOKEN/items/$ITEM_ID/photo?slot=after" \
  -F "file=@after.jpg"
```

### Complete job — `POST /wo/{token}/complete`

```bash
curl -s -X POST http://localhost:8000/wo/$WO_TOKEN/complete \
  -H "Content-Type: application/json" \
  -d "{
    \"entire_unit_inspected\": true,
    \"inspection_results\": \"Unit in good condition\",
    \"if_incomplete_explanation\": null,
    \"return_date\": null
  }"
```

### Sign (tenant then tech) — `POST /wo/{token}/sign`

`signature_png_base64` may be raw base64 or a `data:image/png;base64,...` data URL. Call once per signer. When both are present, status becomes `signed_off`, the PDF is generated, and the report is emailed to the Owner and work-order creator.

```bash
curl -s -X POST http://localhost:8000/wo/$WO_TOKEN/sign \
  -H "Content-Type: application/json" \
  -d "{\"signer\":\"tenant\",\"name\":\"Jamie Tenant\",\"signature_png_base64\":\"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==\"}"

curl -s -X POST http://localhost:8000/wo/$WO_TOKEN/sign \
  -H "Content-Type: application/json" \
  -d "{\"signer\":\"tech\",\"name\":\"Alexandra Tech\",\"signature_png_base64\":\"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==\"}"
```

### Download PDF (office account) — `GET /work-orders/{id}/pdf`

Available after `signed_off`.

```bash
curl -s -L http://localhost:8000/work-orders/$WO_ID/pdf \
  -H "$AUTH" -o work-order.pdf
```

### Download PDF (worker/tenant) — `GET /wo/{token}/pdf`

```bash
curl -s -L http://localhost:8000/wo/$WO_TOKEN/pdf -o work-order.pdf
```

### Delete — `DELETE /work-orders/{id}`

Deletes the work order at any lifecycle stage and removes its stored photos,
signatures, and PDF. The worker token then returns 404.

```bash
curl -s -X DELETE http://localhost:8000/work-orders/$WO_ID -H "$AUTH"
```

## Project attribution and support

This API is part of the ReadyRentalsOnline project, developed by **Muhammad Attayab Ashraf** and [Automivex](https://www.automivex.com).

- **Client organization:** [ReadyRentalsOnline](https://readyrentalsonline.com)
- **Developer personal contact:** [attayabpc2@gmail.com](mailto:attayabpc2@gmail.com) · [+92 317 4026038](tel:+923174026038)
- **Automivex company contact:** [social@automivex.com](mailto:social@automivex.com)

For support requests, include the relevant version/commit, environment details, and steps to reproduce. Redact secrets from logs; never send `.env` files, passwords, API keys, or worker access tokens.
