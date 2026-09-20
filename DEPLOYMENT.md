# Deployment & Fresh Supabase Setup Guide

This repository is set up for a production split deployment:

- **Backend API**: Render (FastAPI + SQLModel + Alembic)
- **Frontend App**: Vercel / Netlify (React + Vite)
- **Database**: Supabase PostgreSQL

---

## 1) Supabase Fresh Start: Wiping & Resetting Database

If you want a **100% clean, fresh start** (clear all existing rows, tables, types, and old migration state):

### Option A: Complete Schema Reset (Recommended Gold Standard)
Open your **Supabase Dashboard** -> **SQL Editor** -> Click **New Query**, paste and run:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;
```

> **Why this is best practice:**
> It cleanly drops all old tables (`work_orders`, `users`, `priorities`, `alembic_version`, etc.), custom PostgreSQL enum types (`userrole`, `workorderstatus`), and stale sequences without any foreign-key dependency conflicts. Your database is now a fresh, brand-new slate.

### Option B: Clear Rows Only (Keep Schema)
If you just want to delete all work orders and users while keeping the schema:

```sql
TRUNCATE work_order_items, work_orders, users RESTART IDENTITY CASCADE;
```

---

## 2) Running Alembic Migrations (`alembic upgrade head`)

Once Supabase is fresh (or whenever schema changes are pushed):

### Method 1: Automatic on Render (Best Practice)
In your Render Service Dashboard (**Settings**):
- **Pre-Deploy Command** (recommended):
  ```bash
  alembic upgrade head
  ```
- Or prepend to your **Start Command**:
  ```bash
  alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 10000
  ```

Every time you push to GitHub, Render will automatically run the migrations before starting the API.

### Method 2: Manually from your Local Machine
You can apply migrations directly to Supabase from your local development machine:

1. In PowerShell:
   ```powershell
   cd backend
   $env:DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"
   .\.venv\Scripts\alembic.exe upgrade head
   ```
2. In Bash / Linux / macOS:
   ```bash
   cd backend
   export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"
   alembic upgrade head
   ```

Alembic will run:
1. `001_initial`: Creates base tables (`priorities`, `users`, `checklist_categories`, `work_orders`, `work_order_items`) and seeds default priorities and checklist categories.
2. `002_category_archive`: Adds `is_active` soft-archive support.
3. `8e909d2b3d6b_worker_flow_updates`: Configures PostgreSQL enums (`userrole` with `owner, admin, manager` and `workorderstatus`), indexes, and worker flow columns.

---

## 3) Owner & Admin Bootstrap Architecture

### No Users Created at Startup
- In production, **no owner or admin accounts are created automatically at server startup**.
- The database starts with 0 user accounts.

### Step 1: Owner Registration via Secret `OWNER_CODE`
1. You set a secret `OWNER_CODE` in Render environment variables (e.g. `OWNER_CODE=READY-RENTALS-OWNER-2026`).
2. The owner opens the frontend web app.
3. On the login screen, click **"Have an Owner Code? Set up master account"** (or make a `POST /auth/register-owner` call).
4. Enter:
   - Full Name
   - Email Address
   - Password
   - Secret Owner Code
5. The API verifies the `OWNER_CODE` and creates the master Owner account (`role="owner"`).
6. The owner is instantly authenticated and redirected to the dashboard.
7. *Security note:* Once an owner account is registered, the system prevents any unauthorized second owner from being created.

### Step 2: Owner Creates Admin / Manager Accounts
1. In the top navigation bar, the owner clicks **"Admins"** (`/admins`).
2. The owner can add new Admin / Property Manager accounts (Name, Email, Password).
3. The created Admins can now log in using standard sign-in (`/login`).
4. If an Admin is ever removed, the owner can delete them; their work orders are automatically reassigned to the Owner.

---

## 4) Render Backend Service Configuration

- **Root Directory**: `backend`
- **Environment**: `Python 3`
- **Build Command**:
  ```bash
  pip install -r requirements.txt
  ```
- **Pre-Deploy Command**:
  ```bash
  alembic upgrade head
  ```
- **Start Command**:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port 10000
  ```
- **Health Check Path**: `/health`

### Render Environment Variables

| Variable | Value / Description |
|---|---|
| `DATABASE_URL` | Supabase connection string: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require` |
| `OWNER_CODE` | Your secret code to claim the master owner account (e.g. `READY-RENTALS-OWNER-2026`) |
| `JWT_SECRET` | Strong random secret string (at least 32 characters) |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_EXPIRE_MINUTES` | `480` |
| `PUBLIC_BASE_URL` | Your Render public API URL (e.g. `https://maint-backend.onrender.com`) |
| `CORS_ORIGINS` | Your Vercel frontend URL (e.g. `https://ready-rentals.vercel.app`) |
| `ENABLE_TEST_UI` | `false` |
| `STORAGE_BACKEND` | `local` (or `s3` for AWS S3 / Cloudflare R2) |
| `STORAGE_LOCAL_DIR` | `./storage_data` |
| `EMAIL_BACKEND` | `log` (or `smtp` / `sendgrid`) |
| `MAIL_FROM` | `noreply@yourdomain.com` |
| `MAIL_FROM_NAME` | `Maintenance Work Orders` |

---

## 5) Frontend on Vercel

- **Root Directory**: `frontend`
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Vercel Environment Variables

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://your-backend.onrender.com` |

---

## 6) Verification Checklist

1. **Wipe Supabase**: Run the SQL reset script in Supabase SQL editor.
2. **Push to GitHub**: `git add .`, `git commit -m "Update owner code auth flow and postgres migrations"`, `git push`.
3. **Render Auto-Deploy**:
   - Check Render logs to verify `alembic upgrade head` completed.
   - Verify health check `/health` returns `{"status": "ok"}`.
4. **Register Owner**: Go to frontend -> Click "Have an Owner Code? Set up master account" -> Register master owner.
5. **Create Admins**: Go to "Admins" tab -> Add Property Managers.
