# RSJT

Personal RepairShopr-backed service referral ops agent.

## Local Setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and fill local credentials.
3. Start local Postgres with `pnpm db:up`. The script uses Docker Compose when available and falls back to `docker run` on local Docker installs without Compose.
4. Run checks with `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

## Project Boundary

This project is personal and local-first. Do not use Linear, Notion, Slack, Gmail, Google Drive, or Tenex-owned infrastructure for project management or app infrastructure.
