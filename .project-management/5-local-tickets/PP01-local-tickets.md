# PP01 Local Tickets

**Date:** 2026-05-18
**Project Plan:** `.project-management/2-project-plans/PP01-service-referral-ops-agent.md`
**Linear Replacement:** These local markdown tickets replace Linear for this personal project.

## Ticket Checklist

### RSJT-001: Repo Scaffold And Local Tooling

**Story Points:** 5
**Status:** Done
**Dependencies:** None

- [x] Create pnpm workspace for mobile, API, shared, and DB packages.
- [x] Add TypeScript, Biome, Vitest, env examples, and Docker Compose for local Postgres.
- [x] Document local setup with no Tenex-owned infrastructure.
- [x] Verify lint, typecheck, test, and local DB startup.

### RSJT-002: Shared Domain Contracts

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-001

- [x] Add shared schemas for users, messages, jobs, facts, matches, approvals, expenses, payouts, and RepairShopr references.
- [x] Add split categories, confidence bands, and writeback risk constants.
- [x] Export DTO types for mobile and API.
- [x] Add validation tests.

### RSJT-003: Database Schema And Migrations

**Story Points:** 8
**Status:** Done
**Dependencies:** RSJT-001, RSJT-002

- [x] Add Drizzle config and migration tooling.
- [x] Create operational tables for users, sessions, conversations, messages, jobs, facts, matches, approvals, expenses, payouts, reminders, and audit events.
- [x] Add lookup and status indexes.
- [x] Seed manager and tech users locally.
- [x] Test migrations and key constraints.

### RSJT-004: API Skeleton, Auth, And Roles

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-003

- [x] Create Fastify API setup and health route.
- [x] Add local username/passcode auth.
- [x] Add manager and tech role guards.
- [x] Add typed error responses.
- [x] Test auth and health routes.

### RSJT-005: RepairShopr Read Client

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-002, RSJT-004

- [x] Add read-only RepairShopr client config.
- [x] Add typed reads for CRM entities needed by matching.
- [x] Add timeout, retry, and rate limiting.
- [x] Normalize RepairShopr records into shared models.
- [x] Test with fixtures only.

### RSJT-006: Record Matching Service

**Story Points:** 8
**Status:** Done
**Dependencies:** RSJT-005

- [x] Search candidates by phone, email, name, address, active work, and recency.
- [x] Calculate confidence scores and match reasons.
- [x] Store candidate and selected match decisions.
- [x] Add match confirmation APIs.
- [x] Test high, medium, low, and conflicting matches.

### RSJT-007: Tech Update Extraction Service

**Story Points:** 8
**Status:** Done
**Dependencies:** RSJT-002, RSJT-003, RSJT-004

- [x] Add extraction adapter interface.
- [x] Extract customer hint, work, duration, charge, expenses, completion, scheduling notes, and follow-up needs.
- [x] Persist facts with source evidence and confidence.
- [x] Generate missing-field prompts.
- [x] Test with deterministic fixtures.

### RSJT-008: Approval And Staged Change Engine

**Story Points:** 8
**Status:** Done
**Dependencies:** RSJT-003, RSJT-004

- [x] Add staged change lifecycle APIs.
- [x] Track actor, role, evidence, risk, and payload.
- [x] Add approval inbox filters.
- [x] Add audit events.
- [x] Test role-specific approval permissions.

### RSJT-009: Expo App Scaffold And Auth Shell

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-004

- [x] Re-check current Expo docs before scaffolding.
- [x] Scaffold Expo Router app.
- [x] Add manager, tech, auth, and shared route groups.
- [x] Add TanStack Query and typed `fetch` client.
- [x] Store session tokens in SecureStore.

### RSJT-010: Tech Job Update UI

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-006, RSJT-007, RSJT-009

- [x] Build chat-like update composer.
- [x] Show extracted facts, confidence, and source message.
- [x] Add quick actions for missing fields.
- [x] Add active and unresolved job lists.
- [x] Connect UI to update APIs.

### RSJT-011: Manager Dashboard

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-006, RSJT-008, RSJT-009

