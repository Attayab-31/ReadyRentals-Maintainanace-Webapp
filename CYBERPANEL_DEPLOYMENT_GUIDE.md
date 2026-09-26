# ReadyRentals + WordPress on a HostGator VPS with CyberPanel

This guide configures the two WordPress sites in CyberPanel and runs ReadyRentals using this repository's Docker Compose stack. CyberPanel/OpenLiteSpeed owns public HTTP/HTTPS ports 80 and 443. OpenLiteSpeed proxies the ReadyRentals frontend and API to Docker services bound only to loopback. PostgreSQL remains on a private Docker network. Email stays with a managed email provider.

Use this guide after choosing this shared VPS design. It assumes you have VPS root access, domains/DNS access, and the source cPanel account remains active during migration.

## Target layout

```text
Internet
   ├── WordPress domain 1 ──┐
   ├── WordPress domain 2 ──┤
   ├── app.yourdomain.com ──┼── OpenLiteSpeed (CyberPanel, ports 80/443)
   └── api.yourdomain.com ──┘             │
                         ┌────────────────┴────────────────┐
                         │                                 │
                 WordPress sites                 Docker loopback ports
                                                   127.0.0.1:18080 frontend
                                                   127.0.0.1:18000 FastAPI
                                                           │
                                              PostgreSQL private network

   Mailboxes + ReadyRentals SMTP ── managed email provider
```

The repository's Caddy service is retained for deployments without CyberPanel, but it is now in the `standalone` Compose profile. CyberPanel mode does not start Caddy. Do not start both public proxies on ports 80/443.

## Before installing CyberPanel

1. **Confirm the VPS can be reprovisioned.** CyberPanel's installer expects a fresh supported OS. Installing a panel over an in-use server can overwrite services/configuration. Back up anything already on the VPS and confirm the HostGator VPS OS and image are supported by CyberPanel's current install guide.
2. **Check capacity.** This VPS will run a panel/web server, two WordPress sites, Docker, ReadyRentals API/frontend/PostgreSQL, and backups. Check actual memory, disk use, traffic, and database/media sizes. If capacity is tight, keep WordPress on managed WordPress hosting and run only ReadyRentals on this VPS.
3. **Take source backups.** Generate and download a full cPanel backup. Also make individual exports for each WordPress site (files and SQL database) and keep a second copy off the VPS. Record all mailbox addresses, aliases, forwards, filters, and used space. Full cPanel backup restoration is a WHM/cPanel operation; do not assume it can be restored into CyberPanel.
4. **Choose managed email.** Arrange mailbox accounts with the chosen email provider before changing MX. Copy each mailbox's old messages by IMAP after target mailboxes exist. Keep the old plan active through the transition.
5. **Inventory DNS.** Record all DNS records (including MX, SPF, DKIM, DMARC, verification, CAA, and any mail autodiscovery records) and current TTLs. Lower web and MX TTLs a day before cutover if possible.
6. **Confirm provider network details.** Ask HostGator whether inbound HTTP/HTTPS and SSH are enabled, whether outbound SMTP 25 is blocked, whether a PTR/reverse DNS record can be configured, and whether provider snapshots/backups are available. Managed outbound SMTP avoids depending on VPS port 25.

## 1. Install and secure CyberPanel

