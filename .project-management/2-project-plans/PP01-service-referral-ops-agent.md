# PP01 - Service Referral Ops Agent - Project Plan

**Date:** 2026-05-18
**Estimated Total Story Points:** 122
**Status:** Implementation in progress locally through RSJT-006

## Executive Summary

### What We Are Building

A personal, RepairShopr-backed operations agent for delegated service jobs. The system captures Ilya's job updates with minimal typing, runs conservative customer intake over Twilio SMS/MMS, stages RepairShopr writebacks for human approval, and gives the owner a mobile dashboard for job state, revenue, expenses, profit, and split readiness.

### Why It Matters

The current text-forwarding workflow loses state around accepted jobs, scheduling, closeout, customer identity, and payout math. This plan creates a structured workflow without letting automation make scheduling, money, customer identity, or CRM writeback decisions without review.

### Scope

**In scope:**

- Expo mobile app for owner and Ilya workflows.
- Backend API for auth, job state, staged approvals, Twilio webhooks, RepairShopr integration, and dashboard data.
- Twilio SMS/MMS customer intake and live takeover.
- RepairShopr read matching plus staged writebacks after approval.
- Local app database for messages, extracted facts, staged changes, approvals, expenses, and payout state.
- Profit split tracking for returning RepairShopr customers, new non-RepairShopr leads, and manually overridden customer-service-heavy work.

**Out of scope:**

- AI phone calls or voice agents.
- Autonomous appointment commitments.
- Customer payment collection.
- Replacing RepairShopr as CRM, ticketing, invoicing, payment, or appointment source of truth.
- Linear, Notion, Slack, Gmail, Google Drive, or Tenex-owned infrastructure.
- Production deployment to a Tenex-owned account.

### Codebase Context

- The repo currently contains local planning docs, local Expo skills, and no application scaffold.
- `AGENTS.md` makes this a personal project and requires local-only project management.
- Expo MCP is not available for this account, so planning used official Expo docs and the installed `.agents/skills/` guidance.
- Local tickets must be markdown in `.project-management/5-local-tickets/`, not Linear.

### Technology Choices

- **Expo SDK 55 with Expo Router:** Current Expo docs list SDK 55 as latest and recommend Expo Router for new universal React Native apps. Verify again before scaffolding.
- **Expo Go first, development build only if required:** The app should start in Expo Go. Development builds are reserved for native libraries or remote push behavior that Expo Go cannot support.
- **TypeScript monorepo with pnpm workspaces:** Keeps mobile, API, shared contracts, and database code in one personal repo.
- **Fastify API:** Lightweight TypeScript HTTP server for mobile API routes, Twilio webhooks, and RepairShopr orchestration.
- **PostgreSQL plus Drizzle:** Durable relational app database with typed migrations for jobs, messages, approvals, expenses, and payout state.
- **TanStack Query with `fetch`:** Mobile server-state fetching follows the local Expo networking skill. Avoid axios.
- **Server-side AI extraction adapter:** Extracts structured facts with source evidence and confidence, but never writes money, scheduling, identity, or CRM changes directly.
- **Twilio Programmable Messaging:** Customer-facing SMS/MMS channel through incoming message webhooks and outbound status callbacks.

### Key Architectural Decisions

1. **RepairShopr remains source of truth:** The app stores operational state and staged changes, but RepairShopr remains canonical for CRM, tickets, appointments, invoices, and payments.
2. **All external writebacks are staged:** RepairShopr writes and customer-facing scheduling messages require Ilya or owner approval.
3. **Traceable extraction:** Every extracted fact stores source message IDs and confidence so dashboard users can review why the system believes something.
4. **Server-owned Twilio flow:** Twilio webhooks and outbound messages run only through the backend, with signature validation and transcript persistence.
5. **Role-specific app surfaces:** Ilya gets fast job update, takeover, scheduling approval, and closeout flows. The owner gets reconciliation, unmatched items, and payout review.

## Resolved Product Decisions

These decisions resolve the PRD open questions for implementation planning.

