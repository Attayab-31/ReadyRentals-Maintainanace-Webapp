# HostGator VPS Migration Plan

**Prepared:** September 25, 2026  
**Scope:** ReadyRentals Maintenance, two WordPress sites, and eight existing cPanel mailboxes  
**Goal:** Move services safely before the HostGator Baby plan expires.

## Recommendation in brief

Use the VPS for the web applications, but keep business email with a managed email provider unless the owner is prepared to operate a mail server. The ReadyRentals code already has a production Docker Compose deployment; preserve that deployment model. WordPress can either be managed by CyberPanel on the VPS or moved to managed WordPress hosting. Do not install CyberPanel casually on top of the current deployment: both CyberPanel/OpenLiteSpeed and the included Caddy proxy expect to own public ports 80 and 443.

### Preferred plan when the VPS has enough resources

1. Confirm the VPS operating system, vCPU/RAM/disk, public IPv4, backup options, firewall controls, and whether HostGator blocks outbound SMTP port 25.
2. Keep the VPS as one web server. Install CyberPanel on a **fresh supported OS** for the two WordPress sites if the owner needs a web control panel. Run ReadyRentals in Docker Compose, with its containers private and CyberPanel/OpenLiteSpeed serving as the public web entry point. This requires a tested reverse-proxy configuration from OpenLiteSpeed to the app's frontend and API containers. Do not also publish Caddy on 80/443.
3. Keep the eight mailboxes on a managed service (for example, HostGator cPanel Email if available as a separate paid service, Google Workspace, or Microsoft 365). Move mailbox content with an IMAP migration, recreate aliases/forwarders and DNS authentication, then switch MX records. Configure ReadyRentals SMTP to use a provider's authenticated submission service.
4. Keep an independent off-server backup. The existing ReadyRentals backup script stores locally unless Restic is configured, so a VPS failure alone could otherwise take out both the app and its only backup.

CyberPanel is a reasonable choice for WordPress management, but not an automatic solution for all three services. It can create mailboxes, yet operating mail on a VPS adds deliverability, spam, DNS, IP reputation, port, and recovery work. It also does not restore a cPanel account backup as a drop-in cPanel migration.

### Simpler operational alternative

If the VPS is small, or nobody will maintain CyberPanel and the reverse proxy, host the two WordPress sites on managed WordPress hosting and use the VPS only for ReadyRentals. Keep email managed as well. This has a monthly hosting cost, but separates WordPress plugin/update issues from the application and removes the panel/proxy conflict.

### If the owner requires CyberPanel email on this VPS

It can host the mailboxes, but first confirm HostGator permits the required SMTP/IMAP/POP ports and outbound mail from the VPS IP. Plan to recreate eight accounts and migrate their message folders over IMAP; test inbound and outbound mail, TLS, spam handling, SPF, DKIM, DMARC, reverse DNS/PTR, and recovery before the MX cutover. Do not promise that the old cPanel passwords, filters, forwards, calendars, contacts, or webmail data will transfer automatically. Email on the same VPS also means a server incident can affect websites, the app, and mail together.

## What this project needs

The repository's production stack is in [`compose.production.yaml`](compose.production.yaml), with setup instructions in [`README.md`](README.md):

- React/Vite frontend served by Nginx, built with the API hostname embedded at build time.
- FastAPI backend with WeasyPrint/PDF support, SMTP notifications, optional Twilio SMS, and Alembic migrations on startup.
- PostgreSQL 16 and uploaded photos/signatures/PDFs in persistent Docker volumes.
- Caddy provides TLS and routes the frontend domain to Nginx and the API domain to FastAPI. It currently publishes host ports 80 and 443. PostgreSQL and the API are not directly exposed to the public internet.
- Domains are separate: `DOMAIN` for the app and `API_DOMAIN` for the API. The `Caddyfile` obtains and renews certificates automatically when DNS and network access allow it.
- Backups are implemented in [`ops/backup-production.sh`](ops/backup-production.sh). It briefly stops the API and saves a PostgreSQL dump and uploads archive. Without Restic, the backup remains on the VPS; configure encrypted off-site storage and test a restore.

The VPS should have enough RAM and disk for the OS, CyberPanel/OpenLiteSpeed, two WordPress installs and their databases, PostgreSQL, the API, frontend, Docker image layers, logs, and temporary backups. Check actual WordPress upload sizes and app data first. The repository does not establish the VPS specifications or actual domains, mailbox sizes, WordPress versions, DNS provider, or plan expiry date; gather those before selecting the final topology.

## CyberPanel, cPanel, and Docker: what each choice means

