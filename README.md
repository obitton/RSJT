# RSJT

Personal RepairShopr-backed service referral ops agent.

## Local Setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and fill local credentials.
3. Start local Postgres with `pnpm db:up`. The script uses Docker Compose when available and falls back to `docker run` on local Docker installs without Compose.
4. Run checks with `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

## Local Credentials

`.env` is ignored by git. Fill these before live integration work:

- `REPAIRSHOPR_API_KEY`: RepairShopr API key for `mycomputertechinc`.
- `AI_PROVIDER_API_KEY`: model provider key for update extraction.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, and `TWILIO_FROM_PHONE_NUMBER`: Twilio messaging config.
- `MESSAGING_CHANNEL=whatsapp_sandbox` uses Twilio's WhatsApp Sandbox for local message-loop testing.
- `MESSAGING_OUTBOUND_ENABLED=false` keeps outbound messaging disabled until we deliberately turn it on.
- `MESSAGING_TEST_RECIPIENT_ALLOWLIST` should contain only test recipient numbers when outbound testing starts.

For WhatsApp Sandbox testing, open Twilio Console, go to Messaging, Try WhatsApp, then send the shown `join ...` code from your WhatsApp account to Twilio's sandbox number. The default sandbox sender is `whatsapp:+14155238886`.

## Project Boundary

This project is personal and local-first. Do not use Linear, Notion, Slack, Gmail, Google Drive, or Tenex-owned infrastructure for project management or app infrastructure.
