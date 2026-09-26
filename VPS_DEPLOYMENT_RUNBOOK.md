# ReadyRentals VPS Deployment Runbook

This document is the handoff for a future Codex session opened in a shell on the CyberPanel VPS. Read this runbook and the repository's `CYBERPANEL_DEPLOYMENT_GUIDE.md` before making server changes.

## Deployment target

- Git repository: `https://github.com/Attayab-31/ReadyRentals-Maintainanace-Webapp.git`
- Intended branch: `main`
- VPS application directory: `/opt/readyrentals`
- Frontend hostname: user-provided `DOMAIN`, for example `app.example.com`
- API hostname: user-provided `API_DOMAIN`, for example `api.example.com`
- Public HTTP/HTTPS owner: CyberPanel's OpenLiteSpeed (`lsws`)
- Application services: Docker Compose frontend, FastAPI API, PostgreSQL
- OpenLiteSpeed proxies to loopback ports `127.0.0.1:18080` (frontend) and `127.0.0.1:18000` (API)
- PostgreSQL is only on Docker's internal database network. Never publish its port.
- Persistent Docker volumes: `readyrentals_postgres_data` and `readyrentals_uploads_data`

## Important GitHub checkpoint

Before cloning, check the current `main` branch and confirm it contains all the deployment files this runbook depends on:

- `compose.production.yaml` and `compose.cyberpanel.yaml`
- `backend/Dockerfile` and `frontend/Dockerfile`
- `.env.production.example`
- `ops/backup-production.sh`
- the production `API_DOCS_ENABLED` setting and CyberPanel-aware backup mode

When this runbook was prepared, the public GitHub page showed an older `DEPLOYMENT.md` describing Render, Vercel, and Supabase, while the local project contained the Docker/CyberPanel deployment setup. Do not deploy from an outdated branch or assume local uncommitted work is on GitHub. If any required files are missing, stop before deploying and report which repository changes need to be pushed. Do not push or overwrite GitHub changes without the user's authorization.

## Operating rules

1. Start by inspecting the VPS, repository state, domains, existing websites, firewall, and Docker/CyberPanel status. CyberPanel is already installed; do not reinstall it.
2. Preserve existing WordPress sites, mail configuration, DNS, CyberPanel vhosts, and all Docker volumes. Never use `docker compose down -v`, `docker volume rm`, or volume-pruning commands on a server that may contain production data.
3. Do not print, copy into chat, commit, or log `.env.production`, SSH private keys, SMTP credentials, database passwords, JWT secrets, owner codes, or technician capability links. Ask the user to enter secrets directly in a terminal editor when needed.
4. Keep the Caddy service stopped in CyberPanel mode. Do not bind app/API ports to `0.0.0.0`; the override must publish only loopback ports.
5. Do not change DNS, mail routing, or existing website vhosts as part of app deployment unless the user has explicitly requested that change.
6. Back up existing ReadyRentals data before upgrades. Before a first deployment, confirm the named volumes do not already contain data; preserve them if they do.
7. Use the Docker Engine and Compose plugin from the VPS distribution's supported packages. Inspect an existing installation before changing it.

## 1. Inspect and record the server state

Run read-only checks first:

```bash
hostnamectl
cat /etc/os-release
df -h
free -h
docker --version
docker compose version
systemctl is-active docker
systemctl is-active lsws
systemctl is-active lscpd
ss -lntp
```

Also inspect CyberPanel websites/vhosts and confirm the server has adequate free memory and disk for CyberPanel, existing WordPress sites (if any), PostgreSQL, uploads, Docker images, and backups. Confirm the provider firewall and host firewall allow inbound TCP 80/443 and SSH. Restrict CyberPanel `8090` and WebAdmin `7080` to administrator IPs where possible. Never expose database port 5432.

Record the values the user supplies for `DOMAIN`, `API_DOMAIN`, VPS public IP, SSH account, and DNS state. Confirm both app/API DNS records resolve to this VPS and remove stale AAAA records if IPv6 is not routed. If TLS issuance is planned, ports 80/443 must reach OpenLiteSpeed.