| Choice | WordPress | Existing cPanel sites/mail | ReadyRentals Docker app | Main tradeoff |
|---|---|---|---|---|
| CyberPanel on VPS | Panel tools and WordPress deployment/management | Recreate or migrate sites/mail; cPanel backup is not a one-click CyberPanel restore | Works when Docker is installed, but public routing must be arranged around OpenLiteSpeed | Free OpenLiteSpeed panel, but more server administration and proxy integration |
| cPanel/WHM VPS | Familiar cPanel/WHM workflow; cPanel account restore tools | Best fit for full cPanel account backup/restore, subject to compatibility and license | Possible, but Apache/cPanel and Docker/Caddy port and maintenance layout need careful design | License cost; the purchased VPS is currently reported to have no cPanel |
| Docker/SSH only | WordPress containers can run, but require hands-on updates/backup/admin | Manual migration | Direct fit: current Compose deployment is already Docker-first | Lowest extra panel cost, highest CLI/admin burden for WordPress |
| Managed WordPress + managed email | Provider manages common site/mail operations | Migrate site and mail data to the providers | VPS serves ReadyRentals only | Additional recurring cost, simpler failure boundaries and support |

HostGator's current help article says it offers cPanel as its VPS control panel and does not add a cPanel license to an already purchased VPS package; cPanel must be purchased with the VPS. Confirm whether this exact account can be re-provisioned or have a supported cPanel option added before relying on WHM restore. Do not run the CyberPanel installer over an already provisioned/used server; its installation guidance calls for a fresh supported OS installation.

### Port ownership and routing

The standalone Compose profile runs Caddy on `80:80` and `443:443`. A standard CyberPanel/OpenLiteSpeed installation also uses public HTTP/HTTPS on 80/443, so only one host process can bind those ports. The repository now has a CyberPanel overlay that publishes frontend/API only on `127.0.0.1` and leaves Caddy stopped unless its `standalone` profile is explicitly enabled. Follow [`CYBERPANEL_DEPLOYMENT_GUIDE.md`](CYBERPANEL_DEPLOYMENT_GUIDE.md) for the exact commands and OpenLiteSpeed reverse-proxy setup. Do not publish PostgreSQL or expose FastAPI on a public interface.

The alternative is to leave Caddy as the only public web listener and route the WordPress domains through it to WordPress services behind it. This is technically clean for routing but gives up CyberPanel's normal ownership of the web listener and can make panel-managed site/SSL functions confusing. Choose one public proxy design and document who maintains it.

## Migration plan

### Phase 1 — Inventory and decisions

Complete this before changing DNS or cancelling the Baby plan:

- Record the exact expiry date, both WordPress domains, all app/API domains, DNS provider, nameserver arrangement, and current TTLs.
- In cPanel, record mailbox addresses, storage used, aliases, forwarders, autoresponders, filters, catch-all settings, quotas, and any mailing lists. Ask users whether they need old sent/received mail, contacts, or calendars. Make a list of all eight accounts and owners.
- For each WordPress site, record WordPress/PHP versions, themes/plugins, cron jobs, forms, SMTP settings, database size, uploads size, redirects, DNS records, and any external integrations. Check plugin/theme licenses and renewal access.
- In HostGator Customer Portal, capture VPS public IP, OS image, CPU/RAM/disk, backups/snapshots, root SSH access, provider firewall, migration eligibility/deadline, and any outbound mail limits. Confirm whether the provider supports CyberPanel on that exact OS/image and whether installing a panel requires reprovisioning.
- Decide email destination first. If using managed mail, buy/activate it and verify the domain before MX cutover. If using VPS mail, get written confirmation on ports and PTR/rDNS first.
- Check VPS disk/RAM headroom and growth allowance. If unknown, start with the managed WordPress/email alternative rather than stacking every workload onto an undersized server.

### Phase 2 — Backups and target setup

1. Make a fresh full cPanel backup and download a separate copy. HostGator documents that a full cPanel backup includes files, databases, and email, but full-account restoration is a root/WHM operation on a compatible cPanel server; it is not itself a CyberPanel restore workflow.
2. Separately export each WordPress database and files, or use a migration/backup tool whose restore has been tested. Verify the backup archives open and record checksums. Keep the original Baby plan active.
3. For each mailbox, retain a source-side copy and do a mailbox content migration. IMAP sync is preferable for preserving folders and message state; if a target email provider offers an importer, use its documented method. Recreate mailbox passwords and client setup as needed.
4. Provision the final server architecture on a fresh supported OS. Restrict SSH to key access and trusted addresses where practical; use provider firewall plus host firewall. Open only required services. For CyberPanel, its panel port should be restricted to administrator IPs or a VPN if possible.
5. Set up the app from the repository's production Compose instructions. Generate independent strong values for PostgreSQL, JWT, and owner registration. Configure the actual frontend/API domains and SMTP provider. Keep `.env.production` private and out of Git.
6. Configure a backup target outside this VPS, retention, and alerts. Backup the whole WordPress files/databases and email-provider data as appropriate, in addition to ReadyRentals database/uploads.

