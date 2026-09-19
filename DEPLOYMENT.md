# Deployment guide

This repository is set up for a split deployment:

- Backend API: Render / Docker / any FastAPI host
- Frontend app: Vercel / any static host with SPA rewrites
- Database: Supabase Postgres in production

This project is compatible with PostgreSQL and works with Supabase because the backend uses SQLModel + SQLAlchemy with a standard Postgres connection string.

## 1) GitHub push

Push the repository to GitHub without committing any real secrets.

Keep all runtime secrets in the host platform environment variables, not in committed files.

## 2) Supabase database setup

Use a Supabase Postgres database for production.

### Supabase connection string format

Use the connection string from Supabase project settings:

```env
DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require
```

If you are using the SQLAlchemy async/psycopg pattern from Supabase docs, the same value also works for this project as a standard Postgres URL.

For this app, the important part is that it must be a real PostgreSQL URL, not SQLite.

### Why this matches the project

The backend uses SQLModel + SQLAlchemy and supports production Postgres directly through `DATABASE_URL`.

- Local dev default: SQLite
- Production default choice: Postgres
- Supabase-compatible format: yes

## 3) Backend on Render

Use the backend folder as the service root if deploying from this repo layout.

### Build command

```bash
pip install -r requirements.txt
```

### Start command

```bash
uvicorn app.main:app --host 0.0.0.0 --port 10000
```

### Health check

```text
/health
```

### Required environment variables

Set these in Render's Environment tab:

```env
DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480

PUBLIC_BASE_URL=https://your-api-domain.onrender.com
CORS_ORIGINS=https://your-frontend-domain.vercel.app

ADMIN_EMAIL=manager@example.com
ADMIN_PASSWORD=StrongPassword123!
ADMIN_NAME=Property Manager

STORAGE_BACKEND=local
STORAGE_LOCAL_DIR=./storage_data

EMAIL_BACKEND=log
MAIL_FROM=noreply@example.com
MAIL_FROM_NAME=Maintenance Work Orders

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_STARTTLS=true

SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

ENABLE_TEST_UI=false
```

### Render notes

- `PUBLIC_BASE_URL` must be your deployed Render API URL.
- `CORS_ORIGINS` must be your deployed Vercel frontend origin exactly.
- `ENABLE_TEST_UI` should always be `false` in production.

## 4) Frontend on Vercel

Import the frontend folder as the app root in Vercel.

### Required environment variables

Set this in Vercel:

```env
VITE_API_BASE_URL=https://your-api-domain.onrender.com
```

### SPA routing

The project includes a Vercel rewrite file so routes resolve correctly:

- `/login`
- `/dashboard`
- `/work-orders/new`
- `/wo/:token`

## 5) Production CORS rules

The backend must allow only your Vercel origin explicitly:

- Good: `https://your-frontend-domain.vercel.app`
- Bad: `*`

This is required because the frontend sends the manager JWT in the `Authorization` header.

## 6) Local development

Use the example files as templates:

- backend: [backend/.env.example](backend/.env.example)
- frontend: [frontend/.env.example](frontend/.env.example)

Do not commit `.env` files.

## 7) Supabase-specific example values

A realistic production example looks like this:

### Render backend env

```env
DATABASE_URL=postgresql://postgres:MyStrongPassword123@db.abcxyz123456.supabase.co:5432/postgres?sslmode=require
JWT_SECRET=8d1a0d4f8e8f4d42aee7b8663b106ca9f6ef3d68d9c5a9a97ad9ab5180d92f1
PUBLIC_BASE_URL=https://maint-backend.onrender.com
CORS_ORIGINS=https://maint-frontend.vercel.app
ADMIN_EMAIL=manager@example.com
ADMIN_PASSWORD=StrongPassword123!
ENABLE_TEST_UI=false
```

### Vercel frontend env

```env
VITE_API_BASE_URL=https://maint-backend.onrender.com
```

## 8) Recommended deployment order

1. Create the Supabase Postgres database.
2. Copy the Supabase connection string.
3. Deploy the backend to Render.
4. Set `DATABASE_URL`, `PUBLIC_BASE_URL`, and `CORS_ORIGINS`.
5. Confirm `/health` returns success.
6. Deploy the frontend to Vercel.
7. Set `VITE_API_BASE_URL`.
8. Confirm login, dashboard, and worker links work.
9. Confirm no CORS errors appear in the browser console.

## 9) Security reminder

Do not commit:

- real DB passwords
- JWT secrets
- SMTP passwords
- S3 keys
- Twilio tokens
- SendGrid keys

Use Render and Vercel environment variables only.
