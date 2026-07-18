# RSJT Local Runbook

## Scope

This runbook is for local development and manual QA of the personal RSJT app. It does not use external project-management or collaboration systems. Keep all planning and release notes in this repo.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment defaults:

   ```bash
   cp .env.example .env
   ```

3. Start local Postgres:

   ```bash
   pnpm db:up
   ```

4. Run migrations and seed local users:

   ```bash
   pnpm --filter @rsjt/db migrate
   pnpm --filter @rsjt/db seed
   ```

5. Run verification:

   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   pnpm --filter @rsjt/mobile lint
   ```

## Local Services

Start the API:

```bash
pnpm --filter @rsjt/api dev
```

Start the mobile app:

```bash
pnpm --filter @rsjt/mobile start
```

Use the seeded local accounts:

- Manager username: `manager`
- Tech username: `tech`
- Default passcodes come from `LOCAL_MANAGER_PASSCODE` and `LOCAL_TECH_PASSCODE`.

## View The App In A Browser

With Postgres and the API running (see Local Services), start the web build and open it:

```bash
pnpm --filter @rsjt/mobile web
```

Open `http://localhost:8081` and sign in with a seeded account. On this machine the web app reaches the API at `http://127.0.0.1:47630` with no extra config.

## Test On A Physical Phone (Expo Go)

The phone runs the real native app through Expo Go, not a browser. Two things differ from the browser flow: the API must be reachable over the LAN, and the app must point at this machine's LAN IP instead of `127.0.0.1`.

1. Install Expo Go on the phone and put the phone on the same Wi-Fi as this machine.

2. Find this machine's current LAN IPv4 address. Re-check it every time; it changes on reboot or when switching networks, so do not hardcode it. PowerShell:

   ```powershell
   Get-NetIPAddress -AddressFamily IPv4 |
     Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
     Select-Object IPAddress, InterfaceAlias
   ```

   Pick the Wi-Fi / active LAN address (for example `192.168.x.x`). Ignore virtual adapters such as WSL (`172.x`). Use it as `<LAN-IP>` below.

3. Start the API bound to all interfaces so the phone can reach it (the default `API_HOST` is `127.0.0.1`, which is localhost-only). PowerShell:

   ```powershell
   $env:API_HOST="0.0.0.0"; pnpm --filter @rsjt/api dev
   ```

4. Start Expo advertising the LAN IP, with the app pointed at the API on that IP. PowerShell:

   ```powershell
   $env:EXPO_PUBLIC_API_BASE_URL="http://<LAN-IP>:47630"; $env:REACT_NATIVE_PACKAGER_HOSTNAME="<LAN-IP>"; pnpm --filter @rsjt/mobile start
   ```

5. On the phone, scan the QR that Expo prints (iOS: Camera app; Android: Expo Go, Scan QR code), or open Expo Go and enter `exp://<LAN-IP>:8081` manually. Sign in with a seeded account.

Setting `API_HOST`, `EXPO_PUBLIC_API_BASE_URL`, and `REACT_NATIVE_PACKAGER_HOSTNAME` as shell env vars overrides the defaults for that run without editing `.env`.

### Phone Testing Notes

- Verify from this machine before scanning: `curl http://<LAN-IP>:47630/health` (expect `{"ok":true}`) and `curl http://<LAN-IP>:8081/status` (expect `packager-status:running`).
- On the first bind to `0.0.0.0`, Windows Defender Firewall may prompt. Allow `node` on Private networks, or the phone cannot reach the API.
- Servers run only while their terminal (or the session that started them) stays open, and stop when it closes. For running that outlives a Claude Code session, keep the two terminals open yourself.
- Plain `pnpm --filter @rsjt/mobile start` already prints a scannable QR in the terminal. The `qrcode-terminal` dependency is also available if a QR must be generated elsewhere (its bundled encoder is called as `new QRCode(-1, 1)`: auto version, error-correction level L).

## Environment Variables

Required for local app flow:

- `DATABASE_URL`
- `API_HOST`
- `API_PORT`
- `SESSION_TTL_HOURS`
- `LOCAL_MANAGER_PASSCODE`
- `LOCAL_TECH_PASSCODE`
- `EXPO_PUBLIC_API_BASE_URL`

Required only for live integration testing:

- `REPAIRSHOPR_SUBDOMAIN`
- `REPAIRSHOPR_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_FROM_PHONE_NUMBER`

Safety variables:

- `MESSAGING_OUTBOUND_ENABLED=false` by default.
- `MESSAGING_TEST_RECIPIENT_ALLOWLIST` must contain only test numbers before outbound testing.
- `REPAIRSHOPR_WRITEBACK_ENABLED=false` by default.
- `REPAIRSHOPR_WRITEBACK_TEST_RECORD_ALLOWLIST` must contain only explicitly approved test records before writeback testing.

## Webhook Tunnel Setup

1. Start the API locally.
2. Start a tunnel to the local API port with a local tunnel tool.
3. Set `APP_BASE_URL` in `.env` to the public tunnel URL.
4. Configure the Twilio sandbox inbound webhook to:

   ```text
   {APP_BASE_URL}/webhooks/twilio/messages
   ```

5. Configure the Twilio status callback to:

   ```text
   {APP_BASE_URL}/webhooks/twilio/status
   ```

6. Send only sandbox test messages from approved test numbers.

## Manual QA Checklist

### Authentication

- Manager can sign in.
- Tech can sign in.
- Sign out returns to the sign-in screen.

### Customer Intake

- A fixture inbound message creates or updates a conversation.
- Intake state shows missing fields when the customer is incomplete.
- Spam or blocked intake does not produce unsafe writebacks.

### Matching

- Match search returns fixture candidates.
- Candidate confidence and reasons are visible.
- Manager can select and clear a match.

### Scheduling And Writebacks

- Scheduling proposal appears for tech review.
- Approval payloads are visible before execution.
- Approved writeback execution stays disabled unless live-write safety settings are explicitly enabled.

### Tech Closeout

- Tech can submit an update.
- Extracted facts show source evidence.
- Tech can mark completion.
- Tech can enter charge, expenses, and reported profit.

### Manager Review

- Manager dashboard shows open, scheduled, completed, and payout-ready jobs.
- Manager can review money details.
- Manager can override split category with an audit reason.
- Stale closeout reminders are visible.

### Contact Cards

- Manager sees contact card availability for identified customers.
- Contact cards are unavailable when required fields are missing.
- Sharing uses local app data only.

### Reminders

- Reminder generation creates missing-field reminders.
- Follow-up reminders can be resolved in app.
- Missing-field reminders reappear when the underlying field is still missing.

## Stop Conditions

Stop manual QA and fix the issue before continuing if:

- Any flow sends a customer-facing message unexpectedly.
- Any flow writes to RepairShopr without an approved test record.
- Any production credential is printed in logs or UI.
- Any smoke test requires live Twilio, RepairShopr, or AI calls by default.