### Phase 3 — Migrate WordPress and stage the app

1. Create each target WordPress site and database. Restore files and database, set correct database credentials, and update site URLs only if they change. Preserve paths, permalinks, PHP compatibility, cron, redirects, and HTTPS behavior.
2. Test using a hosts-file override or staging hostname before public DNS changes. Check desktop/mobile pages, admin login, media, forms, email delivery, checkout/donations if present, redirects, and key plugins. Fix mixed-content URLs and cache/CDN settings.
3. Deploy ReadyRentals and verify the Compose health status, `https://<API_DOMAIN>/health`, frontend login/owner registration, one complete test work order, photo upload, PDF generation, SMTP completion email, and backup creation. Avoid using a real tenant/technician link for tests.
4. Test TLS renewal path, reboots/restarts, Docker restart policy, system resource use, log rotation, and restore from a recent database/uploads backup. The app's existing backup script stops API writes briefly while it captures matching DB and upload data.
5. Keep the frontend/API domains stable if possible. Worker capability URLs include the frontend hostname; changing that hostname can strand links already sent. If it must change, plan redirects and user communications.

### Phase 4 — Email cutover

For **managed mail**:

1. Create all eight addresses, aliases, forwards, filters, and relevant shared addresses at the new provider.
2. Run an initial IMAP migration while the old mailboxes still receive mail. Then test each user's sign-in and send/receive using the new provider's settings.
3. Update SPF to authorize the selected sender(s) in one SPF record; publish provider DKIM and a monitored DMARC policy. If ReadyRentals sends completion emails from the domain, ensure its SMTP relay is authorized and uses a valid sender.
4. At the agreed cutover, switch MX records to the new provider. Keep old hosting/mail online for at least 7–14 days, run a final IMAP sync after DNS has settled, and check both old and new inboxes for stragglers.
5. Update phones/Outlook/webmail and the ReadyRentals `SMTP_HOST`, port, username, password, TLS settings, and `MAIL_FROM`. Test assignment/completion email delivery.

For **CyberPanel/VPS mail**, follow the same mailbox and sync steps, but additionally test inbound/outbound ports, TLS certificates for `mail.<domain>`, PTR/rDNS matching the mail hostname, SPF/DKIM/DMARC, queue, spam filtering, blacklists, and reputable inbox placement before moving MX. If outbound port 25 is blocked or the new VPS IP has poor reputation, use a managed outbound SMTP relay or choose managed mail instead.

### Phase 5 — DNS cutover and monitoring

1. Lower web and MX TTLs at least a day before cutover where the DNS host permits. Do not change nameservers unless all existing DNS records have been copied and verified; changing A records is usually a smaller change.
2. At cutover, point each WordPress domain and the ReadyRentals frontend/API records to the VPS (or respective managed host). Point mail records only to the new mail provider. Preserve other records such as verification TXT, SPF/DKIM/DMARC, CAA, and third-party service records.
3. Recheck DNS from public resolvers, TLS certificates, WordPress forms, app health, upload/PDF/email flow, and mail delivery from outside the server. Watch logs and disk/RAM for several days.
4. Keep the source Baby plan active during the agreed overlap. Only cancel/allow it to expire after both sites, app, all mailboxes and historical mail, and DNS have been checked by the client. HostGator's migration guidance likewise says to transfer, change DNS, wait for propagation, then cancel the old plan.

## DNS checklist

Exact values depend on the selected email provider and domain registrar. Obtain authoritative values from the provider dashboard; do not copy example MX or SPF values from this document.

- `A`/`AAAA` for each web hostname → chosen web server IP; verify there is no stale `AAAA` pointing elsewhere.
- `A` for `mail.<domain>` only if hosting mail on the VPS; set PTR/rDNS with HostGator to match.
- `MX` → exactly the selected email provider's records and priorities.
- One SPF TXT record at the root, merging authorized senders rather than publishing multiple SPF records.
- Provider-generated DKIM TXT/CNAME records for each sender.
- DMARC TXT at `_dmarc`; begin with monitoring (`p=none`) if needed to observe all senders, then tighten after legitimate sources are accounted for.
- CAA records, domain verification records, and any records used by forms, CDN, or third-party services.
- TLS available for every HTTPS site and mail hostname; mail clients must use the right certificate hostname.