- [x] Add dashboard aggregation API.
- [x] Build manager views for open, scheduled, completed, unmatched, takeover, and payout-ready work.
- [x] Add job detail drill-in.
- [x] Add filters and states.
- [x] Verify unresolved items are separate from reconciled jobs.

### RSJT-012: Twilio Webhook Intake

**Story Points:** 8
**Status:** Done
**Dependencies:** RSJT-003, RSJT-004

- [x] Add inbound and status callback webhook routes.
- [x] Validate Twilio request signatures.
- [x] Parse form-encoded SMS/MMS parameters.
- [x] Persist messages and media metadata.
- [x] Test with fixture payloads.

### RSJT-013: Customer Intake State Machine And Spam Gate

**Story Points:** 8
**Status:** Done
**Dependencies:** RSJT-006, RSJT-008, RSJT-012

- [x] Implement unknown, identifying, collecting, matched, review-ready, and blocked states.
- [x] Ask only for missing customer intake fields.
- [x] Add basic abuse controls.
- [x] Short-circuit known RepairShopr customer fields.
- [x] Stage lead or customer writeback only after minimum data and spam checks.

### RSJT-014: Live Takeover And Outbound Messaging

**Story Points:** 8
**Status:** Done
**Dependencies:** RSJT-011, RSJT-012, RSJT-013

- [x] Add takeover state API.
- [x] Build tech conversation screen.
- [x] Send tech outbound messages through Twilio (gated by MESSAGING_OUTBOUND_ENABLED).
- [x] Pause AI replies while takeover is active.
- [x] Show takeover state on manager dashboard.

### RSJT-015: Scheduling Proposal And Approval

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-008, RSJT-013, RSJT-014

- [x] Extract scheduling preferences.
- [x] Stage customer-facing scheduling messages.
- [x] Stage RepairShopr appointment proposals.
- [x] Build tech approval UI.
- [x] Block unapproved scheduling commitments.

### RSJT-016: RepairShopr Writeback Execution

**Story Points:** 8
**Status:** Done
**Dependencies:** RSJT-005, RSJT-008, RSJT-015

- [x] Add approved-write-only RepairShopr write client.
- [x] Execute customer, lead, ticket, comment, and appointment writebacks.
- [x] Store request, response, and error audit events.
- [x] Add retry and manual retry handling.
- [x] Test with fixtures only.

### RSJT-017: Expenses, Profit, And Split Review

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-007, RSJT-008, RSJT-011

- [x] Add expense APIs and mobile forms.
- [x] Add manager review and override for tech-reported charge, expense, and profit inputs.
- [x] Calculate profit from tech-reported profit when present, otherwise from charge minus reported expenses.
- [x] Apply 30/70, 20/80, and 50/50 splits.
- [x] Add split override audit trail.

### RSJT-018: Closeout Reminders

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-010, RSJT-011, RSJT-017

- [x] Add reminder rules for missing completion, charge/profit basis, expense detail when needed, and follow-up.
- [x] Add local API job runner.
- [x] Build tech reminder inbox.
- [x] Add manager stale job visibility.
- [x] Test reminder generation.

### RSJT-019: Contact Cards

**Story Points:** 3
**Status:** Done
**Dependencies:** RSJT-011, RSJT-013

- [x] Generate vCards for confirmed customers.
- [x] Add contact card endpoint.
- [x] Add manager preview and share action.
- [x] Link availability to customer identification state.

### RSJT-020: End-To-End Smoke And Release Hardening

**Story Points:** 5
**Status:** Done
**Dependencies:** RSJT-012, RSJT-016, RSJT-017, RSJT-018, RSJT-019

- [x] Add fixture workflow covering intake, matching, approval, staging, tech update, expense entry, and payout readiness.
- [x] Add API integration tests and mobile smoke tests.
- [x] Ensure tests avoid live Twilio, RepairShopr, and AI calls by default.
- [x] Document local runbook and first release checklist.
- [x] Verify docs do not reference Tenex-owned systems.

## Gate Before Code

- [ ] PP01 accepted by project decision maker.
- [ ] Resolved product decisions confirmed in PP01.
- [ ] Implementation plans created for RSJT-001 through RSJT-004.
- [ ] Implementation plans reviewed to 90%+.
