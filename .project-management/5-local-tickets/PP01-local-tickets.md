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

### RSJT-007: Ilya Update Extraction Service

**Story Points:** 8
**Status:** Not started
**Dependencies:** RSJT-002, RSJT-003, RSJT-004

- [ ] Add extraction adapter interface.
- [ ] Extract customer hint, work, duration, charge, expenses, completion, scheduling notes, and follow-up needs.
- [ ] Persist facts with source evidence and confidence.
- [ ] Generate missing-field prompts.
- [ ] Test with deterministic fixtures.

### RSJT-008: Approval And Staged Change Engine

**Story Points:** 8
**Status:** Not started
**Dependencies:** RSJT-003, RSJT-004

- [ ] Add staged change lifecycle APIs.
- [ ] Track actor, role, evidence, risk, and payload.
- [ ] Add approval inbox filters.
- [ ] Add audit events.
- [ ] Test role-specific approval permissions.

### RSJT-009: Expo App Scaffold And Auth Shell

**Story Points:** 5
**Status:** Not started
**Dependencies:** RSJT-004

- [ ] Re-check current Expo docs before scaffolding.
- [ ] Scaffold Expo Router app.
- [ ] Add manager, tech, auth, and shared route groups.
- [ ] Add TanStack Query and typed `fetch` client.
- [ ] Store session tokens in SecureStore.

### RSJT-010: Ilya Job Update UI

**Story Points:** 5
**Status:** Not started
**Dependencies:** RSJT-006, RSJT-007, RSJT-009

- [ ] Build chat-like update composer.
- [ ] Show extracted facts, confidence, and source message.
- [ ] Add quick actions for missing fields.
- [ ] Add active and unresolved job lists.
- [ ] Connect UI to update APIs.

### RSJT-011: Owner Dashboard

**Story Points:** 5
**Status:** Not started
**Dependencies:** RSJT-006, RSJT-008, RSJT-009

- [ ] Add dashboard aggregation API.
- [ ] Build owner views for open, scheduled, completed, unmatched, takeover, and payout-ready work.
- [ ] Add job detail drill-in.
- [ ] Add filters and states.
- [ ] Verify unresolved items are separate from reconciled jobs.

### RSJT-012: Twilio Webhook Intake

**Story Points:** 8
**Status:** Not started
**Dependencies:** RSJT-003, RSJT-004

- [ ] Add inbound and status callback webhook routes.
- [ ] Validate Twilio request signatures.
- [ ] Parse form-encoded SMS/MMS parameters.
- [ ] Persist messages and media metadata.
- [ ] Test with fixture payloads.

### RSJT-013: Customer Intake State Machine And Spam Gate

**Story Points:** 8
**Status:** Not started
**Dependencies:** RSJT-006, RSJT-008, RSJT-012

- [ ] Implement unknown, identifying, collecting, matched, review-ready, and blocked states.
- [ ] Ask only for missing customer intake fields.
- [ ] Add basic abuse controls.
- [ ] Short-circuit known RepairShopr customer fields.
- [ ] Stage lead or customer writeback only after minimum data and spam checks.

### RSJT-014: Live Takeover And Outbound Messaging

**Story Points:** 8
**Status:** Not started
**Dependencies:** RSJT-011, RSJT-012, RSJT-013

- [ ] Add takeover state API.
- [ ] Build Ilya conversation screen.
- [ ] Send Ilya outbound messages through Twilio.
- [ ] Pause AI replies while takeover is active.
- [ ] Show takeover state on owner dashboard.

### RSJT-015: Scheduling Proposal And Approval

**Story Points:** 5
**Status:** Not started
**Dependencies:** RSJT-008, RSJT-013, RSJT-014

- [ ] Extract scheduling preferences.
- [ ] Stage customer-facing scheduling messages.
- [ ] Stage RepairShopr appointment proposals.
- [ ] Build Ilya approval UI.
- [ ] Block unapproved scheduling commitments.

### RSJT-016: RepairShopr Writeback Execution

**Story Points:** 8
**Status:** Not started
**Dependencies:** RSJT-005, RSJT-008, RSJT-015

- [ ] Add approved-write-only RepairShopr write client.
- [ ] Execute customer, lead, ticket, comment, and appointment writebacks.
- [ ] Store request, response, and error audit events.
- [ ] Add retry and manual retry handling.
- [ ] Test with fixtures only.

### RSJT-017: Expenses, Profit, And Split Review

**Story Points:** 5
**Status:** Not started
**Dependencies:** RSJT-007, RSJT-008, RSJT-011

- [ ] Add expense APIs and mobile forms.
- [ ] Add owner review and override for Ilya-reported charge, expense, and profit inputs.
- [ ] Calculate profit from Ilya-reported profit when present, otherwise from charge minus reported expenses.
- [ ] Apply 30/70, 20/80, and 50/50 splits.
- [ ] Add split override audit trail.

### RSJT-018: Closeout Reminders

**Story Points:** 5
**Status:** Not started
**Dependencies:** RSJT-010, RSJT-011, RSJT-017

- [ ] Add reminder rules for missing completion, charge/profit basis, expense detail when needed, and follow-up.
- [ ] Add local API job runner.
- [ ] Build Ilya reminder inbox.
- [ ] Add owner stale job visibility.
- [ ] Test reminder generation.

### RSJT-019: Contact Cards

**Story Points:** 3
**Status:** Not started
**Dependencies:** RSJT-011, RSJT-013

- [ ] Generate vCards for confirmed customers.
- [ ] Add contact card endpoint.
- [ ] Add owner preview and add-contact action.
- [ ] Link availability to customer identification state.

### RSJT-020: End-To-End Smoke And Release Hardening

**Story Points:** 5
**Status:** Not started
**Dependencies:** RSJT-012, RSJT-016, RSJT-017, RSJT-018, RSJT-019

- [ ] Add fixture workflow covering intake, matching, approval, staging, Ilya update, expense entry, and payout readiness.
- [ ] Add API integration tests and mobile smoke tests.
- [ ] Ensure tests avoid live Twilio, RepairShopr, and AI calls by default.
- [ ] Document local runbook and first release checklist.
- [ ] Verify docs do not reference Tenex-owned systems.

## Gate Before Code

- [ ] PP01 accepted by owner.
- [ ] Resolved product decisions confirmed in PP01.
- [ ] Implementation plans created for RSJT-001 through RSJT-004.
- [ ] Implementation plans reviewed to 90%+.