1. **Expense categories:** Ilya handles his own travel, so travel, parking, and tolls are not deducted. V1 tracks the total amount charged, explicit parts/materials/subcontractor costs when Ilya reports them, or Ilya's directly reported profit when he provides it.
2. **Expense entry and approval:** Ilya is trusted to enter and edit charge, parts, expense, and profit information. Owner review and override are available, but owner approval is not required before split calculation.
3. **Match confidence UX:** High confidence is `>= 0.85` and can auto-link for display. Medium-high confidence is `0.70` to `0.84` and is acceptable for a single-candidate display link when match reasons are visible. Ambiguous or low confidence below `0.70` requires confirmation or more information. All RepairShopr writebacks remain staged.
4. **New lead versus returning customer:** Any existing RepairShopr customer is a returning customer, not a new lead. A new lead means no matching RepairShopr customer exists before this workflow creates or stages the record.

## Current Documentation Sources Checked

- Local rules: `AGENTS.md`
- PRD: `.project-management/1-PRDs/PRD01-service-referral-ops-agent.md`
- Expo source policy: `.project-management/0-docs/framework-docs.md`
- Local Expo skills: `.agents/skills/building-native-ui/SKILL.md`, `.agents/skills/native-data-fetching/SKILL.md`, `.agents/skills/expo-dev-client/SKILL.md`, `.agents/skills/upgrading-expo/SKILL.md`
- Official Expo docs:
  - https://docs.expo.dev/router/introduction/
  - https://docs.expo.dev/develop/development-builds/introduction/
  - https://docs.expo.dev/versions/latest/
- Official Twilio docs:
  - https://www.twilio.com/docs/usage/webhooks/messaging-webhooks
  - https://www.twilio.com/docs/messaging/guides/webhook-request
- Official RepairShopr docs:
  - https://repair.uservoice.com/knowledgebase/articles/376312-repairshopr-rest-api-build-custom-extensions-app

## System Architecture

### Architecture Diagram

```text
+-----------------------------+        +------------------------------+
| Expo Mobile App             |        | Twilio SMS/MMS               |
|                             |        |                              |
| Owner dashboard             |        | Incoming message webhook     |
| Ilya job/update flows       |        | Outbound status callback     |
| Approval inbox              |        +---------------+--------------+
| Live takeover composer      |                        |
+--------------+--------------+                        |
               | HTTPS API                              | HTTPS form post
               v                                        v
+---------------------------------------------------------------+
| Fastify Backend API                                           |
|                                                               |
| Auth and roles           Twilio webhook controller            |
| Job workflow service     Intake state machine                 |
| Matching service         AI extraction adapter                |
| Approval service         RepairShopr integration service      |
| Dashboard service        Reminder and payout services         |
+-------------------+------------------------+------------------+
                    |                        |
                    | SQL                    | HTTPS REST API
                    v                        v
+------------------------------+     +-------------------------------+
| App PostgreSQL Database      |     | RepairShopr                   |
|                              |     |                               |
| Users and sessions           |     | Customers and contacts        |
| Messages and transcripts     |     | Leads and tickets             |
| Jobs and extracted facts     |     | Appointments                  |
| Match candidates             |     | Invoices and payments         |
| Staged writebacks            |     | Ticket comments and notes     |
| Expenses and payouts         |     +-------------------------------+
| Audit events                 |
+------------------------------+
```

### Component Descriptions

**Expo Mobile App:** Native-first app for owner and Ilya workflows using Expo Router route groups, TanStack Query for server state, and SecureStore for session credentials.

**Fastify Backend API:** Owns authenticated mobile APIs, Twilio webhooks, RepairShopr orchestration, approval state, and dashboard aggregation.

**App PostgreSQL Database:** Stores the app's operational state, evidence, staged changes, and payout calculations without replacing RepairShopr records.

**Twilio Integration:** Receives customer SMS/MMS, validates Twilio signatures, persists transcript events, and sends approved replies or intake questions.

**RepairShopr Integration:** Searches and reads CRM entities, rate-limits API calls, and applies approved writebacks only after staged review.

**Matching Service:** Scores candidate RepairShopr entities using phone, email, name, address, recency, and active job context.

**AI Extraction Adapter:** Converts natural-language updates into typed extracted facts with source spans, confidence, and missing-field prompts.

**Approval Service:** Central queue for customer-facing messages, RepairShopr writebacks, appointment creation, owner overrides, and payout finalization.

