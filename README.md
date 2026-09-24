# ReadyRentals Maintenance

ReadyRentals is a property maintenance work-order application with a React frontend, FastAPI API, PostgreSQL database, local persistent file storage, and SMTP notifications.

## Production VPS deployment

The supported production deployment is the root Docker Compose stack. It includes Caddy for HTTPS, the frontend, API, and PostgreSQL. PostgreSQL and uploaded files persist in named Docker volumes. Only Caddy publishes web ports.

1. Install Docker Engine and the Docker Compose plugin on an Ubuntu VPS.
2. Point DNS records for `app.yourdomain.com` and `api.yourdomain.com` to the VPS public IP. Allow inbound TCP ports 80 and 443 (and UDP 443 if HTTP/3 is desired).
3. Copy or clone this repository to `/opt/readyrentals`.
4. Create production settings and replace all example values:

   ```bash
   cd /opt/readyrentals
   cp .env.production.example .env.production
   nano .env.production
   ```

   Replace all `example.com`, `CHANGE_ME`, and example SMTP values with your real settings. Generate independent database, JWT, and owner-registration secrets, for example with `openssl rand -hex 32`. Keep `.env.production` private and never commit it.

   Twilio SMS is optional. Leave its three settings blank to disable texting; the app will still show the worker link for manual sharing. To send texts, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and an SMS-capable Twilio number in E.164 format (for example `+1...`). The API service already reads `.env.production`; recreate the API container after changing these values. See the Twilio note below before sending to real recipients.

   The [client handover and operations guide](ReadyRentals_Client_Handover.docx), Section 7, describes the production variables and the values to obtain from DNS, SMTP, and Twilio.

5. Start the stack:

   ```bash
   docker compose --env-file .env.production -f compose.production.yaml up -d --build
   docker compose --env-file .env.production -f compose.production.yaml ps
   docker compose --env-file .env.production -f compose.production.yaml logs -f --tail=100
   ```

6. Open `https://app.yourdomain.com`, register the first owner using `OWNER_CODE`, then sign in. Check `https://api.yourdomain.com/health` for the API health response.

Do not use the local-development certificate or `.env.production` test values from a workstation. Caddy obtains real certificates for public VPS domains. Never run `docker compose down -v` on a deployment; that removes database and upload volumes.

## Backups

The [client handover and operations guide](ReadyRentals_Client_Handover.docx) covers scheduled database and upload backups, encrypted off-site retention, and restore procedures. A backup is not verified until it has been restored successfully.

## Twilio SMS readiness

The app sends an assignment message containing the worker's secure link. For US local long-code numbers, Twilio requires A2P 10DLC registration; trial accounts also restrict sending to verified recipient numbers. Twilio's initial API response means the message was accepted or queued, not confirmed delivered. The app currently does not store message SIDs or process delivery callbacks, so check delivery in Twilio Console and do not rely on SMS as the only way to give a technician the link.

## Developer references

- [Client handover and operations guide (Word)](ReadyRentals_Client_Handover.docx)
- [Backend](backend/README.md)
- [Frontend](frontend/README.md)

## Project attribution and support

This project was developed for **ReadyRentalsOnline** by **Muhammad Attayab Ashraf** and **Automivex**, a software development company.

- **Client organization:** [ReadyRentalsOnline](https://readyrentalsonline.com)
- **Developer:** Muhammad Attayab Ashraf, [Automivex](https://www.automivex.com)
- **Developer personal contact:** [attayabpc2@gmail.com](mailto:attayabpc2@gmail.com) · [+92 317 4026038](tel:+923174026038)
- **Automivex company contact:** [social@automivex.com](mailto:social@automivex.com)

For technical support, contact the developer using the details above. Do not send passwords, production environment files, API keys, or other secrets by email; share a redacted error message and relevant deployment details instead.