Follow the current official [CyberPanel installation instructions](https://cyberpanel.net/KnowledgeBase/home/installing-cyberpanel/) for the VPS's supported fresh OS. The choices and installer prompts may change, so use that guide rather than an old command copied from a blog.

During setup:

- Select the free OpenLiteSpeed option unless you have deliberately purchased a LiteSpeed Enterprise license.
- Save the generated CyberPanel admin password in a password manager.
- Reboot when the installer asks, then sign in at `https://<VPS-IP>:8090`.
- Set a strong unique panel password and enable two-factor authentication if the installed version offers it.
- Restrict SSH and the CyberPanel port (8090) to trusted administrator IPs in the HostGator firewall and host firewall where possible. Do not expose database ports publicly.
- Do not configure CyberPanel as authoritative DNS unless you intend to operate nameservers and have registered/glued them correctly. DNS can remain with the domain registrar/Cloudflare.
- Check the CyberPanel and OpenLiteSpeed service status before proceeding.

CyberPanel's guide lists TCP 80/443 for websites and 8090 for the panel, and warns that blocked SMTP port 25 can affect mail sending. This design does not host mail on this VPS, so only open mail ports if they are specifically required for another service.

## 2. Create the two WordPress websites

For each existing WordPress domain:

1. In CyberPanel, use **Websites → Create Website**. Choose an owner/package, enter the domain and contact email, select a currently supported PHP version compatible with that site's plugins/themes, and enable SSL if DNS already points to this VPS. Do not assume the oldest/current PHP option is right; check plugin requirements.
2. Create a database and database user for the site using CyberPanel's database controls, or use the database created by its WordPress installer.
3. Migrate the source files and database with a WordPress migration plugin or a manual file + SQL export/import workflow. A cPanel full account archive is not a WordPress migration tool. Keep a clean source backup before import.
4. If the domain is not yet pointed at the VPS, test the target with a temporary hosts-file override or staging domain. Check the home page, `/wp-admin`, permalinks, media library, forms, redirects, scheduled tasks, plugin/theme behavior, and email sending. Correct the site URL only if the domain changes.
5. Once DNS A/AAAA records point to the VPS and public ports 80/443 reach it, issue a certificate via **Security → Manage SSL** for that website. Recheck HTTPS, mixed content, and redirects.
6. Configure WordPress core/plugin/theme updates and backups. Keep at least one backup outside the VPS. Review security plugins and remove unused plugins/themes.

CyberPanel offers a one-click WordPress deployment workflow, which is useful for new sites. For existing sites, restore/migrate the real site data and verify it rather than leaving a blank install in production.

## 3. Prepare ReadyRentals configuration

The repo already contains the CyberPanel-specific port mapping in [`compose.cyberpanel.yaml`](compose.cyberpanel.yaml). The mapping publishes only:

- Frontend Nginx: `127.0.0.1:18080` on the VPS → container port 80.
- FastAPI: `127.0.0.1:18000` on the VPS → container port 8000.
- PostgreSQL has no host-published port and remains on the internal database network.

Copy the repository to a private deployment directory on the VPS (for example `/opt/readyrentals`) using Git or a secure file transfer. Do not copy `.env.production` into Git. From the repository root:

```bash
cp .env.production.example .env.production
nano .env.production
```

Set the real values:

```dotenv
DOMAIN=app.yourdomain.com
API_DOMAIN=api.yourdomain.com
ACME_EMAIL=admin@yourdomain.com

POSTGRES_DB=readyrentals
POSTGRES_USER=readyrentals
POSTGRES_PASSWORD=<unique-long-random-secret>
JWT_SECRET=<different-unique-long-random-secret>
OWNER_CODE=<another-unique-registration-secret>
OWNER_EMAIL=owner@yourdomain.com

EMAIL_BACKEND=smtp
MAIL_FROM=notifications@yourdomain.com
SMTP_HOST=<managed-provider-smtp-host>
SMTP_PORT=587
SMTP_USER=<managed-provider-smtp-username>
SMTP_PASSWORD=<managed-provider-smtp-password>
SMTP_STARTTLS=true
SMTP_SSL=false
```

Generate separate secrets on the VPS (never reuse the same value):

```bash
openssl rand -hex 32
```

Set actual company branding and optional Twilio fields if used. Keep `API_DOCS_ENABLED=false` for normal production use. Keep file access private (`chmod 600 .env.production` on Linux). Do not paste the file into tickets or commit it.

`ACME_EMAIL` is retained in the shared example file for standalone Caddy deployments; CyberPanel mode obtains app/API certificates in CyberPanel instead. `DOMAIN` and `API_DOMAIN` must be real separate hostnames because the frontend embeds the API origin at build time.

## 4. Start ReadyRentals in CyberPanel mode

The CyberPanel overlay adds loopback-only ports. The command names the app services explicitly so it does not start the optional Caddy service:

```bash
docker compose --env-file .env.production \
  -f compose.production.yaml \
  -f compose.cyberpanel.yaml \
  up -d --build frontend api postgres init_uploads
```

Check status and logs:

```bash
docker compose --env-file .env.production \
  -f compose.production.yaml \
  -f compose.cyberpanel.yaml ps

docker compose --env-file .env.production \
  -f compose.production.yaml \
  -f compose.cyberpanel.yaml logs --tail=100 api frontend postgres
```

On the VPS itself, confirm the backends answer locally before configuring OpenLiteSpeed:

```bash
curl -I http://127.0.0.1:18080/
curl http://127.0.0.1:18000/health
```

The health endpoint should return `{"status":"ok"}`. Verify the published ports are loopback-only with `docker compose ... ps` and `ss -lntp`; they must not bind `0.0.0.0:18080` or `0.0.0.0:18000`.

Use the same two Compose files for future deployments, backups, restarts, and logs. Do not run the standalone command with `--profile standalone` on this VPS; that profile starts Caddy. The backup script can be configured to use both files if needed; see the backup section below.

## 5. Configure OpenLiteSpeed reverse proxy for the app

OpenLiteSpeed's official [reverse proxy documentation](https://docs.openlitespeed.org/config/reverseproxy/) supports a Web Server external application and rewrite rules. Configure each ReadyRentals hostname as its own CyberPanel website/vhost so CyberPanel can manage its certificate. The app's existing Caddy is not used in this mode.

### Create app and API websites

In CyberPanel, create websites for the exact values of `DOMAIN` and `API_DOMAIN`, for example `app.yourdomain.com` and `api.yourdomain.com`. They are proxy vhosts, not WordPress installs. After their A records resolve to the VPS and ports 80/443 are reachable, issue SSL certificates through **Security → Manage SSL**.

### Add the frontend proxy backend

In the OpenLiteSpeed WebAdmin console (normally `https://<VPS-IP>:7080`; restrict this port to admins):

1. Open **Server Configuration → External App → Add → Type: Web Server**.
2. Set the name to `rr_frontend` and address to `127.0.0.1:18080`. Use a reasonable max connection count such as 100, initial request timeout 60 seconds, retry timeout 0, and response buffering off. Save.
3. Find the `app.yourdomain.com` virtual host under **Virtual Hosts → Rewrite** (or the CyberPanel-managed vhost rewrite settings). Enable rewrite and add:

   ```text
   RewriteRule ^/(.*)$ http://rr_frontend/$1 [P,L,E=PROXY-HOST:app.yourdomain.com]
   ```

   Replace the hostname with the actual `DOMAIN` value. This forwards all app routes, including `/login` and `/wo/<token>`, to the frontend Nginx container.

### Add the API proxy backend

1. Add another **Web Server External App** named `rr_api`, address `127.0.0.1:18000`, timeout 60 seconds or higher, retry timeout 0, response buffering off.
2. In the `api.yourdomain.com` virtual host, enable rewrite and add:

   ```text
   RewriteRule ^/(.*)$ http://rr_api/$1 [P,L,E=PROXY-HOST:api.yourdomain.com]
   ```

   Replace with the real `API_DOMAIN`. Keep the full path so `/health`, `/auth/...`, `/work-orders/...`, `/wo/...`, photo uploads, and PDFs reach FastAPI unchanged.

3. Save both vhosts and perform a graceful OpenLiteSpeed restart from CyberPanel/WebAdmin. Do not edit generated config blindly; CyberPanel may rewrite managed vhost files. If a GUI field is missing, use the current CyberPanel/OpenLiteSpeed documentation and back up the vhost config before manual changes.
4. Check the OpenLiteSpeed error log and both vhost access logs if requests return 403/500/503. From the VPS, test local backends; from outside, test `https://app.yourdomain.com` and `https://api.yourdomain.com/health`.

The frontend domain must proxy to frontend port 18080 and the API domain must proxy to API port 18000. Do not proxy the API hostname to frontend Nginx. Do not expose PostgreSQL. OpenLiteSpeed terminates public TLS; requests to loopback Docker backends use HTTP.

The API accepts photos up to `MAX_UPLOAD_MB` (10 MB by default). Confirm OpenLiteSpeed request-body limits are larger than the configured application upload maximum plus multipart overhead. If the app reports upload failures, check OLS limits and API logs before increasing the app limit.

## 6. DNS and managed email

At the DNS provider, point the app and API A records to the VPS. Point both WordPress web records to the VPS too (or to their managed host if using the simpler alternative). Remove stale AAAA records unless IPv6 is configured and routed correctly.

For the eight email accounts:

1. Create all mailboxes and aliases/forwards at the managed mail provider.
2. Copy old mail by IMAP while the source cPanel account is active. Test each mailbox and update mail client settings.
3. Replace MX with the provider's exact records at cutover. Update the single SPF record to include all authorized senders, publish the provider's DKIM record(s), and start DMARC in a monitoring policy until legitimate senders are accounted for.
4. Keep old cPanel mail active during DNS propagation. Run a final IMAP sync and check both inboxes for late-arriving mail.
5. The ReadyRentals SMTP values in `.env.production` must use a provider-authorized sending identity; test assignment/completion email from the app.

Do not publish the VPS as MX in this recommended topology. The application uses outbound SMTP and does not require incoming mailbox hosting.

## 7. Backups and recovery

The repository's `ops/backup-production.sh` uses the standalone Compose file by default. In CyberPanel mode, set `CYBERPANEL_MODE=true` in the service environment so backups use the CyberPanel override when they stop and restart the API. For the included systemd service, add this line to `/etc/readyrentals-backup.env`:

```bash
CYBERPANEL_MODE=true
```

The service already loads that optional environment file. Run the backup manually with `CYBERPANEL_MODE=true` first, then enable the included systemd service/timer. Configure Restic or another encrypted off-server target and retention. The script's default local-only backup does not protect against loss of the VPS.

Back up WordPress files and databases independently using CyberPanel backups or a trusted backup tool, then copy them off the VPS. Keep email retention/export with the mail provider. Test restoring the ReadyRentals PostgreSQL dump and uploads together and test restoring each WordPress site. Never run `docker compose down -v` on production; it deletes persistent volumes.

## 8. Final migration and go-live sequence

1. Finish app/WordPress staging tests before DNS changes.
2. At least a day before cutover, lower DNS TTLs if possible and confirm every existing DNS record is documented.
3. Complete an initial mailbox IMAP copy and confirm all eight users can sign in to the new provider.
4. Change web A records to the VPS (or selected managed WP provider) and MX to the managed email provider. Do not change nameservers unless every record has been recreated.
5. Issue/confirm TLS for the two WordPress hosts and both app/API hosts. Check `https://api.../health` from outside the VPS.
6. Test WordPress pages/admin/media/forms and app login, owner registration, a test work order, a photo upload, PDF generation, and SMTP completion email.
7. Recheck all eight mailboxes, aliases, SPF/DKIM/DMARC, and delivery from outside the old hosting network. Repeat IMAP sync after DNS settles.
8. Monitor disk, RAM, container status, OLS logs, app logs, and mail provider logs for at least a week. Keep the source Baby plan active during that overlap.
9. Ask the client to confirm both sites, ReadyRentals, and all mailboxes work before cancelling or allowing the old plan to expire.

## Common failure checks

| Symptom | Check |
|---|---|
| Website displays CyberPanel default page | Correct DNS A/AAAA, vhost domain mapping, and web service; issue SSL only after DNS reaches this server. |
| App domain returns 503 | Is container running? Test `curl http://127.0.0.1:18080/`; check external app name/port, rewrite rule, and OpenLiteSpeed error log. |
| API health returns 503 | Test `curl http://127.0.0.1:18000/health`; verify `rr_api` points to port 18000 and proxy rule is on the API vhost. |
| API CORS error | Confirm `DOMAIN` equals the browser origin exactly (scheme and hostname) and rebuild/restart API after environment changes. |
| Certificate issuance fails | Check DNS A/AAAA, inbound 80/443, correct vhost domain, and whether another proxy answers ACME validation. |
| Photos fail but normal API calls work | Check OpenLiteSpeed body-size limits, `MAX_UPLOAD_MB`, available disk, and API logs. |
| WordPress admin redirect/mixed content | Verify site URL, HTTPS/canonical settings, proxy headers, and WordPress/plugin cache. |
| Completion email does not arrive | Check SMTP host/port/TLS/credentials, sender authorization, provider logs, spam folder, and SPF/DKIM/DMARC. |
| Container ports appear public | Inspect `docker compose ... ps` and `ss -lntp`; the mappings must show `127.0.0.1`, never `0.0.0.0`. |

## References

- OpenLiteSpeed: [Reverse Proxy configuration](https://docs.openlitespeed.org/config/reverseproxy/) — external Web Server applications, proxy rewrite rules, and vhost setup.
- CyberPanel: [Install CyberPanel](https://cyberpanel.net/KnowledgeBase/home/installing-cyberpanel/) — supported fresh OS prerequisites and network ports.
- CyberPanel: [Deploy WordPress](https://cyberpanel.net/KnowledgeBase/home/deploy-a-wordpress-on-cyberpanel/) — new WordPress installation workflow.
- CyberPanel: [Issue SSL](https://cyberpanel.net/KnowledgeBase/home/cyberpanel-ssl-v2/) — website certificate requirements and troubleshooting.
- HostGator: [Full cPanel backup and restore](https://www.hostgator.com/help/article/how-to-generatedownload-a-full-backup) — contents, WHM/root restoration requirements, and compatibility cautions.
- HostGator: [Switch to VPS](https://www.hostgator.com/help/article/how-do-i-switch-to-vps) — transfer, DNS change, propagation, and old-plan cancellation sequence.

## Project deployment modes

**CyberPanel VPS:** use `compose.production.yaml` plus `compose.cyberpanel.yaml`, without `--profile standalone`, and follow this guide.  
**VPS without CyberPanel:** use `compose.production.yaml --profile standalone`; Caddy serves public ports and manages app/API TLS as described in [`README.md`](README.md).