## Core Flows

### Ilya Job Update Capture

1. Ilya opens the app or sends an internal update through the app's message-like UI.
2. The backend stores the raw message, runs extraction, and links facts to source evidence.
3. The matching service links the update to a RepairShopr candidate when confidence is high, otherwise it asks for confirmation.
4. Missing charge, expense, completion, or follow-up fields become quick prompts.
5. Completed jobs move toward payout-ready when required fields and Ilya-reported charge, expense, or profit basis exist.

### Customer Intake Through Twilio

1. Customer texts the Twilio service number.
2. Backend validates the Twilio request signature and stores the inbound message plus media metadata.
3. Known customers are matched against RepairShopr and are asked only for missing or stale fields.
4. Unknown customers go through spam checks and minimum intake collection before any durable RepairShopr lead is staged.
5. Scheduling language is collected as a preference only. Confirmed appointment times require Ilya approval.

### Staged RepairShopr Writeback

1. A service proposes a writeback such as customer update, lead creation, ticket comment, ticket creation, appointment creation, or invoice/payment link.
2. The proposed payload stores source evidence, risk category, and target RepairShopr entity.
3. Ilya or the owner approves, rejects, or edits the proposal.
4. Approved writebacks execute through the RepairShopr client with request/response audit events.

### Live Takeover

1. Ilya marks a customer conversation as takeover-active.
2. AI customer replies pause while takeover remains active.
3. Ilya sends messages from the app through Twilio.
4. The dashboard shows takeover state and stale takeover warnings.
5. Ilya releases takeover when the AI can resume intake collection.

## Implementation Tickets

### RSJT-001: Repo Scaffold And Local Tooling

**Story Points:** 5

**Description:**
Create the app/API/shared package skeleton and local development commands without adding external project infrastructure.

**Tasks:**

- Create pnpm workspace structure for `apps/mobile`, `apps/api`, `packages/shared`, and `packages/db`.
- Add TypeScript, Biome, Vitest, and local env examples.
- Add Docker Compose for local PostgreSQL only.
- Add README setup commands and local-only project notes.
- Scaffold command placeholders without implementing product flows.

**Acceptance Criteria:**

