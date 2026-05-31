# First Release Checklist

## Required Verification

Run all checks from the repo root:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm --filter @rsjt/mobile lint
git diff --check
rg -n $'\u2014' apps packages
rg -n "Il""ya|own""er|Own""er" apps/api/src apps/mobile/src packages/shared/src packages/db/src
rg -n "TO""DO|FIX""ME|as ""any|@ts""-ignore|console\\.""log" apps/api/src apps/mobile/src packages/shared/src packages/db/src
```

If local Postgres access is blocked by the shell sandbox, rerun tests with local Postgres access.

## Safety Defaults

Confirm these values before any non-local test:

- `MESSAGING_OUTBOUND_ENABLED=false`
- `REPAIRSHOPR_WRITEBACK_ENABLED=false`
- `MESSAGING_TEST_RECIPIENT_ALLOWLIST` contains only test numbers.
- `REPAIRSHOPR_WRITEBACK_TEST_RECORD_ALLOWLIST` contains only approved test records.
- `.env` is not committed.
- No live customer phone number is used in fixture tests.
- No API key is present in screenshots, logs, test fixtures, or docs.

## Database Readiness

- Local migrations apply cleanly.
- Seeded manager and tech users can sign in.
- No migration is pending after `pnpm --filter @rsjt/db migrate`.
- Local smoke tests do not require data outside the seed and fixture records.

## API Readiness

- `/health` returns `{ "ok": true }`.
- Auth routes accept seeded local credentials.
- Twilio webhook routes return fixture-safe responses in tests.
- Match routes can search, list, select, and clear candidates.
- Approval routes create, edit, approve, reject, and expire approvals.
- Writeback routes stay fixture-backed unless live-write safety settings are explicitly enabled.
- Money routes produce payout-ready state when completion and money details are sufficient.
- Reminder routes generate, list, resolve, and show stale reminders.
- Contact card routes return availability without writing externally.

## Mobile Readiness

- Manager dashboard loads.
- Tech dashboard loads.
- Manager and tech money screens load.
- Reminder inbox and stale reminder screens load.
- Contact card preview loads.
- The mobile API smoke tests pass with mocked `fetch`.
- Expo web preview is optional for this release because existing shared barrel resolution blocks Metro web preview.

## Manual QA Pass

Use the local runbook to complete:

- Manager sign-in.
- Tech sign-in.
- Customer intake fixture.
- Match review and selection.
- Approval review.
- Writeback staging and blocked live-write check.
- Tech update extraction.
- Expense entry and payout readiness.
- Closeout reminders.
- Contact card availability.

## Release Decision

Release is allowed only if:

- All required verification commands pass.
- Manual QA has no stop-condition failures.
- Live messaging remains disabled unless the current test recipient is explicitly approved.
- Live RepairShopr writes remain disabled unless the current test record is explicitly approved.
- The final diff contains no project-management references to external tooling as required infrastructure.

## Rollback

If the first usable version behaves unexpectedly:

1. Stop the API process.
2. Stop the mobile dev session.
3. Disable tunnel forwarding.
4. Reset external webhook URLs to a safe inactive endpoint.
5. Keep `MESSAGING_OUTBOUND_ENABLED=false`.
6. Keep `REPAIRSHOPR_WRITEBACK_ENABLED=false`.
7. File the follow-up as a local revision plan under `.project-management/4-revisions/`.