## Rollback plan

- Do not delete the source site, mailboxes, or account backups during the overlap window.
- If a WordPress site fails, temporarily point its web DNS record back to the old host, then reconcile any submissions/orders written during the new-host window before retrying.
- If ReadyRentals fails, restore its database and uploads together from the same backup point. If needed, point the app/API DNS records back to the prior working host. Do not run `docker compose down -v` on a live stack; it deletes persistent volumes.
- If email fails after MX cutover, correct the provider records or switch MX back to the old service while it is active. Mail delivery can be delayed by cached DNS, so check both systems and repeat IMAP synchronization.
- Keep notes of DNS values before and after each change. A DNS rollback does not move data written after cutover; reconcile it before finalizing.

## Go-live checklist

- [ ] VPS OS and resources support the chosen stack; HostGator confirms firewall/SMTP/PTR requirements.
- [ ] A fresh cPanel backup, separate WordPress exports, and mailbox migration source are retained off-server.
- [ ] Each WordPress site passes a staging review, including forms, mail, SSL, media, and admin login.
- [ ] ReadyRentals containers are healthy; app/API domains, PDFs, uploads, SMTP, and technician links work.
- [ ] Database, app uploads, and WordPress data have encrypted off-server backups and a restore has been checked.
- [ ] All eight users can access mail; folders/history, aliases, forwards, filters, and sender authentication are checked.
- [ ] DNS records and TTLs are recorded; old hosting remains available throughout propagation and overlap.
- [ ] Client has approved the working sites and mail before the old Baby plan is cancelled or expires.

## Source notes and further reading

These vendor documents were consulted on September 25, 2026. Product features and pricing can change; verify account-specific terms in the HostGator portal before purchasing or changing service.

- HostGator: [VPS General Information](https://www.hostgator.com/help/article/vps-general-information) — HostGator states cPanel is its VPS control panel and a cPanel license is not added to an already existing VPS package.
- HostGator: [How Do I Switch to VPS?](https://www.hostgator.com/help/article/how-do-i-switch-to-vps) — transfer data, change DNS, allow propagation, then cancel old hosting; migration request option.
- HostGator: [VPS Getting Started](https://www.hostgator.com/help/article/vps-getting-started) — VPS access and first setup guidance.
- HostGator: [Generate and Download a Website Backup](https://www.hostgator.com/help/article/how-to-generatedownload-a-full-backup) — full cPanel backup content and root/WHM restore requirements/compatibility cautions.
- HostGator: [Information Needed for Migrating Content](https://www.hostgator.com/help/article/information-needed-for-transferring-content) — migration eligibility, process, and data needed; confirm current fees and eligibility in the account.
- HostGator: [Local, Backup, and Remote Mail Exchanger](https://www.hostgator.com/help/article/local-backup-and-remote-mail-exchanger) — mail routing behavior for cPanel/WHM.
- CyberPanel: [Installing CyberPanel](https://cyberpanel.net/KnowledgeBase/home/installing-cyberpanel/) — documented fresh OS and network port prerequisites; installation output notes that blocked port 25 can impair mail sending.
- CyberPanel: [Deploy WordPress](https://cyberpanel.net/KnowledgeBase/home/deploy-a-wordpress-on-cyberpanel/) — WordPress deployment and management workflow.
- CyberPanel: [Email Management](https://cyberpanel.net/KnowledgeBase/home/email-in-cyberpanel/) — mailbox, forwarding, DKIM, webmail, debugging, and DNS setup tools.
- CyberPanel: [Docker Apps and troubleshooting](https://cyberpanel.net/KnowledgeBase/home/debugging-docker-apps-features/) — Docker app access/features and domain/port requirements. This is not a substitute for validating a custom Compose stack and reverse-proxy design.
- OpenLiteSpeed: [Reverse Proxy configuration](https://docs.openlitespeed.org/config/reverseproxy/) — external Web Server applications, proxy rewrite rules, and vhost setup.

## Final decision

For this exact repository, the most maintainable default is **ReadyRentals on the VPS with its Docker Compose deployment, WordPress either managed separately or managed by CyberPanel with the configuration in [`CYBERPANEL_DEPLOYMENT_GUIDE.md`](CYBERPANEL_DEPLOYMENT_GUIDE.md), and the eight mailboxes on a managed email service**. Use CyberPanel on the same VPS only if the VPS has adequate capacity and an administrator will own panel updates, WordPress security/backups, proxy configuration, and server recovery. Keep cPanel only if preserving cPanel workflows and full-account restoration justifies obtaining a VPS/package that includes a supported cPanel license.