- [ ] `pnpm install` resolves workspace packages.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` run against the scaffold.
- [ ] Local Postgres can start with a documented command.
- [ ] No Linear, Notion, Slack, Gmail, Drive, or Tenex-owned config is added.

**Dependencies:** None

**Files:**

- `package.json`
- `pnpm-workspace.yaml`
- `apps/mobile/*`
- `apps/api/*`
- `packages/shared/*`
- `packages/db/*`
- `docker-compose.yml`
- `.env.example`
- `README.md`

### RSJT-002: Shared Domain Contracts

**Story Points:** 5

**Description:**
Define shared domain types, Zod schemas, enums, and constants for jobs, messages, approvals, matching, expenses, and split categories.

**Tasks:**

- Add schemas for users, roles, messages, jobs, extracted facts, match candidates, approvals, expenses, payout state, and RepairShopr references.
- Define split categories and default split percentages.
- Define confidence bands and writeback risk categories.
- Export DTO types for mobile and API packages.

**Acceptance Criteria:**

- [ ] Shared schemas compile under strict TypeScript.
- [ ] All cross-package domain constants come from `packages/shared`.
- [ ] Split categories match the PRD and resolved product decisions.
- [ ] Unit tests cover validation for key schemas.

**Dependencies:** RSJT-001

**Files:**

- `packages/shared/src/domain/*.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/domain/*.test.ts`

### RSJT-003: Database Schema And Migrations

**Story Points:** 8

**Description:**
Create the app database schema for operational state, evidence, approvals, and payout calculations.

**Tasks:**

- Add Drizzle config and migration tooling.
- Create tables for users, sessions, conversations, messages, message media, jobs, extracted facts, match candidates, staged writebacks, approvals, expenses, payouts, reminders, and audit events.
- Add indexes for phone/email lookup, RepairShopr references, job state, payout state, and approval status.
- Add seed data for manager and tech roles.

**Acceptance Criteria:**

- [ ] Migrations apply cleanly to local Postgres.
- [ ] Tables enforce foreign keys and core enum constraints.
- [ ] Seed data creates only local users and no external records.
- [ ] Database tests cover migration apply and key constraints.

**Dependencies:** RSJT-001, RSJT-002

**Files:**

- `packages/db/src/schema/*.ts`
- `packages/db/src/migrations/*`
- `packages/db/src/seed.ts`
- `packages/db/drizzle.config.ts`
- `packages/db/src/*.test.ts`

### RSJT-004: API Skeleton, Auth, And Roles

**Story Points:** 5

**Description:**
Build the Fastify API foundation with local auth, manager/tech roles, typed routes, and health checks.

**Tasks:**

- Add Fastify app setup, config loading, request logging, and health route.
- Implement local username/passcode auth with server sessions for v1.
- Store mobile session tokens securely server-side and expose session DTOs.
- Add manager-only and tech-capable route guards.
- Add typed error response shape.

**Acceptance Criteria:**

- [ ] API starts locally and connects to Postgres.
- [ ] Manager and tech users can authenticate against seeded users.
- [ ] Role guards reject unauthorized requests.
- [ ] Route tests cover login, session read, logout, and health.

**Dependencies:** RSJT-003

**Files:**

- `apps/api/src/app.ts`
- `apps/api/src/config.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/plugins/*.ts`
- `apps/api/src/services/auth-service.ts`
- `apps/api/src/**/*.test.ts`

### RSJT-005: RepairShopr Read Client

**Story Points:** 5

**Description:**
Create a read-focused RepairShopr client for search and lookup, with rate limiting and no write methods yet.

**Tasks:**

- Implement API key and subdomain config from local env.
- Add typed read methods for customers, contacts, leads, tickets, appointments, invoices, payments, and ticket comments as supported by Swagger.
- Add request timeout, retry policy for transient failures, and 180 requests/minute per-IP throttling.
- Normalize RepairShopr records into shared reference models.
- Add fixture-backed tests with no live API calls.

**Acceptance Criteria:**

- [x] Client methods are read-only.
- [x] Fixtures cover representative RepairShopr entities needed by matching.
- [x] API credentials are never exposed to the mobile app.
- [x] Rate limiting behavior is unit tested.

**Dependencies:** RSJT-002, RSJT-004

**Files:**

- `apps/api/src/integrations/repairshopr/repairshopr-client.ts`
- `apps/api/src/integrations/repairshopr/repairshopr-types.ts`
- `apps/api/src/integrations/repairshopr/fixtures/*.json`
- `apps/api/src/integrations/repairshopr/*.test.ts`

### RSJT-006: Record Matching Service

**Story Points:** 8

**Description:**
Score RepairShopr candidates from partial identifiers and expose match review data to app flows.

**Tasks:**

- Implement candidate search from phone, email, name, address, active tickets, recent appointments, and recent invoices/payments.
- Calculate confidence score and human-readable match reasons.
- Store match candidates and selected match decisions.
- Expose API endpoints for match candidates, confirmation, and unlinking.
- Add tests for high, medium, low, and conflicting candidate cases.

**Acceptance Criteria:**

- [x] Exactly one high-confidence candidate can be auto-linked for display.
- [x] Exactly one medium-high candidate can be linked for display when match reasons are visible.
- [x] Ambiguous or low-confidence updates require confirmation or more information.
- [x] Match reasons are visible through the API.
- [x] No RepairShopr writeback occurs from matching alone.

**Dependencies:** RSJT-005

**Files:**

- `apps/api/src/services/matching-service.ts`
- `apps/api/src/routes/matches-routes.ts`
- `apps/api/src/repositories/matches-repository.ts`
- `apps/api/src/**/*.test.ts`

### RSJT-007: Ilya Update Extraction Service

**Story Points:** 8

**Description:**
Convert terse Ilya job updates into structured facts with confidence, missing fields, and source evidence.

**Tasks:**

- Add extraction adapter interface so the model provider can be swapped.
- Define extraction prompt/contracts for customer hint, work performed, duration, charge, expenses, completion state, scheduling notes, and follow-up needs.
- Persist extracted facts with source message IDs and confidence.
- Generate missing-field prompts for charge, expenses, completion, customer identity, and follow-up.
- Add deterministic fixture tests around representative messages.

**Acceptance Criteria:**

- [ ] `"went to Michele, 1 hr 200"` produces customer hint, duration, charge, likely completion, and missing expense state.
- [ ] Facts that affect money, scheduling, identity, or CRM writeback include source evidence.
- [ ] Low-confidence facts require confirmation before downstream use.
- [ ] Tests run without calling live AI APIs.

**Dependencies:** RSJT-002, RSJT-003, RSJT-004

**Files:**

- `apps/api/src/services/extraction-service.ts`
- `apps/api/src/services/extraction-prompts.ts`
- `apps/api/src/routes/updates.ts`
- `apps/api/src/repositories/facts-repository.ts`
- `apps/api/src/**/*.test.ts`

### RSJT-008: Approval And Staged Change Engine

**Story Points:** 8

**Description:**
Create the central staged approval queue for RepairShopr writebacks, scheduling messages, owner overrides, and payout finalization.

**Tasks:**

- Add staged change creation, edit, approve, reject, and expire operations.
- Model approval actor, required role, source evidence, risk category, and final payload.
- Expose approval inbox API with filters by actor, risk type, job, and state.
- Add audit events for approval decisions.
- Add tests for role-specific approval permissions.

**Acceptance Criteria:**

- [ ] Staged changes can be reviewed before execution.
- [ ] Owner-only approvals cannot be approved by Ilya.
- [ ] Edited approvals preserve original proposal evidence.
- [ ] Rejected approvals do not execute external writes.

**Dependencies:** RSJT-003, RSJT-004

**Files:**

- `apps/api/src/services/approval-service.ts`
- `apps/api/src/routes/approvals.ts`
- `apps/api/src/repositories/approvals-repository.ts`
- `apps/api/src/**/*.test.ts`

### RSJT-009: Expo App Scaffold And Auth Shell

**Story Points:** 5

**Description:**
Create the Expo mobile app shell using Expo Router, role-aware navigation, and API session handling.

**Tasks:**

- Scaffold `apps/mobile` with Expo SDK 55 if still current at implementation time.
- Configure Expo Router route groups for manager, tech, auth, and shared job detail flows.
- Add TanStack Query provider and typed API client using `fetch`.
- Store session token in SecureStore.
- Build basic login, logout, and role landing screens.

**Acceptance Criteria:**

- [ ] App runs in Expo Go unless a documented native dependency prevents it.
- [ ] Manager and tech users see role-appropriate landing routes.
- [ ] API requests use shared DTO types.
- [ ] Auth state survives app restart.

**Dependencies:** RSJT-004

**Files:**

- `apps/mobile/app/*`
- `apps/mobile/src/api/*`
- `apps/mobile/src/auth/*`
- `apps/mobile/src/components/*`
- `apps/mobile/app.json`

### RSJT-010: Ilya Job Update UI

**Story Points:** 5

**Description:**
Build the mobile-first UI for Ilya to submit terse updates, review extracted facts, answer missing-field prompts, and see active jobs.

**Tasks:**

- Add chat-like update composer for internal job updates.
- Show extracted facts with confidence labels and source message.
- Add quick actions for complete, charge, expense, customer confirm, and follow-up needed.
- Add active and unresolved job lists for Ilya.
- Connect update submission to extraction and matching APIs.

**Acceptance Criteria:**

- [ ] Ilya can submit a short natural-language update from the app.
- [ ] Extracted fields and missing prompts appear after processing.
- [ ] Ilya can correct or confirm extracted facts.
- [ ] Unmatched updates remain visible until resolved.

**Dependencies:** RSJT-006, RSJT-007, RSJT-009

**Files:**

- `apps/mobile/app/(ilya)/*`
- `apps/mobile/src/features/updates/*`
- `apps/mobile/src/features/jobs/*`
- `apps/mobile/src/api/updates.ts`

### RSJT-011: Owner Dashboard

**Story Points:** 5

**Description:**
Create the owner dashboard for open leads, scheduled jobs, completed jobs, unmatched updates, takeover state, revenue, expenses, profit, and split amounts.

**Tasks:**

- Add dashboard API aggregation.
- Build owner tabs for open, scheduled, completed, unmatched, takeover, and payout-ready views.
- Add job detail drill-in with RepairShopr references and source evidence.
- Add filters for job state, payout state, and split category.
- Add dashboard loading, empty, and error states.

**Acceptance Criteria:**

- [ ] Owner can see unresolved items separate from reconciled jobs.
- [ ] Job rows show customer, state, RepairShopr link, gross, expenses, profit, split category, and payout amounts.
- [ ] Takeover-active conversations are visible.
- [ ] Dashboard data comes from API, not local mock state.

**Dependencies:** RSJT-006, RSJT-008, RSJT-009

**Files:**

- `apps/api/src/routes/dashboard.ts`
- `apps/api/src/services/dashboard-service.ts`
- `apps/mobile/app/(owner)/*`
- `apps/mobile/src/features/dashboard/*`

### RSJT-012: Twilio Webhook Intake

**Story Points:** 8

**Description:**
Receive customer SMS/MMS through Twilio, validate requests, persist transcripts, and return conservative TwiML responses.

**Tasks:**

- Add Twilio webhook routes for inbound messages and outbound status callbacks.
- Validate Twilio request signatures with the official SDK helper.
- Parse form-encoded inbound parameters, including media URL and content type fields.
- Persist customer conversation messages and media metadata.
- Return empty TwiML when no immediate reply is approved or needed.

**Acceptance Criteria:**

- [ ] Invalid Twilio signatures are rejected.
- [ ] Inbound SMS and MMS are persisted with Twilio message IDs.
- [ ] Media metadata is stored without downloading media until needed.
- [ ] Webhook tests use fixture payloads and no live Twilio calls.

**Dependencies:** RSJT-003, RSJT-004

**Files:**

- `apps/api/src/routes/twilio-webhooks.ts`
- `apps/api/src/services/twilio-service.ts`
- `apps/api/src/repositories/conversations-repository.ts`
- `apps/api/src/**/*.test.ts`

### RSJT-013: Customer Intake State Machine And Spam Gate

**Story Points:** 8

**Description:**
Implement conservative SMS intake that collects minimum customer details, short-circuits known fields, and blocks durable CRM creation until spam and minimum-data checks pass.

**Tasks:**

- Define intake states for unknown, identifying, collecting details, matched, ready for owner review, and blocked.
- Ask for first name, last name, phone, email, service address, and issue description only when missing.
- Add basic abuse controls for blocked numbers, excessive message rate, empty/repetitive messages, and suspicious links.
- Use RepairShopr matching to skip known fields for existing customers.
- Stage lead or customer writeback only when minimum information and spam checks pass.

**Acceptance Criteria:**

- [ ] Existing customers are not asked for known details.
- [ ] Unknown customer texts do not create durable RepairShopr records immediately.
- [ ] Intake state survives across messages.
- [ ] Blocked or suspicious conversations are visible to the owner.

**Dependencies:** RSJT-006, RSJT-008, RSJT-012

**Files:**

- `apps/api/src/services/intake-state-machine.ts`
- `apps/api/src/services/spam-gate-service.ts`
- `apps/api/src/routes/conversations.ts`
- `apps/api/src/**/*.test.ts`

### RSJT-014: Live Takeover And Outbound Messaging

**Story Points:** 8

**Description:**
Let Ilya take over customer conversations from the app, send Twilio replies, and pause AI responses until released.

**Tasks:**

- Add takeover state model and API endpoints.
- Build Ilya conversation screen with takeover toggle and outbound composer.
- Send approved Ilya messages through Twilio.
- Pause automated intake replies while takeover is active.
- Add stale takeover warnings for the owner dashboard.

**Acceptance Criteria:**

- [ ] Ilya can activate and release takeover.
- [ ] AI customer replies stop while takeover is active.
- [ ] Ilya outbound messages are persisted and sent through Twilio.
- [ ] Owner dashboard shows takeover state.

**Dependencies:** RSJT-011, RSJT-012, RSJT-013

**Files:**

- `apps/api/src/services/takeover-service.ts`
- `apps/api/src/routes/takeover.ts`
- `apps/mobile/src/features/conversations/*`
- `apps/mobile/app/(ilya)/conversations/*`

### RSJT-015: Scheduling Proposal And Approval

**Story Points:** 5

**Description:**
Support scheduling preference collection and require Ilya approval before customer-facing scheduling commitments or RepairShopr appointment creation.

**Tasks:**

- Extract scheduling preferences from customer and Ilya messages.
- Create staged scheduling message proposals.
- Create staged RepairShopr appointment proposals.
- Build Ilya approval UI for proposed times and customer-facing wording.
- Ensure unapproved scheduling proposals cannot be sent.

**Acceptance Criteria:**

- [ ] Customer-facing messages never confirm time or availability without Ilya approval.
- [ ] Ilya can approve, edit, or reject scheduling proposals.
- [ ] Approved appointment creation is staged for RepairShopr writeback.
- [ ] Scheduling approvals are auditable.

**Dependencies:** RSJT-008, RSJT-013, RSJT-014

**Files:**

- `apps/api/src/services/scheduling-service.ts`
- `apps/api/src/routes/scheduling.ts`
- `apps/mobile/src/features/scheduling/*`
- `apps/api/src/**/*.test.ts`

### RSJT-016: RepairShopr Writeback Execution

**Story Points:** 8

**Description:**
Execute approved RepairShopr writebacks for customers, leads, tickets, ticket comments, and appointments.

**Tasks:**

- Add write methods to the RepairShopr client behind the approval service.
- Implement writeback executors for customer/contact updates, lead creation, ticket creation/commenting, and appointment creation.
- Store request payloads, response IDs, and errors in audit events.
- Add retry behavior for transient failures and manual retry for failed writebacks.
- Add fixture-backed tests for each writeback type.

**Acceptance Criteria:**

- [ ] No RepairShopr writeback can execute without an approved staged change.
- [ ] Successful writebacks persist returned RepairShopr IDs.
- [ ] Failed writebacks are visible and retryable.
- [ ] Tests do not call the live RepairShopr API.

**Dependencies:** RSJT-005, RSJT-008, RSJT-015

**Files:**

- `apps/api/src/integrations/repairshopr/repairshopr-write-client.ts`
- `apps/api/src/services/writeback-service.ts`
- `apps/api/src/routes/writebacks.ts`
- `apps/api/src/**/*.test.ts`

### RSJT-017: Expenses, Profit, And Split Review

**Story Points:** 5

**Description:**
Track charge, reported expenses, reported profit, split categories, and payout readiness in the dashboard.

**Tasks:**

- Add expense entry/edit APIs and mobile forms.
- Add owner review and override flow for charge, expense, and profit inputs.
- Calculate profit from Ilya's reported profit when present, otherwise as gross charge minus reported expenses.
- Apply 30/70, 20/80, or 50/50 split based on split category.
- Add manual split category override with audit event.

**Acceptance Criteria:**

- [ ] Split calculations use Ilya-reported profit when present, otherwise profit after reported expenses.
- [ ] Owner approval is not required for Ilya-reported charge, expense, or profit inputs.
- [ ] Owner can override split category with an audit reason.
- [ ] Payout-ready requires completion plus either reported profit or enough charge/expense detail to calculate profit.

**Dependencies:** RSJT-007, RSJT-008, RSJT-011

**Files:**

- `apps/api/src/services/payout-service.ts`
- `apps/api/src/routes/expenses.ts`
- `apps/mobile/src/features/expenses/*`
- `apps/mobile/src/features/payouts/*`
- `apps/api/src/**/*.test.ts`

### RSJT-018: Closeout Reminders

**Story Points:** 5

**Description:**
Detect accepted or scheduled jobs missing closeout details and prompt Ilya through in-app reminders.

**Tasks:**

- Add reminder rules for missing completion, charge/profit basis, expense detail when needed, and follow-up.
- Add scheduled reminder job runner for local API process.
- Add Ilya reminder inbox and quick resolution actions.
- Add owner visibility into stale jobs.
- Defer push notifications until a development-build need is confirmed.

**Acceptance Criteria:**

- [ ] Accepted or scheduled jobs missing required closeout details produce reminders.
- [ ] Ilya can resolve reminders by filling missing fields.
- [ ] Owner can see stale reminders.
- [ ] Reminder generation is covered by unit tests.

**Dependencies:** RSJT-010, RSJT-011, RSJT-017

**Files:**

- `apps/api/src/services/reminder-service.ts`
- `apps/api/src/jobs/reminder-job.ts`
- `apps/api/src/routes/reminders.ts`
- `apps/mobile/src/features/reminders/*`

### RSJT-019: Contact Cards

**Story Points:** 3

**Description:**
Generate app-accessible contact cards for newly identified customers with enough contact information.

**Tasks:**

- Add vCard generation for name, phone, email, and service address.
- Expose contact card download/share endpoint.
- Add owner mobile action to preview and add contact.
- Link contact card availability to customer identification state.

**Acceptance Criteria:**

- [ ] Newly identified customers with at least name and phone have a contact card.
- [ ] Contact card data matches confirmed intake or RepairShopr fields.
- [ ] Owner can access the contact card from customer/job detail.

**Dependencies:** RSJT-011, RSJT-013

**Files:**

- `apps/api/src/services/contact-card-service.ts`
- `apps/api/src/routes/contact-cards.ts`
- `apps/mobile/src/features/contact-cards/*`

### RSJT-020: End-To-End Smoke And Release Hardening

**Story Points:** 5

**Description:**
Add smoke coverage for the full workflow and document local runbooks for the first usable version.

**Tasks:**

- Add API integration tests for update extraction, matching, approval, writeback staging, Twilio intake, and payout readiness.
- Add mobile smoke tests for owner and Ilya critical paths.
- Add fixture-based end-to-end workflow test with no live external writes.
- Document local setup, webhook tunnel setup, env vars, and manual QA checklist.
- Add production safety checklist for personal deployment.

**Acceptance Criteria:**

- [ ] A fixture workflow exercises customer intake, match review, staged writeback, Ilya update, expense entry, and payout-ready state.
- [ ] Test suite avoids live Twilio, RepairShopr, or AI calls by default.
- [ ] Manual QA checklist covers all PRD acceptance criteria.
- [ ] Deployment notes do not reference Tenex-owned systems.

**Dependencies:** RSJT-012, RSJT-016, RSJT-017, RSJT-018, RSJT-019

**Files:**

- `apps/api/src/**/*.integration.test.ts`
- `apps/mobile/e2e/*`
- `.project-management/0-docs/local-runbook.md`
- `.project-management/0-docs/first-release-checklist.md`

## Milestones

### Milestone 1: Local Walking Skeleton

Tickets: RSJT-001 to RSJT-004

Result: Local app/API/database scaffold, roles, and typed shared contracts.

### Milestone 2: Ilya Update Capture And Matching

Tickets: RSJT-005 to RSJT-011

Result: Ilya can submit updates, extracted facts are reviewed, matches are confirmed, and the owner can see dashboard state.

### Milestone 3: Customer Intake And Takeover

Tickets: RSJT-012 to RSJT-015

Result: Customers can text the Twilio number, intake is conservative, and Ilya can take over or approve scheduling language.

### Milestone 4: RepairShopr Writeback And Reconciliation

Tickets: RSJT-016 to RSJT-020

Result: Approved writebacks execute, expenses and splits reconcile, closeout reminders work, contact cards are available, and smoke coverage validates the v1 workflow.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| RepairShopr API shape differs from assumptions | Verify Swagger against the real account before implementation plans and keep client fixture-backed. |
| AI extracts wrong money or identity facts | Require source evidence, confidence display, and confirmation when confidence is low or values conflict. |
| Twilio webhook payloads evolve | Accept evolving parameters and use official signature validation instead of custom validation. |
| Expo SDK changes before scaffold | Re-check official Expo docs and local skills before RSJT-009 implementation. |
| Push notification behavior requires native builds | Keep v1 reminders in-app unless a development build is explicitly justified. |
| Scope grows into full CRM replacement | Keep RepairShopr as source of truth and stage only operational metadata locally. |

## Review Gates Before Implementation

- [ ] Owner accepts PP01 or requests changes.
- [ ] Local tickets in `.project-management/5-local-tickets/` match PP01.
- [ ] Implementation plans are created and reviewed to 90%+ before any scaffold or code implementation.
- [ ] Expo docs are checked again immediately before mobile scaffold.
- [ ] RepairShopr Swagger is checked against the actual account before writeback implementation planning.