## 2. Confirm GitHub contents, then clone

Do not overwrite an existing `/opt/readyrentals` directory. Inspect it first; if it is already a Git checkout, inspect its remote, branch, working tree, Compose project, and Docker volumes before deciding whether to update it.

For a new deployment directory, clone the public repository:

```bash
sudo install -d -m 0755 /opt
sudo git clone --branch main --depth 1 \
  https://github.com/Attayab-31/ReadyRentals-Maintainanace-Webapp.git \
  /opt/readyrentals
sudo chown -R "$USER":"$USER" /opt/readyrentals
cd /opt/readyrentals
git remote -v
git rev-parse --short HEAD
git status --short
```

Verify the deployment files listed in the GitHub checkpoint before continuing. Do not run a generic deployment guide from the repository if it directs to Render/Vercel/Supabase; this deployment target uses Docker Compose and CyberPanel/OpenLiteSpeed.

## 3. Create production configuration

From `/opt/readyrentals`:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Set real values for at least:

- `DOMAIN` and `API_DOMAIN` as separate real hostnames
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `JWT_SECRET` and a different, random `OWNER_CODE`
- `OWNER_NAME` and `OWNER_EMAIL`
- SMTP host, port, username, password, and authorized sender
- company branding fields
- `API_DOCS_ENABLED=false`

Use independent, randomly generated secrets; do not reuse passwords. Keep `ACME_EMAIL` valid if present in the shared template (CyberPanel issues TLS certificates in this mode; Caddy is not used). Leave optional Twilio values blank unless SMS has been configured. Ensure no `CHANGE_ME` values or placeholder domains remain without printing the secret values. Do not copy a developer's local `.env.production` to the VPS.

Before starting, review Compose interpolation without displaying resolved configuration:

```bash
docker compose --env-file .env.production \
  -f compose.production.yaml -f compose.cyberpanel.yaml config --quiet
```

If the command fails, fix the missing/invalid configuration before starting containers.

## 4. Start the CyberPanel Compose stack

From `/opt/readyrentals`, start only the application services. Do not include `--profile standalone`; that profile starts Caddy and conflicts with OpenLiteSpeed on ports 80/443.

```bash
docker compose --env-file .env.production \
  -f compose.production.yaml -f compose.cyberpanel.yaml \
  up -d --build frontend api postgres init_uploads

docker compose --env-file .env.production \
  -f compose.production.yaml -f compose.cyberpanel.yaml ps

docker compose --env-file .env.production \
  -f compose.production.yaml -f compose.cyberpanel.yaml \
  logs --tail=100 api frontend postgres
```

Verify the local upstreams from the VPS:

```bash
curl -I http://127.0.0.1:18080/
curl http://127.0.0.1:18000/health
ss -lntp | grep -E ':(18080|18000)\b'
```

The API health response should be `{"status":"ok"}`. The listener output must show loopback binding, not `0.0.0.0` or a public IP. With production docs disabled, `/docs`, `/redoc`, and `/openapi.json` should return 404.

## 5. Configure OpenLiteSpeed and TLS

For each hostname, create/manage a CyberPanel website/vhost for the exact domain. These are proxy vhosts; the React/FastAPI app does not run under PHP. Issue certificates through CyberPanel once DNS resolves to this server and public ports 80/443 reach OpenLiteSpeed.

In OpenLiteSpeed WebAdmin, create two **Web Server External Apps**:

| Name | Address | Suggested settings |
| --- | --- | --- |
| `rr_frontend` | `127.0.0.1:18080` | Max connections 100; request timeout 60; retry 0; response buffering off |
| `rr_api` | `127.0.0.1:18000` | Max connections 100; request timeout 60 or higher; retry 0; response buffering off |

Enable rewrite on the app vhost and route all paths to the frontend external app. Replace the example hostname with the real `DOMAIN`:

```text
RewriteRule ^/(.*)$ http://rr_frontend/$1 [P,L,E=PROXY-HOST:app.example.com]
```

Enable rewrite on the API vhost and route all paths to FastAPI. Replace the example with the real `API_DOMAIN`:

```text
RewriteRule ^/(.*)$ http://rr_api/$1 [P,L,E=PROXY-HOST:api.example.com]
```

Keep paths unchanged so `/health`, `/auth/...`, `/work-orders/...`, `/wo/...`, uploads, and PDFs arrive at the API. Perform a graceful OpenLiteSpeed restart after saving. Avoid blindly editing CyberPanel-generated files; back up vhost configuration before manual changes. Ensure OpenLiteSpeed request-body limits exceed `MAX_UPLOAD_MB` plus multipart overhead (10 MB default).

## 6. Verify the public deployment

From a machine outside the VPS, verify:

```text
https://<DOMAIN>/
https://<API_DOMAIN>/health
```

Then check the actual workflows: first owner registration using the private `OWNER_CODE`, owner login, create a disposable work order, open the technician link, upload a test image, generate/download a PDF, and deliver a completion email. Remove only disposable test records through the application. Confirm CORS uses the exact frontend origin and review API/OpenLiteSpeed logs for errors. Do not paste technician links or secrets into logs or support messages.

## 7. Configure CyberPanel-mode backups

The backup script needs both Compose files when it stops/restarts the API. Set this in `/etc/readyrentals-backup.env` (the included systemd service loads this optional file). Use `sudoedit` so existing Restic settings are preserved:

```dotenv
CYBERPANEL_MODE=true
```

Add a Restic repository and password-file settings there if off-server backups are configured. Protect the environment/password files with root-only permissions. Inspect whether the included service/timer are already installed and preserve existing unit files. If absent, install the repository versions, then reload systemd. Run a manual backup before enabling the timer:

```bash
sudoedit /etc/readyrentals-backup.env
sudo chmod 600 /etc/readyrentals-backup.env
if ! sudo systemctl cat readyrentals-backup.service >/dev/null 2>&1; then
  sudo install -m 0644 ops/readyrentals-backup.service /etc/systemd/system/readyrentals-backup.service
fi
if ! sudo systemctl cat readyrentals-backup.timer >/dev/null 2>&1; then
  sudo install -m 0644 ops/readyrentals-backup.timer /etc/systemd/system/readyrentals-backup.timer
fi
sudo systemctl daemon-reload
sudo systemctl start readyrentals-backup.service
sudo systemctl status readyrentals-backup.service --no-pager
```

Confirm the dump, uploads archive, and checksums were created, then enable the timer with `sudo systemctl enable --now readyrentals-backup.timer` and verify its next/last run. A local-only backup is not disaster recovery; configure encrypted off-server storage and perform a restore drill. Back up WordPress separately if it is also hosted on the VPS.

## 8. Routine updates

Before an update, confirm the current Git branch/remote and a clean worktree, review the incoming change, and take a verified backup. Fetch/pull only the intended branch. Preserve `.env.production` and named data volumes. Rebuild/recreate the app with the same CyberPanel Compose files:

```bash
docker compose --env-file .env.production \
  -f compose.production.yaml -f compose.cyberpanel.yaml \
  up -d --build frontend api postgres init_uploads
```

The API image runs Alembic migrations at startup. Inspect API and database logs and verify both local health and public endpoints after each update. Never run `down -v` on a live deployment.

## Session handoff checklist

At the beginning of the VPS terminal session, the assistant should:

1. Read this runbook and `CYBERPANEL_DEPLOYMENT_GUIDE.md` from the checked-out repo.
2. Inspect OS, resources, CyberPanel/OpenLiteSpeed, Docker, firewall, existing vhosts, current Git checkout, existing containers, and volumes before changing anything.
3. Confirm the GitHub `main` branch includes the intended CyberPanel Compose and backup changes; stop and report if it does not.
4. Collect only missing deployment facts (VPS domains/DNS, SSH access context, SMTP readiness, backup destination). Do not ask for passwords/private keys in chat.
5. Carry out the deployment and report the commit, services, public health results, backup status, and any unresolved blocker. Do not claim success until public HTTPS and essential application workflows are verified.
