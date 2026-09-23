# HostGator Deployment Guide for ReadyRentals

This guide explains step-by-step how to host the ReadyRentals Maintenance Web App with HostGator.

---

## 1. Important HostGator Architecture Overview

Before deploying, understand how HostGator plans interact with your tech stack:

| Component | Technology | HostGator Shared (cPanel) | HostGator VPS / Dedicated |
|---|---|---|---|
| **Frontend** | React 18 + Vite | ✅ **Supported** (Static HTML/JS/CSS in `public_html`) | ✅ **Supported** (Served via Nginx) |
| **Backend API** | FastAPI (Python ASGI) | ❌ **Not Supported** (cPanel is WSGI-only, no Uvicorn) | ✅ **Supported** (Runs via Docker or Uvicorn service) |
| **PDF Engine** | WeasyPrint | ❌ **Crashes** (Missing native Pango/Cairo C-libraries) | ✅ **Supported** (Libraries installed via `apt-get`) |
| **Database** | PostgreSQL | ❌ **Not Supported** (Shared only provides MySQL) | ✅ **Supported** (Native PostgreSQL or Supabase) |

Because of these technical constraints, there are **two proven ways** to host this project with HostGator:

- **Method A (Most Common / Cost-Effective)**: **Hybrid Deployment**  
  Host your React Frontend on your existing **HostGator Shared Hosting (cPanel)**, and run the FastAPI Backend on **Render / Railway** with a free **Supabase PostgreSQL** database.
- **Method B (All-in-One)**: **HostGator Linux VPS**  
  Run everything (Frontend, Backend, Database, and SSL) on a single **HostGator VPS** using Docker and Nginx.

---

## Method A: Hybrid Hosting (HostGator Shared cPanel + Render/Supabase)

Use this method if you have a standard HostGator Shared Hosting plan (Hatchling, Baby, or Business).

### Step 1: Set up Managed PostgreSQL (Supabase)
1. Create a free account at [Supabase](https://supabase.com).
2. Create a new project (e.g. `readyrentals-db`).
3. Under **Project Settings** -> **Database**, copy your URI connection string:
   ```text
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```

### Step 2: Deploy Backend to Render (or Railway)
1. Push your repository to GitHub.
2. Log into [Render](https://render.com) and click **New Web Service**.
3. Connect your repository and select the **backend** directory as Root Directory.
4. Set:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Pre-Deploy Command**: `alembic upgrade head`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
5. Configure Environment Variables in Render:
   - `DATABASE_URL`: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require`
   - `OWNER_CODE`: `YOUR-SECRET-OWNER-CLAIM-CODE`
   - `JWT_SECRET`: *(A 64-character random string)*
   - `PUBLIC_BASE_URL`: `https://your-api.onrender.com`
   - `FRONTEND_BASE_URL`: `https://yourdomain.com` *(your HostGator domain)*
   - `CORS_ORIGINS`: `https://yourdomain.com,https://www.yourdomain.com`
   - `STORAGE_BACKEND`: `s3` (with your AWS S3 or Cloudflare R2 keys)
   - `EMAIL_BACKEND`: `sendgrid` (or `smtp`)
   - `SENDGRID_API_KEY`: `your-key`
   - `MAIL_FROM`: `support@yourdomain.com`
6. Click **Deploy**. Note your backend URL (e.g., `https://readyrentals-api.onrender.com`).

### Step 3: Build the Frontend for HostGator
1. In your local terminal, navigate to the `frontend/` folder:
   ```bash
   cd frontend
   ```
2. Create or edit `frontend/.env`:
   ```ini
   VITE_API_BASE_URL=https://readyrentals-api.onrender.com
   ```
3. Run the production build:
   ```bash
   npm run build
   ```
   This generates the compiled assets into `frontend/dist/` along with the automatically generated `.htaccess` file.

### Step 4: Upload to HostGator cPanel
1. Log into your **HostGator cPanel**.
2. Open **File Manager** and open `public_html/` (or your subdomain folder).
3. In File Manager settings (top right gear icon), ensure **"Show Hidden Files (dotfiles)"** is checked so `.htaccess` is visible.
4. Upload all files from your local `frontend/dist/` into `public_html/`:
   - `assets/` (folder)
   - `index.html`
   - `.htaccess` *(Crucial: prevents 404 errors when refreshing `/dashboard` or `/wo/:token`)*
   - SVG icons and `manifest.json`
5. Visit your domain in the browser (e.g. `https://yourdomain.com`). Your React app will connect to the Render API!

---

## Method B: All-in-One HostGator Linux VPS Deployment

Use this method if you purchased a HostGator Linux VPS (KVM).

### Step 1: Connect to your HostGator VPS
SSH into your server with root credentials provided by HostGator:
```bash
ssh root@YOUR_SERVER_IP
```

### Step 2: Install Docker, Nginx & Certbot
```bash
apt-get update && apt-get install -y docker.io docker-compose nginx certbot python3-certbot-nginx git
systemctl enable --now docker nginx
```

### Step 3: Clone Codebase and Configure Environment
```bash
mkdir -p /var/www/readyrentals
cd /var/www/readyrentals
git clone https://github.com/Attayab-31/ReadyRentals-Maintainanace-Webapp.git .
```

Configure `backend/.env`:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```
Fill in:
```ini
DATABASE_URL=postgresql+psycopg://postgres:A_Strong_Db_Password@postgres:5432/maintainance
OWNER_CODE=YOUR-SECRET-OWNER-CLAIM-CODE
JWT_SECRET=super-secure-random-64-character-string
PUBLIC_BASE_URL=https://yourdomain.com
FRONTEND_BASE_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
STORAGE_BACKEND=s3
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-aws-access-key
S3_SECRET_ACCESS_KEY=your-aws-secret-key
EMAIL_BACKEND=sendgrid
SENDGRID_API_KEY=your-sendgrid-key
MAIL_FROM=support@yourdomain.com
```

### Step 4: Build and Launch Backend with Docker
Update `backend/docker-compose.yml` to set your PostgreSQL password, then run:
```bash
cd /var/www/readyrentals/backend
docker-compose up -d --build
```
Verify the API is running:
```bash
curl http://localhost:8000/health
# Returns: {"status":"ok"}
```

### Step 5: Build Frontend on VPS
```bash
cd /var/www/readyrentals/frontend
# Install Node.js if not present:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Build frontend:
cat << 'EOF' > .env
VITE_API_BASE_URL=https://yourdomain.com
EOF
npm install
npm run build
```

### Step 6: Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/readyrentals`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/readyrentals/frontend/dist;
    index index.html;

    # 1. Frontend SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. Backend API routing
    location ~ ^/(auth|work-orders|categories|audit-logs|admins|files|health) {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 25M;
}
```

Enable site and activate SSL:
```bash
ln -s /etc/nginx/sites-available/readyrentals /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Production Verification Checklist

1. **Owner Setup**:
   - Visit `https://yourdomain.com/login`
   - Click **"Have an Owner Code? Set up master account"**
   - Enter your name, email, password, and the `OWNER_CODE` you configured in `.env`.
2. **Technician Flow Verification**:
   - Create a test work order.
   - Verify SMS / worker link starts with `https://yourdomain.com/wo/...`
   - Complete photos, inspect, and sign off.
   - Verify PDF generation succeeds and download the work order certificate.
3. **Audit Trail**:
   - As owner, navigate to **Audit Logs** (`/audit-logs`) to verify timestamps and action details.
