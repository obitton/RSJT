# REV02: Audit remediation

Status: Wave 1 (slices 0, 1, 2, 3, 5) ran and all five slices were accepted on 2026-09-24. Their branches are pushed to origin and not merged. Current state and next steps are in REV02-handoff-2026-09-24-cloud.md next to this file.
Date: 2026-09-08
Owner: Ofir
Source: code-quality audit run on 2026-09-08 against main at 87ebafe
Revision: rewritten the same day after three independent read-only reviews of the first draft (executor ambiguity, technical fact-check, parallel-execution safety). Every count and line number below was re-verified against the code in that pass.
Executor: implementation agents, one per slice, each in its own git worktree. Reviewer: a stronger model reviews every slice report and diff before merge.

This document is the whole plan. An executor reads section 0 (the contract), section 1 (preflight results), and its own slice. Nothing else is required and nothing else should be improvised.

## 0. Executor contract

Read this twice before touching a file.

### 0.1 Scope lock

- You are assigned exactly one slice. Change only files listed under that slice's "Files you may change". Creating a file counts as changing it.
- If the fix appears to need a file outside your list, stop and write it up under "Open questions" in your report. Do not edit it. Do not work around it.
- Do not fix, tidy, rename, or reformat anything you were not told to. If you notice something, put it under "Noticed, not changed" in your report.
- Do not add abstractions, helpers, options, or configuration beyond the ones named in your slice.

### 0.2 Never do these

- Do not add, remove, or upgrade dependencies unless your slice says so with the exact command. Never edit pnpm-lock.yaml by hand.
- Do not run `biome check --write .` or `pnpm lint:fix` across the repo. Run `pnpm lint` and fix only the reports in files you changed.
- Do not edit any file under `.agents/`, `skills-lock.json`, or any `.sql` file under `packages/db/src/migrations/`.
- Do not change the shape of `ApiConfig` (apps/api/src/config.ts), `AppOptions` (apps/api/src/app.ts), any route path, or any shared DTO type unless your slice names it.
- Do not introduce `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, `biome-ignore`, or `eslint-disable`. The repo has exactly one `as unknown as` today, at apps/api/src/integrations/twilio/twilio-outbound-messenger.ts:61; leave it exactly as it is.
- Do not add TODO or FIXME comments. Either do the work or report it.
- Do not use em dashes anywhere: code, comments, docs, commit messages, PR text. AGENTS.md forbids them. Use a comma, a colon, or a new sentence.
- Do not use Linear, Notion, Slack, Gmail, Drive, or any Tenex system. AGENTS.md forbids them for this project.
- Do not send messages, hit Twilio, hit RepairShopr, or call any AI provider. All tests are fixture-backed and stay that way.
- Do not run `expo prebuild`, `pod install`, or anything that creates `ios/` or `android/` folders.

### 0.3 Facts about this repo that trip people up

- Run every shell snippet in this plan from Git Bash, not PowerShell. Inline `VAR=value command`, process substitution `<(...)`, and `/tmp` are bash features; `/tmp` in Git Bash is the Windows temp directory.
- Packages `apps/api`, `packages/db`, `packages/shared` are ESM. Every relative import ends in `.js` even though the file is `.ts` (example: `import { x } from "./config.js"`). The mobile app uses the `@/` alias with no extension.
- apps/api, packages/db, and packages/shared extend tsconfig.base.json: strict plus `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. There, `{ foo: undefined }` is not assignable to `{ foo?: string }` (the codebase uses conditional spreads: `...(value ? { value } : {})`) and array indexing returns `T | undefined`. apps/mobile extends expo/tsconfig.base with `strict: true` only; neither extra flag is on there.
- zod is version 3.25, not 4. `z.string().datetime({ offset: true })`, `z.coerce.date()`, `.safeParse`, and `.options` on `z.enum` all exist. Do not use zod 4 APIs such as `z.iso`.
- Fastify 5 with `@fastify/sensible`: throw `app.httpErrors.notFound("...")` and friends. Tests call `app.inject(...)`.
- Repository tests connect to a real Postgres and clean up their own rows. They read `DATABASE_URL` and fall back to `postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev`. There is no skip guard; without Postgres, `pnpm test` fails. Several tests assert on unscoped global lists, so two slices must never run tests against the same database at the same time (section 1 gives each slice its own).
- The local Postgres container is named `rsjt-postgres-1` when `pnpm db:up` went through Docker Compose and `rsjt_postgres` when it fell back to `docker run`. Resolve the name with `docker ps --filter "publish=54329" --format "{{.Names}}"` instead of hard-coding it.
- The mobile app is Expo 54, expo-router 6, React 19.1 with the React Compiler experiment enabled. Write plain function components with hooks at the top. Some screens already use `useCallback`; leave every existing one exactly as it is and do not add new ones. `StyleSheet.create` stays at module scope.
- The mobile package does not list `zod` as a dependency. It reaches shared zod schemas through `@rsjt/shared`. Never write `import { z } from "zod"` in apps/mobile.
- Biome formats with two-space indent, double quotes, trailing commas. `.gitattributes` forces LF. If your editor writes CRLF, git normalizes on commit, but run `git diff --check` anyway.
- The local runbook is `.project-management/0-docs/local-runbook.md`. The seeded logins are `manager` / `manager-dev` and `tech` / `tech-dev`.

### 0.4 Verification is mandatory

Every slice ends with the commands in its "Verify" list. Paste the exit code and the last five lines of each into your report. "It should work" is not a result. If a command is red for a reason you think is unrelated to your change, compare against the preflight baseline in section 1; if it was green there, your change broke it.

Every verify command that touches Postgres runs with your slice's own database exported, for example `DATABASE_URL=postgres://rsjt:rsjt_local@localhost:54329/rsjt_slice5 pnpm --filter @rsjt/api test`. Section 1 creates those databases. An exported variable wins over the value in `.env` (Node's `--env-file-if-exists` does not override variables already in the environment), so the api and db scripts honor it. Paste the value you used in your report.

### 0.5 Worktree, branch, commit

- Each executor works in its own git worktree so parallel slices never share a checkout. From the shared clone: `git worktree add ../rsjt-sliceN -b rev02-sliceN-short-name main`, then `cd ../rsjt-sliceN && pnpm install --frozen-lockfile`. Never run two slices in one working tree. Report the worktree path.
- Branch names follow the rev01 convention: `rev02-sliceN-short-name`.
- Commit on your branch when the slice is done and verified. Commit messages are one imperative sentence, like the existing history ("Add cancel-job action with a reason for techs and managers"), followed by a blank line and the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Do not push, do not open a PR, and do not merge. The branch stays local. The reviewer reads your report and the diff, and Ofir decides when branches are pushed and PRs opened.
- If the reviewer merges an earlier slice of your wave into local `main` while you are still working, you will be told; rebase on `main`, re-run your full Verify list, and append the new exit codes to the report. The reviewer does not accept a slice whose last verify run predates the current `main`.

### 0.6 Report template

Return exactly this, filled in. No summary paragraphs before or after.

```
## Slice N report: <name>
Branch: rev02-sliceN-<name> (base: main @ <sha>), worktree: <path>
DATABASE_URL used: <value or "none">
Files changed: <one per line, prefixed M / A / D>
Verification:
- pnpm lint: exit <code>; last lines: <...>
- pnpm typecheck: exit <code>; last lines: <...>
- pnpm test (or the filtered form your slice's Verify list names): exit <code>; <N> files, <M> tests; last lines: <...>
- pnpm --filter @rsjt/mobile lint: exit <code> (only if a file under apps/mobile changed; otherwise write "not applicable")
- <slice-specific checks, one per line>
- git diff --check: exit <code>
- em dashes: output of `git diff --name-only main...HEAD | xargs grep -n $'\u2014'` (must be empty)
Slice artifacts (fill the ones your slice names, write "not applicable" for the rest):
- Drift diff (slice 3):
- client.ts line count (slice 4):
- Line delta (slices 5 and 6):
Deviations from the plan: none | <each one with the reason>
Predicted behavior changes present: <list from your slice, or none>
Noticed, not changed: <list or none>
Open questions: <list or none>
Confirmations: only listed files touched; no dependency changes (or: exactly the ones the slice named); no new any/as unknown as/ts-ignore/TODO; scratch folders removed.
```

### 0.7 Stop and ask when

- A test fails and two honest attempts have not explained it.
- A file outside your list needs to change.
- A command in this plan does not exist or behaves differently from what the plan says.
- A stated fact in this plan turns out to be wrong (say which one).
- You are about to make a judgment call the plan did not make for you.

Stopping early with a clear report is the correct outcome in all five cases. Guessing is not.

## 1. Preflight (wave 0)

Run once on the shared clone, before any worktree exists. Record the results at the bottom of this section. No slice starts until every item is green, and the reviewer pastes the filled-in block into every dispatch.

1. Toolchain. `node --version` must be 22.9 or newer (the api scripts use `--env-file-if-exists`). `pnpm --version` must print 9.15.4. The repo pins `packageManager: pnpm@9.15.4`; a newer global pnpm downloads 9.15.4 on first use, which needs registry access. Use `corepack enable && corepack prepare pnpm@9.15.4 --activate` if that download is blocked.
2. Registry. `curl -sS -o /dev/null -w '%{http_code}' https://registry.npmjs.org/react` must print 200. On 2026-09-08 this machine got connection resets from the registry; nothing below works until that is fixed. Every worktree also needs registry access for its own `pnpm install`.
3. Install. `pnpm install --frozen-lockfile` from the repo root, exit 0. If it wants to change the lockfile, stop; the lockfile is not yours to change.
4. Database. Docker Desktop running, then `pnpm db:up`, then `pnpm --filter @rsjt/db migrate`, then `pnpm --filter @rsjt/db seed`. All exit 0, with one exception: the seed script inserts jobs and conversations with fixed ids and no conflict handling, so on a database that was seeded earlier it fails with a duplicate-key error. On `rsjt_dev` that failure means "already seeded" and counts as green; record it as such. Then create one database per slice in the wave about to be dispatched, so parallel test runs never share tables (these are fresh, so their seed runs exactly once):

   ```bash
   PG=$(docker ps --filter "publish=54329" --format "{{.Names}}")
   for N in 1 2 3 5; do
     docker exec "$PG" psql -U rsjt -d postgres -c "CREATE DATABASE rsjt_slice$N;"
     DATABASE_URL=postgres://rsjt:rsjt_local@localhost:54329/rsjt_slice$N pnpm --filter @rsjt/db migrate
     DATABASE_URL=postgres://rsjt:rsjt_local@localhost:54329/rsjt_slice$N pnpm --filter @rsjt/db seed
   done
   ```

   Repeat with `4 7` before wave 2 and `6` before wave 3. Slice 0 needs no database.
5. Baseline. Run each and record exit code and summary line:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm --filter @rsjt/mobile lint`
   - `CI=1 pnpm --filter @rsjt/mobile exec expo export --platform ios --output-dir ../../.scratch-export`, then `rm -rf .scratch-export` from the root. The `CI=1` prefix keeps Expo non-interactive. This is the Metro bundling check used by slices 4, 6, and 7. Record pass or fail; a baseline failure here is not a bug to fix, it is the baseline to compare against.
6. Git. `git status --porcelain` shows nothing, or only this plan file if it is not yet committed. On `main`, `git pull --ff-only` clean.

Preflight results (fill in):

```
date: 2026-09-23
node: v24.13.1
pnpm: 9.15.4
install: exit 0 (pnpm install --frozen-lockfile, no lockfile change)
db up / migrate / seed: exit 0 / 0 / 0 (container rsjt-postgres-1, fresh volume, first seed)
per-slice databases created: rsjt_slice1, rsjt_slice2, rsjt_slice3, rsjt_slice5 (each migrated and seeded, exit 0)
lint: exit 0 (biome check, 213 files)
typecheck: exit 0 (shared, mobile, db, api)
test: exit 0 (52 files / 311 tests: api 47 files 257 tests against rsjt_dev, shared 1/35, db 1/10, mobile 3/9)
mobile lint: exit 0 (expo lint)
expo export ios: exit 0 (run with CI=1, output folder removed, tree clean)
```

## 2. Waves and merge order

| Wave | Slice | Area | Files it owns | Depends on |
|---|---|---|---|---|
| 1 | 0 | CI workflow | .github/workflows/ci.yml | preflight |
| 1 | 1 | Config safety | apps/api config, messenger, two tests, three doc edits | preflight |
| 1 | 2 | Canceled label bug | three mobile format files, one new test | preflight |
| 1 | 3 | Migration snapshots | packages/db meta, migrate.ts, one script | preflight |
| 1 | 5 | API deduplication | api repositories and their sibling tests, api route tests | preflight |
| 2 | 4 | Mobile parsers to shared schemas | packages/shared, mobile client, mobile parser files | slices 0, 1, 5 merged and preflight step 5 green on main |
| 2 | 7 | Tooling and docs | root scripts, .gitignore, docs, assets, one dependency | slices 1 and 4 merged (it edits a file slice 1 edited and rewrites a line slice 4 justifies) |
| 3 | 6 | Mobile screen deduplication | mobile components, hooks, screens | slices 2 and 4 merged |

Slices in the same wave touch disjoint files and run in parallel, each in its own worktree with its own database. Merge order inside a wave: slice 0 first, then by slice number. Within wave 2, slice 4 merges before slice 7.

After every merge, each remaining executor in that wave rebases and re-verifies (0.5). After the last merge of a wave, the reviewer re-runs preflight step 5 on `main` and creates the next wave's databases before dispatching it.

Slice 1 and slice 5 both live in apps/api. They stay disjoint because slice 1 does not change the `ApiConfig` type and slice 5 does not touch config.ts, the messenger, or app.ts. Keep it that way.

## 3. Slices

### Slice 0: CI workflow

Audit finding: there is no `.github/` directory, no CI, and no git hooks, so the first-release-checklist commands are never enforced. This slice lands first so every later PR, including the largest one (slice 4), is gated.

Files you may change:

- .github/workflows/ci.yml (new)

Steps:

1. Create the file with exactly this content:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: rsjt_dev
          POSTGRES_USER: rsjt
          POSTGRES_PASSWORD: rsjt_local
        ports:
          - 54329:5432
        options: >-
          --health-cmd "pg_isready -U rsjt"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @rsjt/db migrate
      - run: pnpm --filter @rsjt/db seed
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm --filter @rsjt/mobile lint
      - run: pnpm --filter @rsjt/mobile exec expo export --platform ios --output-dir ../../.scratch-export
      - run: git diff --check "$(git merge-base origin/main HEAD)" HEAD
```

   Notes for the executor: `pnpm/action-setup@v4` reads the `packageManager` field, so the pnpm version is not repeated. It must come before `actions/setup-node` because that step caches the pnpm store. The seed step mirrors the local baseline in section 1. The last step compares against the merge base because a bare `git diff --check` on a fresh checkout compares nothing; `fetch-depth: 0` is what makes `origin/main` available.

Traps:

- Do not add a `prepare` script or husky; CI is the enforcement. Hooks change every contributor's local flow, which is a decision for Ofir.
- Do not drop the Postgres service or the migrate step. `pnpm test` includes the repository tests.

Verify: the branch is not pushed, so the workflow cannot run yet. Verify locally that the file matches the block above byte for byte (save the block to a scratch file and `diff` the two), that `pnpm lint` still exits 0 (Biome ignores YAML, so this only proves nothing else changed), and that `git status --porcelain` shows only the new file. Paste the diff result (empty) into the report.

Done when: the file is committed and matches the block. The green-run check happens on the first push; the reviewer records it in section 1 at that point. If the run then fails because `pnpm/action-setup` cannot download pnpm 9.15.4 on the runner, or `expo export` fails there while it passed in preflight, that is a follow-up for the reviewer, not a reason to change this file.

### Slice 1: Config safety

Audit findings this fixes:

- apps/api/src/config.ts:15 and :28 parse `REPAIRSHOPR_WRITEBACK_ENABLED` and `MESSAGING_OUTBOUND_ENABLED` with `z.coerce.boolean()`. zod's boolean coercion is `Boolean(input)`, so the string `"false"` becomes `true`. With Twilio or RepairShopr credentials present, the documented `=false` setting enables live sends and CRM writes.
- `MESSAGING_TEST_RECIPIENT_ALLOWLIST` is parsed at config.ts:29 and never read by any other code. The README, .env.example, and first-release-checklist all describe it as the guard for outbound testing.
- Copying .env.example verbatim crashes `loadConfig`: Node's `--env-file` turns `REPAIRSHOPR_API_KEY=` into an empty string, and `z.string().min(1).optional()` rejects empty strings.
- No test covers config parsing.

Files you may change:

- apps/api/src/config.ts
- apps/api/src/config.test.ts (new)
- apps/api/src/app.ts (line 7 and the local `parseAllowlist` function only)
- apps/api/src/integrations/twilio/twilio-outbound-messenger.ts
- apps/api/src/integrations/twilio/twilio-outbound-messenger.test.ts
- .env.example (one added comment line)
- README.md (lines 20 and 21 only, the two bullets under "Local Credentials" for MESSAGING_OUTBOUND_ENABLED and MESSAGING_TEST_RECIPIENT_ALLOWLIST)
- .project-management/0-docs/first-release-checklist.md (one line in the "Safety Defaults" list, replaced one-for-one)

Steps:

1. In config.ts, add these two helpers above `ConfigSchema`:

```ts
// Env values are strings. Boolean("false") is true, so z.coerce.boolean() is unsafe here.
const EnvBoolean = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return value;
}, z.boolean());

export function parseAllowlist(value: string | undefined) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
```

2. Replace the two coerced booleans. The output types must not change (`REPAIRSHOPR_WRITEBACK_ENABLED` stays `boolean | undefined`, `MESSAGING_OUTBOUND_ENABLED` stays `boolean`):

```ts
  REPAIRSHOPR_WRITEBACK_ENABLED: EnvBoolean.optional(),
  MESSAGING_OUTBOUND_ENABLED: EnvBoolean.default(false),
```

3. Make `loadConfig` drop empty strings before parsing so an empty value behaves like an unset one:

```ts
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const withoutEmptyValues = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== ""),
  );
  return ConfigSchema.parse(withoutEmptyValues);
}
```

4. In app.ts, delete the local `parseAllowlist` function at line 435 (immediately after `createDefaultCustomerMessageExecutor`; more functions follow it, so do not look at the end of the file). Change line 7 from `import type { ApiConfig } from "./config.js";` to `import { type ApiConfig, parseAllowlist } from "./config.js";`. Nothing else in app.ts changes.

5. In twilio-outbound-messenger.ts:
   - Add `| "MESSAGING_TEST_RECIPIENT_ALLOWLIST"` to the `TwilioOutboundConfig` Pick.
   - Import `parseAllowlist` from `../../config.js`.
   - In `send`, directly after the `if (!this.isEnabled()) { ... }` block and before `chooseSender`, add:

```ts
    if (!this.isRecipientAllowed(input.toExternalPhone)) {
      return {
        kind: "disabled",
        reason: "Recipient is not in MESSAGING_TEST_RECIPIENT_ALLOWLIST",
      };
    }
```

   - Add the method and the module-level helper:

```ts
  private isRecipientAllowed(toExternalPhone: string) {
    const allowlist = parseAllowlist(
      this.config.MESSAGING_TEST_RECIPIENT_ALLOWLIST,
    );
    if (allowlist.includes("*")) {
      return true;
    }
    return allowlist.some(
      (entry) =>
        normalizeRecipient(entry) === normalizeRecipient(toExternalPhone),
    );
  }
```

```ts
function normalizeRecipient(value: string) {
  return value.trim().replace(/^whatsapp:/i, "");
}
```

   Semantics, stated once: outbound enabled plus an empty allowlist blocks every send. `*` allows every recipient and is the explicit switch for real production use. Do not put this check inside `isEnabled()`; the services call `isEnabled()` before they know the recipient, and `live-takeover-service.ts:157` and `writeback-execution-service.ts:343` already handle a `disabled` result by marking the draft message blocked with the reason. No service file changes.

6. Update the messenger tests. Three existing tests set `MESSAGING_OUTBOUND_ENABLED: true` and send to `+15555550100` with no allowlist: the messaging-service-SID test (line 35), the underlying-error test (line 68), and the no-sender-configured test (line 93). Because the new check runs before `chooseSender`, all three would now return `disabled`. Add `MESSAGING_TEST_RECIPIENT_ALLOWLIST: "+15555550100"` to all three configs and change no assertion. Then add four tests: a recipient missing from a non-empty allowlist returns `disabled` with the reason above and never calls the client factory; enabled with no allowlist returns `disabled`; `*` sends; allowlist `"+15555550100"` matches recipient `"whatsapp:+15555550100"`.

7. Create config.test.ts using `loadConfig({ DATABASE_URL: "postgres://x", ...overrides })`:
   - `MESSAGING_OUTBOUND_ENABLED` as `"false"`, `"FALSE"`, `"0"` parse to `false`; `"true"`, `"1"` parse to `true`; `"yes"` throws; unset is `false`.
   - `REPAIRSHOPR_WRITEBACK_ENABLED` unset is `undefined`; `"false"` is `false`.
   - `REPAIRSHOPR_API_KEY: ""` parses to `undefined`.
   - `DATABASE_URL: ""` throws.
   - `API_PORT: ""` parses to `47630`.

8. Docs, each a one-line change:
   - .env.example: add one comment line above `MESSAGING_TEST_RECIPIENT_ALLOWLIST`: `# Comma-separated recipients allowed while outbound is enabled. Empty blocks all sends. * allows all.`
   - README.md line 21 (the allowlist bullet): rewrite to one sentence saying the same thing as that comment.
   - README.md line 20 (the MESSAGING_OUTBOUND_ENABLED bullet): append the sentence `Boolean flags accept only true, false, 1, or 0.` Do not add or remove bullets.
   - first-release-checklist.md, the "Safety Defaults" line about `MESSAGING_TEST_RECIPIENT_ALLOWLIST`: replace it with `- MESSAGING_TEST_RECIPIENT_ALLOWLIST contains only test numbers, or is empty, which blocks every send.` Replace one line with one line; slice 7 later edits this file by content anchor and must not find the file re-flowed.

Traps:

- `z.preprocess(...).default(false)`: zod substitutes the default before the preprocess sees the value, so the preprocess must pass non-strings through unchanged. The code above does that. Do not "simplify" it to `z.coerce`.
- Keep `.optional()` on `REPAIRSHOPR_WRITEBACK_ENABLED`. Making it required changes `ApiConfig` and breaks the `testConfig()` literals in apps/api/src/tests, which slice 5 owns.
- Biome will flag the now-unused `parseAllowlist` in app.ts if you forget to delete it, and an unused import if you delete both.
- The messenger file contains the repo's one `as unknown as` (line 61). It stays.

Verify: `pnpm --filter @rsjt/api test` (all files, with your slice database exported), `pnpm lint`, `pnpm typecheck`.

Done when: the five config tests and the four new messenger tests pass, existing tests pass with only the three allowlist additions, and no file outside the list changed.

### Slice 2: Canceled job label

Audit finding: `JobState` gained `"canceled"` in commit 0ea3469. `formatJobStateLabel` in apps/mobile/src/dashboard/dashboard-format.ts:56 has the case (at lines 72 and 73); `formatReminderState` in apps/mobile/src/reminders/reminder-format.ts:20 and `formatJobState` in apps/mobile/src/jobs/fact-format.ts:3 do not. Both switches have no default, so TypeScript widens the return to `string | undefined` and the reminder screens render nothing for a canceled job. Reminders are not filtered by job state (apps/api/src/repositories/reminders-repository.ts:201, `listJoinedReminders`), so the case is reachable.

Files you may change:

- apps/mobile/src/dashboard/dashboard-format.ts
- apps/mobile/src/reminders/reminder-format.ts
- apps/mobile/src/jobs/fact-format.ts
- apps/mobile/src/dashboard/dashboard-format.test.ts (new)

Steps:

1. In dashboard-format.ts, `formatJobStateLabel` already handles `"canceled"` at lines 72 and 73. Add only a default clause after that last case, so the next missing case fails typecheck:

```ts
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
```

   Do not paste a second `case "canceled"`; Biome's `noDuplicateCase` would fail lint.

2. In fact-format.ts, delete the body of `formatJobState` and delegate. Keep the export name so call sites do not change:

```ts
import { formatJobStateLabel } from "@/dashboard/dashboard-format";

export function formatJobState(state: JobState) {
  return formatJobStateLabel(state);
}
```

3. Same in reminder-format.ts for `formatReminderState`.

4. Create dashboard-format.test.ts with one test: for every value in `JobStateSchema.options` (import from `@rsjt/shared`), `formatJobStateLabel(state)` is a non-empty string. This test exists so the switch cannot regress even if someone later removes the `never` guard.

Traps:

- Do not move `formatJobStateLabel` to a new file; the two importing files just call it. Moving it changes more files than the slice owns.
- `JobStateSchema` is already imported by other files inside packages/shared. Nothing in apps/mobile imports it yet; importing it in the new test is fine.

Verify: `pnpm --filter @rsjt/mobile typecheck`, `pnpm --filter @rsjt/mobile test`, `pnpm --filter @rsjt/mobile lint`, `pnpm lint`.

Done when: the two delegating functions compile, the new test passes, and the reminder screens have no code change (they already call the two functions).

### Slice 3: Migration snapshots and migrate path

Audit finding: packages/db/src/migrations/meta holds snapshots for 0000 and 0001 only. Migrations 0002 through 0011 were added without snapshots, and the journal's `when` values for 0003 to 0011 are hand-typed round numbers. drizzle-kit diffs `schema.ts` against the newest snapshot, so `pnpm --filter @rsjt/db generate` would emit a migration that repeats everything since 0001. Separately, migrate.ts:13 passes the cwd-relative path `src/migrations`, which only works when run from packages/db.

Files you may change:

- packages/db/src/migrations/meta/0011_snapshot.json (new)
- packages/db/src/migrate.ts
- packages/db/package.json (add one script)
- packages/db/drizzle.fresh.config.ts (temporary, only if step 1's fallback is needed, deleted in step 6)

You may not commit a change to any `.sql` file, `_journal.json`, or `schema.ts`. If a drizzle-kit command writes to them during this slice, restore them with `git checkout -- <path>` and say so in the report. If the drift check in step 3 finds a difference, you report it; you do not fix it.

Steps:

1. Generate a fresh snapshot with no history, so drizzle-kit never asks a rename question (it would, interactively, because migration 0002 renamed a column and the 0001 snapshot predates that):

```bash
pnpm --filter @rsjt/db exec drizzle-kit generate --dialect postgresql --schema ./src/schema.ts --out ./.fresh
```

   This writes `packages/db/.fresh/0000_<name>.sql` (a full CREATE script for the current schema.ts) and `packages/db/.fresh/meta/0000_snapshot.json`. If drizzle-kit refuses to combine command-line flags with the existing drizzle.config.ts, create `packages/db/drizzle.fresh.config.ts` as a copy of drizzle.config.ts with `out: "./.fresh"` and run `pnpm --filter @rsjt/db exec drizzle-kit generate --config drizzle.fresh.config.ts`. If it prompts for anything, stop and report.

2. Copy `packages/db/.fresh/meta/0000_snapshot.json` to `packages/db/src/migrations/meta/0011_snapshot.json`. In the copy, set `"prevId"` to the `"id"` value at the top of `0001_snapshot.json`. Leave `"id"` as generated.

3. Drift check between the cumulative migrations and schema.ts, using two scratch databases in the running local Postgres container. Git Bash only:

```bash
PG=$(docker ps --filter "publish=54329" --format "{{.Names}}")
FRESH=$(ls packages/db/.fresh/0000_*.sql)
OUT=/tmp/rsjt-drift
mkdir -p "$OUT"
docker exec "$PG" psql -U rsjt -d postgres -c 'DROP DATABASE IF EXISTS rsjt_from_migrations;' -c 'DROP DATABASE IF EXISTS rsjt_from_schema;' -c 'CREATE DATABASE rsjt_from_migrations;' -c 'CREATE DATABASE rsjt_from_schema;'
DATABASE_URL=postgres://rsjt:rsjt_local@localhost:54329/rsjt_from_migrations pnpm --filter @rsjt/db migrate
docker exec -i "$PG" psql -U rsjt -d rsjt_from_schema < "$FRESH"
docker exec "$PG" pg_dump -U rsjt --schema-only --no-owner --no-privileges rsjt_from_migrations | grep -v '^--' | grep -v '^$' | sort > "$OUT/from-migrations.sql"
docker exec "$PG" pg_dump -U rsjt --schema-only --no-owner --no-privileges rsjt_from_schema | grep -v '^--' | grep -v '^$' | sort > "$OUT/from-schema.sql"
diff "$OUT/from-migrations.sql" "$OUT/from-schema.sql"
```

   If `$PG` is empty, stop and report. The fresh SQL file contains `--> statement-breakpoint` lines; psql treats them as comments. Expected differences: the `drizzle.__drizzle_migrations` table exists only in the migrations database, and enum values may be listed in a different order for `job_state` because 0010 appended `canceled`. Anything else (a column, a default, an index, a constraint, a nullability) is drift. Paste the full diff into the report under "Drift diff" either way.

4. Fix migrate.ts so it works from any cwd:

```ts
import { fileURLToPath } from "node:url";
// ...
const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));
await migrate(db, { migrationsFolder });
```

5. Add `"check": "drizzle-kit check"` to packages/db/package.json scripts.

6. Clean up: `rm -rf packages/db/.fresh`, delete `drizzle.fresh.config.ts` if you created it, drop the two scratch databases with the same `docker exec "$PG" psql` pattern, and `rm -rf /tmp/rsjt-drift`.

Verify:

- `pnpm --filter @rsjt/db generate` prints that there are no schema changes and creates no file. If it creates a `0012_*.sql`, delete it, restore the journal with `git checkout -- packages/db/src/migrations/meta/_journal.json`, and report; the snapshot did not take.
- `pnpm --filter @rsjt/db check` exits 0.
- cwd independence: `cd apps/api && DATABASE_URL=postgres://rsjt:rsjt_local@localhost:54329/rsjt_slice3 pnpm exec tsx ../../packages/db/src/migrate.ts` exits 0 (tsx is a devDependency of apps/api). Before the fix this fails because `src/migrations` resolves under apps/api.
- `DATABASE_URL=postgres://rsjt:rsjt_local@localhost:54329/rsjt_slice3 pnpm --filter @rsjt/db test`, `pnpm lint`, `pnpm typecheck`.
- `git status --porcelain` shows only the files you own.

Done when: generate is a no-op, check passes, the drift diff is in the report, and `.fresh`, the scratch databases, and the temp folder are gone.

### Slice 4: Mobile parsers to shared schemas

Audit findings: nine hand-written parser files under apps/mobile/src/*/-validation.ts (2,488 lines, no zod) re-implement response shapes that already exist as zod schemas in packages/shared. The written reason (IP01.9: Metro could not resolve the shared barrel) was solved by apps/mobile/metro.config.js, and apps/mobile/src/writebacks/writeback-validation.ts:11 already imports a shared schema at runtime. The copies are looser than the schemas, disagree with each other about the same field, and get skipped when the schema changes (slice 2 is one consequence). The only real obstacle is that shared response schemas use `z.date()` while JSON carries ISO strings.

Files you may change:

- packages/shared/src/domain/json-date.ts (new)
- packages/shared/src/index.ts (export the new file)
- packages/shared/src/domain/approvals.ts, conversations.ts, dashboard.ts, intake.ts, job-money.ts, jobs.ts, messaging.ts, reminders.ts, scheduling.ts, writebacks.ts (only to replace `z.date()`)
- packages/shared/src/domain/users.ts (only to add `AuthSessionResponseSchema`)
- packages/shared/src/domain/domain.test.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/auth/session-storage.ts
- apps/mobile/e2e/critical-paths.test.ts (add one test)
- Delete: the nine `*-validation.ts` files and apps/mobile/src/jobs/job-validation.test.ts

No other file under packages/shared/src/domain may appear in the diff.

Steps:

1. Create packages/shared/src/domain/json-date.ts:

```ts
import { z } from "zod";

// Dates are Date objects on the API side and ISO strings once serialized to JSON.
// Both parse to a Date so one schema validates API output and mobile input.
export const JsonDateSchema = z.union([
  z.date(),
  z
    .string()
    .datetime({ offset: true })
    .transform((value) => new Date(value)),
]);
```

   Add `export * from "./domain/json-date.js";` to packages/shared/src/index.ts.

2. In the ten domain files listed above (36 occurrences in total), replace each `z.date()` with `JsonDateSchema` and add `import { JsonDateSchema } from "./json-date.js";`. Chained `.nullable()` and `.optional()` stay as they are. Inferred TypeScript types do not change (still `Date`). No request schema uses `z.date()`, so nothing changes for API-side parsing of request bodies.

3. In packages/shared/src/domain/users.ts add, next to `LoginResponseSchema`:

```ts
export const AuthSessionResponseSchema = z.object({
  user: SessionUserSchema,
});
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
```

   The API's `GET /auth/session` returns exactly `{ user }` (apps/api/src/routes/auth-routes.ts:24). apps/mobile/src/api/client.ts:78 defines a local `AuthSessionResponse` type; delete it and import the shared one.

4. In domain.test.ts: the valid dashboard object is passed inline at line 151 inside `it("parses a manager dashboard response with groups and takeover")`. Lift that object into a module-level `function validDashboardFixture()` above the describe block and have the existing test call it (its only change). Then add four tests: `JsonDateSchema` parses a `Date` to an equal `Date`; parses `"2026-05-20T12:00:00.000Z"` to a `Date` with that instant; rejects `"not a date"`; and `ManagerDashboardResponseSchema.parse(JSON.parse(JSON.stringify(validDashboardFixture())))` succeeds.

5. In client.ts add one generic wrapper. The structural type is deliberate: mobile does not depend on zod directly, so it cannot import `ZodType`.

```ts
type ResponseSchema<T> = {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T } | { success: false; error: unknown };
};

function parseWith<T>(label: string, schema: ResponseSchema<T>) {
  return (payload: unknown): T => {
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new ApiError(0, `Unexpected ${label} response`, payload);
    }
    return result.data;
  };
}
```

6. Replace every `parseXResponse` function in client.ts with a `parseWith` call bound to the shared schema. There are 23 of them, from `parseLoginResponse` at line 616 through `parseWritebackExecutionResponse`, which starts at line 814. `parseErrorPayload` at line 604 parses error bodies, is not one of them, and stays. Mapping, client function to shared schema:

   - parseLoginResponse: LoginResponseSchema
   - parseAuthSessionResponse: AuthSessionResponseSchema
   - job update feed: JobUpdateFeedResponseSchema
   - update extraction: UpdateExtractionResponseSchema
   - cancel job: CancelJobResponseSchema
   - manager dashboard: ManagerDashboardResponseSchema
   - manager lead detail: ManagerLeadDetailResponseSchema
   - manager job detail: ManagerJobDetailResponseSchema
   - parseJobMoneyResponse (one function, used by get, update, and split override): JobMoneyResponseSchema
   - reminders list: ReminderListResponseSchema; generate: ReminderGenerationResponseSchema; resolve: ResolveReminderResponseSchema
   - scheduling list: SchedulingProposalListResponseSchema; detail: SchedulingProposalDetailResponseSchema; approve, edit, reject: SchedulingDecisionResponseSchema
   - writebacks list: WritebackExecutionListResponseSchema; execute, retry, detail: WritebackExecutionResponseSchema
   - conversations list: ConversationListResponseSchema; detail: ConversationDetailResponseSchema (the takeover call at client.ts:379 already reuses this parser and needs nothing separate); send message: SendConversationMessageResponseSchema; convert lead: ConvertLeadToJobResponseSchema
   - contact card preview: ContactCardPreviewResponseSchema; vcard: ContactCardVcardResponseSchema

   Every schema in this table exists in packages/shared and the table covers all 23. Never write a new hand parser. Keep the error messages the same shape (`Unexpected <label> response`) so nothing that reads them changes.

7. client.ts also uses `isRecord` from `@/auth/session-validation` in its own two-argument `getErrorMessage(payload, fallback)` at lines 838 and 842. Move `isRecord` into client.ts as a module-level, non-exported function with the same body before deleting session-validation.ts. That is the only helper you may add. Then remove the nine `@/.../-validation` imports from client.ts and delete the nine files plus job-validation.test.ts. In session-storage.ts replace `toLoginResponse(parsed)` with `LoginResponseSchema.safeParse(parsed)` and use `.data` on success; the null-on-failure behavior stays.

8. In e2e/critical-paths.test.ts add one test: a fetch mock that returns `{ summary: {} }` for `GET /manager/dashboard` makes `client.getManagerDashboard(token)` reject with an `ApiError` whose message is `Unexpected manager dashboard response`.

Traps:

- The mobile parsers accepted empty strings and missing fields that the shared schemas reject. If a screen starts showing "Unexpected ... response" against the local API, the API is returning something its own contract forbids. Report it; do not loosen the schema and do not add a fallback.
- `z.string().datetime({ offset: true })` accepts `Z` and numeric offsets. The API serializes with `toISOString()`, which emits `Z`. Do not use `z.coerce.date()` here; it accepts numbers and junk strings.
- None of the nine parser files exports a type, so deleting them cannot orphan a type. If typecheck shows a screen error after this slice, you removed something a screen imported; stop and report.
- Do not touch the `*-format.ts` files, the screens, or the components. Slice 6 owns them.

Verify:

- `pnpm --filter @rsjt/shared test`, `DATABASE_URL=<your slice database> pnpm --filter @rsjt/api test` (the API validates its own output with these schemas at manager-dashboard-repository.ts:95, job-money-service.ts:197, contact-card-service.ts:57, and job-update-feed-service.ts:25, so this proves `JsonDateSchema` still accepts Date objects), `pnpm --filter @rsjt/mobile test`, `pnpm typecheck`, `pnpm lint`, `pnpm --filter @rsjt/mobile lint`.
- `pnpm --filter @rsjt/mobile exec expo export --platform ios --output-dir ../../.scratch-export`, then `rm -rf .scratch-export` from the repo root before checking git status. Compare with the preflight baseline; if baseline passed this must pass.
- Line count: `wc -l apps/mobile/src/api/client.ts` should be roughly 600 or fewer. Report the number under "client.ts line count".
- Manual, by the reviewer after merge: run the API and the app against the seed data and open every screen in the first-release-checklist "Mobile Readiness" list.

Done when: the nine parser files are gone, client.ts has zero local response parsers (`parseErrorPayload` stays), shared tests cover JsonDateSchema, and all suites are green.

### Slice 5: API deduplication

Audit findings:

- `toJobSummary` and `toRepairShoprReference` are copied in apps/api/src/repositories/jobs-repository.ts:39, job-cancellation-repository.ts:54, and lead-conversion-repository.ts:112. Only the cancellation copy maps `cancelReason` and `canceledAt`.
- `confidenceToBasisPoints` is byte-identical in extracted-facts-repository.ts:77 and matches-repository.ts:204; packages/shared/src/domain/confidence.ts has no equivalent.
- Thirteen of the fifteen files in apps/api/src/tests define a byte-identical `testConfig()`; writeback-routes.test.ts and end-to-end-smoke.integration.test.ts add `REPAIRSHOPR_WRITEBACK_ENABLED: false`. Every file also defines its own fake auth service, in three shapes.

Files you may change:

- apps/api/src/repositories/job-mappers.ts (new)
- apps/api/src/repositories/confidence-basis-points.ts (new)
- apps/api/src/repositories/jobs-repository.ts, job-cancellation-repository.ts, lead-conversion-repository.ts, extracted-facts-repository.ts, matches-repository.ts
- apps/api/src/repositories/jobs-repository.test.ts, job-cancellation-repository.test.ts, lead-conversion-repository.test.ts, extracted-facts-repository.test.ts, matches-repository.test.ts (read them; edit only if the consolidation breaks an assertion, and list any edit in the report)
- apps/api/src/tests/support/test-config.ts (new), apps/api/src/tests/support/fake-auth-service.ts (new)
- the fifteen `apps/api/src/tests/*.test.ts` files

Steps:

1. Create job-mappers.ts exporting `toJobSummary(row: JobRow): JobSummary` and `toRepairShoprReference(row: JobRow): RepairShoprReference | null`, plus `export type JobRow = typeof jobs.$inferSelect`. Use the cancellation repository's version as the source because it is the superset: it adds `cancelReason` and `canceledAt` with the same conditional-spread pattern, and `JobSummarySchema` already accepts both (packages/shared/src/domain/jobs.ts:79-80). This means the job update feed (jobs-repository) and lead conversion will now include those two fields when a row has them. That is intended; list it under "Predicted behavior changes present" in your report.

2. In the three repositories delete the local copies and import from `./job-mappers.js`. Delete the local `JobRow` alias where it exists and import it.

3. Create confidence-basis-points.ts with the single `confidenceToBasisPoints` function copied from either repository and import it in both.

4. Create tests/support/test-config.ts:

```ts
import type { ApiConfig } from "../../config.js";

export function testConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    // paste the body of the existing testConfig() from health-routes.test.ts here
    ...overrides,
  };
}
```

   In writeback-routes.test.ts and end-to-end-smoke.integration.test.ts call `testConfig({ REPAIRSHOPR_WRITEBACK_ENABLED: false })`. The other thirteen call `testConfig()`.

5. Create tests/support/fake-auth-service.ts exporting `createFakeAuthService(sessions: Record<string, SessionUser>): AuthSessionService`, where `getSession(token)` returns `{ user }` for a known token and `null` otherwise, `login` throws `new Error("Unexpected login call")`, and `logout` resolves. Three files do not fit this shape and keep their local fakes, converting only `testConfig`: auth-routes.test.ts (its `StubAuthService` checks credentials and tracks `revokedTokens`), end-to-end-smoke.integration.test.ts (its fake's `login` returns a token), and manager-routes.test.ts (same). health-routes.test.ts and twilio-webhook-routes.test.ts use no-session literals; `createFakeAuthService({})` covers them.

6. Convert the test files one at a time: replace the local `testConfig` and, where step 5 allows, the fake with imports, run that single file with `DATABASE_URL=<your slice database> pnpm --filter @rsjt/api exec vitest run src/tests/<file>`, and move on only when green. If any other file's tests fail after the fake is swapped, keep that file's local fake, convert only its `testConfig`, and list it in the report.

Traps:

- Import paths inside `src/tests/support/` need `../../` to reach `src/`.
- `exactOptionalPropertyTypes`: spreading `Partial<ApiConfig>` over the defaults is fine because an absent key is not the same as a key set to `undefined`. Do not pass `{ SOMETHING: undefined }` as an override.
- Do not reorder, rename, or "improve" tests. The diff of each converted test file should be: import lines added, one function and possibly one fake removed, nothing else.
- Of the sibling repository tests, jobs-repository.test.ts and extracted-facts-repository.test.ts use `expect.objectContaining`; the other three compare exact objects, but none of their rows is canceled, so the consolidated mapper produces the same output for them. If one does break, the edit is limited to that assertion and goes in the report.
- Do not touch config.ts, app.ts, or the twilio files; slice 1 owns them and runs in the same wave.

Verify: `DATABASE_URL=<your slice database> pnpm --filter @rsjt/api test`, `pnpm typecheck`, `pnpm lint`. Report the total line delta of apps/api/src/tests under "Line delta" (expect several hundred lines removed).

Done when: one mapper file, one confidence helper, one config helper, one fake, fifteen thinner tests, all green.

### Slice 6: Mobile screen deduplication

Audit findings (all in apps/mobile/src/app):

- `requireToken` is defined in 15 screens with identical bodies.
- `getErrorMessage` is defined in 16 screens: 14 are byte-identical (`function getErrorMessage(error: unknown)` returning `"Request failed"` as the fallback), (tech)/tech/writebacks/[executionId].tsx adds an `instanceof ApiError` branch that returns the same `error.message`, and sign-in.tsx has a different signature and a different fallback ("Sign in failed").
- `Panel` is defined in 15 screens. Comparing the function body together with its `panel` style entry gives four variants: six identical (tech conversations index and detail, tech scheduling index and detail, tech writebacks index and detail), five identical (manager contact-card, manager index, manager money, tech index, tech money), two identical ((shared)/jobs and (shared)/leads), and two identical (manager reminders/stale and tech reminders, same body as the five but a different `panel` style). `Row` is defined in 5 screens and all five, body and `row` style, are byte-identical.
- Tech and manager money screens share identical query setup (`queryKey: ["job-money", jobId, token]`, same `queryFn`, `enabled: Boolean(token && jobId)`).
- Two `formatMoneyCents` implementations: dashboard-format.ts:86 prints `$150`, money-format.ts:8 prints `$150.00`.
- `SPLIT_CATEGORIES` is copied into manager/money/[jobId].tsx and `EXPENSE_CATEGORIES` into tech/money/[jobId].tsx; `SplitCategorySchema` and `ExpenseCategorySchema` exist in packages/shared/src/domain/money.ts.
- `errorText` color is `#B42318` in six screens and `#B91C1C` in four (manager contact-card, manager money, tech money, tech reminders).

Files you may change:

- New: apps/mobile/src/api/request-helpers.ts, apps/mobile/src/components/panel.tsx, apps/mobile/src/components/row.tsx, apps/mobile/src/money/use-job-money.ts
- All files under apps/mobile/src/app/ (the screens)
- apps/mobile/src/dashboard/dashboard-format.ts (delete its `formatMoneyCents` and import the money-format one)

Steps, in this order, running `pnpm --filter @rsjt/mobile typecheck` after each:

1. api/request-helpers.ts: export `requireToken(token: string | undefined): string` and `getErrorMessage(error: unknown): string`, copied from any of the 14 identical screens. Replace the 15 `requireToken` definitions and the 14 identical `getErrorMessage` definitions with imports. For (tech)/tech/writebacks/[executionId].tsx, confirm its extra branch only returns `error.message` for an `ApiError` (which the shared body also returns, since `ApiError` extends `Error`), then replace it too and note it. Leave sign-in.tsx's `getErrorMessage(error: Error | null)` alone; it is a different function. apps/mobile/src/api/client.ts also has a two-argument `getErrorMessage`; it is not yours and stays. Diff each screen: import line added, one or two functions removed, nothing else.

2. components/panel.tsx: lift the six-screen tech variant verbatim, including its `panel` StyleSheet entry, and replace `Panel` in exactly those six screens (tech conversations index and detail, tech scheduling index and detail, tech writebacks index and detail). Before replacing, diff each of the six against the lifted copy: body and style must match byte for byte. The other nine screens keep their local `Panel`; list them under "Noticed, not changed". Do not add props to make one component serve all four variants.

3. components/row.tsx: diff the five `Row` definitions and their `row` style entries first; they are byte-identical today. Lift one copy and replace all five. If a diff shows a difference, skip this step entirely and report it.

4. Unify `errorText` on `#B42318`, the six-screen majority, by changing the color value in the four `#B91C1C` screens. This is a one-token edit per file; do not create a shared stylesheet. List the four screens under "Predicted behavior changes present".

5. money/use-job-money.ts: `export function useJobMoney(token: string | undefined, jobId: string)` wrapping the identical query setup from the two money screens. The hook takes `token` as a parameter and must not call `useAuth` itself. Query key stays `["job-money", jobId, token]` verbatim, `enabled` stays `Boolean(token && jobId)`. Both screens keep their existing `const token = session?.token` line and pass it in. Leave the `setTimeout(() => hydrateForm(data), 0)` effect alone in both screens; changing it is a behavior change and out of scope.

6. Replace the two copied enum lists with `SplitCategorySchema.options` and `ExpenseCategorySchema.options` imported from `@rsjt/shared`.

7. Delete `formatMoneyCents` from dashboard-format.ts and import it from `@/money/money-format`. Dashboard cards will now print two decimals; list it under "Predicted behavior changes present".

Traps:

- React Compiler is on. Components are plain functions; do not add `React.memo`, `useCallback`, or `useMemo` while lifting, and do not remove the `useCallback` calls the money screens already have.
- `StyleSheet.create` stays at module scope in the new files.
- expo-router file-based routing: do not rename, move, or add files under `src/app/`. New components go under `src/components/`, not under `src/app/`.
- Do not change navigation, query keys, or mutation behavior.
- Typed routes are enabled; if typecheck complains about an `href`, you changed something under `src/app/` that you should not have.
- `SegmentButton` is copied in three screens but its four style entries differ in each; it is deliberately not lifted in this slice (section 4).

Verify: `pnpm --filter @rsjt/mobile typecheck`, `pnpm --filter @rsjt/mobile test`, `pnpm --filter @rsjt/mobile lint`, `pnpm lint`, and `pnpm --filter @rsjt/mobile exec expo export --platform ios --output-dir ../../.scratch-export` followed by `rm -rf .scratch-export` from the repo root. Report the line delta of apps/mobile/src/app under "Line delta" (expect several hundred removed).

Done when: no screen defines `requireToken`; no screen except sign-in.tsx defines `getErrorMessage`; the six named screens import the shared `Panel` and the other nine are listed in the report; no screen defines `Row`; the money screens share one hook; and the bundle check matches baseline.

### Slice 7: Tooling and docs

Audit findings:

- apps/api/package.json has `"start": "node ... dist/server.js"` but no package has a build step, so `start` can never work.
- apps/mobile depends on `@expo/dom-webview`, which is only needed with the `"use dom"` directive (zero uses in src).
- Expo template assets with no reference anywhere in src or app.json: assets/images/react-logo.png (and @2x, @3x), tutorial-web.png, expo-badge.png, expo-badge-white.png, expo-logo.png, logo-glow.png, and the six files under assets/images/tabIcons/. The two files under assets/expo.icon/Assets/ are not in this list: assets/expo.icon/icon.json names them as icon layers and app.json points `ios.icon` at that bundle.
- Doc drift: AGENTS.md "Allowed Working Area" gives a macOS-only path; REV01 says "Draft for review (slice 1)" while slices 1 to 11 merged by 2026-07-17; the tickets file has an unchecked "Gate Before Code" under twenty done tickets; the first-release-checklist "Mobile Readiness" bullet about Expo web preview says the shared barrel blocks Metro, which slice 4 disproves.
- Slices 3 and 4 create scratch folders inside the repo that .gitignore does not cover.

Files you may change:

- apps/api/package.json (remove the `start` script only)
- apps/mobile/package.json and pnpm-lock.yaml (only through the one `pnpm remove` command below)
- .gitignore (two added lines)
- the asset files listed above (delete)
- AGENTS.md (the "Allowed Working Area" section only)
- .project-management/4-revisions/REV01-leads-jobs-payout-lifecycle.md (the Status line only)
- .project-management/5-local-tickets/PP01-local-tickets.md (the "Gate Before Code" section only)
- .project-management/0-docs/first-release-checklist.md (one bullet under "Mobile Readiness"; slice 1 already edited the Safety Defaults list, do not touch that)

Steps:

1. Delete the `start` script from apps/api/package.json. Do not add a build; running through `dev` (tsx) is how this app runs, and a real build needs a workspace-aware output that is out of scope.

2. Confirm zero references, then delete the assets with `git rm`: `grep -rn "react-logo\|tutorial-web\|expo-badge\|expo-logo\|logo-glow\|tabIcons" apps/mobile/src apps/mobile/app.json apps/mobile/assets/expo.icon/icon.json` must print nothing. Keep icon.png, favicon.png, splash-icon.png, android-icon-*.png, and the whole assets/expo.icon/ directory.

3. `grep -rn "use dom" apps/mobile/src` must print nothing, then run exactly `pnpm --filter @rsjt/mobile remove @expo/dom-webview`. Commit the resulting package.json and pnpm-lock.yaml changes together. Do not remove anything else; `@expo/log-box`, `expo-constants`, `expo-linking`, `react-native-screens`, `react-native-safe-area-context`, `react-native-web`, `react-dom`, and `@expo/metro-runtime` are used by Expo or expo-router at runtime without direct imports.

4. Append two lines to .gitignore: `.scratch-export` and `packages/db/.fresh`.

5. AGENTS.md "Allowed Working Area": change the first bullet to "Project files live in this repository's root, wherever it is checked out (for example C:\dev\RSJT on Windows or /Users/ofirbitton/dev/RSJT on macOS)." Change the scratch bullet to "Temporary scratch files may live in the OS temp directory when needed." Nothing else in AGENTS.md changes.

6. REV01 Status line: `Status: Shipped. Slices 1 to 11 merged between 2026-06-08 and 2026-07-17.`

7. Tickets file "Gate Before Code": check all four boxes and add one line under the heading: `Retroactively marked on <today's date as YYYY-MM-DD>; all twenty tickets shipped before this gate was updated.` Write the real date of the commit, not the date of this plan.

8. first-release-checklist.md: find the "Mobile Readiness" bullet that begins `- Expo web preview is optional for this release because` and replace the whole line with `- Expo web preview is optional for this release.` Keep the leading `- `; it is a list item.

Traps:

- Deleting assets on Windows through git: use `git rm` so the deletion is staged with the right paths.
- Do not touch README.md; slice 1 edited it.
- Do not touch .github/workflows/ci.yml; slice 0 owns it.

Verify: `pnpm install --frozen-lockfile` still exits 0 after the remove, `pnpm lint`, `pnpm typecheck`, `DATABASE_URL=<your slice database> pnpm test`, `pnpm --filter @rsjt/mobile lint`, `pnpm --filter @rsjt/mobile exec expo export --platform ios --output-dir ../../.scratch-export` followed by `rm -rf .scratch-export`, and `git status --porcelain` shows only the listed files plus the deleted assets.

Done when: the local verify list is green, the stale doc lines read as specified, and the removed assets and dependency are gone. CI runs when the reviewer pushes.

## 4. Deferred on purpose

Not in this revision. Do not start these while executing a slice.

- `SegmentButton` is copied in three screens with identical JSX and different styles per screen. Lifting it needs style props and a byte-identical rendering check; separate change.
- The six-screen and two-screen `Panel` variants and the repeated `panel`, `eyebrow`, `title`, `body` style entries. A shared stylesheet is worth doing after slice 6 lands and the remaining diffs are visible.
- Biome and ESLint both lint apps/mobile. They do not conflict today. Choosing one is a separate decision.
- The TypeScript version differs (mobile ~5.9.3, everywhere else ^5.8.3). Aligning it means a lockfile change and a full re-verify; do it alone, later.
- apps/mobile/e2e is a mocked-fetch client test, not end-to-end. Renaming it touches vitest config and docs; later.
- The mobile app does not sign out on a 401; an expired session stays signed in until restart. Product behavior decision.
- A real build and start path for the API.
- Deep review of matching-service.ts, customer-intake-state-machine-service.ts, and job-money-service.ts. The audit only spot-checked these; a follow-up audit pass should read them fully before anyone edits them.
- Repository tests have no skip guard when Postgres is absent. CI makes this moot; a guard would hide real failures locally.
- packages/db/src/seed.ts is not idempotent: the jobs insert and the first conversations insert use fixed ids without `onConflictDoNothing`, so a second run fails. Making every insert conflict-safe is a small, separate change.

## 5. Reviewer checklist

For each slice branch, in this order:

1. The report follows the template in 0.6, names its worktree and database, and every verification line has an exit code.
2. `git diff --stat main...rev02-sliceN-<name>` lists only files the slice owns (plus the ones a step explicitly permits, such as the sibling repository tests in slice 5 or the lockfile in slice 7).
3. In Git Bash: `git diff --name-only main...HEAD | xargs grep -n $'\u2014'` is empty, and `git diff --name-only main...HEAD | xargs grep -nE "TODO|FIXME|as unknown as|: any\b|<any>|@ts-(ignore|expect-error)|biome-ignore|eslint-disable"` returns only the pre-existing twilio-outbound-messenger.ts:61 line when slice 1 is under review, and nothing otherwise.
4. Read the diff against the slice steps. Anything not in the steps is either listed under "Deviations" with a reason you accept, or it comes out.
5. The predicted behavior changes are present and nothing else changed behavior. The full list: slice 1, the three enabled messenger tests gain an allowlist and sends to non-allowlisted recipients are blocked; slice 5, job update feed and lead conversion responses now carry `cancelReason` and `canceledAt` for canceled jobs; slice 6, four screens change `errorText` to `#B42318` and dashboard money shows two decimals.
6. For every wave-1 slice, run the slice's verify commands yourself in the slice's worktree before accepting it. From wave 2 on, once the branches have been pushed and the slice 0 workflow runs, CI covers lint, typecheck, tests, mobile lint, and the bundle check; still read the report's exit codes and the slice artifacts.
7. Merging, pushing, and opening PRs are Ofir's call. Present the per-slice verdicts and wait. After a wave is merged into `main`, re-run preflight step 5 on `main`, create the next wave's databases (preflight step 4), and only then dispatch the next wave.

## 6. Dispatch prompt for an executor

Paste this to each executor, replacing N and the slice name, and append the filled-in preflight results block from section 1.

```
You are executing slice N (<name>) of C:\dev\RSJT\.project-management\4-revisions\REV02-audit-remediation.md.

Read AGENTS.md, then REV02 section 0 (the executor contract) in full, then section 1 (confirm the preflight block below is green), then your slice. Do not read or act on other slices. AGENTS.md names a macOS path under "Allowed Working Area"; on this machine the repo is C:\dev\RSJT and that is fine (slice 7 fixes the wording).

Work in your own git worktree: from C:\dev\RSJT run `git worktree add ../rsjt-sliceN -b rev02-sliceN-<name> main`, then `pnpm install --frozen-lockfile` inside it. The plan file itself is untracked and lives only in C:\dev\RSJT, so read it from that path. Use Git Bash for every command. Your database is postgres://rsjt:rsjt_local@localhost:54329/rsjt_sliceN; export it as DATABASE_URL for every command that touches Postgres. Commit on your branch when done; do not push, do not open a PR.

Rules that override anything you would normally do: touch only the files your slice lists; never add or change dependencies unless the slice gives the command; never edit pnpm-lock.yaml, migration SQL, .agents, or skills-lock.json; no em dashes anywhere; no TODO, any, as unknown as, ts-ignore, biome-ignore, or eslint-disable; no repo-wide formatting; no Linear, Notion, Slack, Gmail, or Drive; no live Twilio, RepairShopr, or AI calls.

Run every command under your slice's Verify list and paste exit codes and last lines. Rebase and re-verify whenever an earlier slice in your wave merges. Stop and report instead of guessing whenever section 0.7 applies.

Your final message is only the report from section 0.6, filled in. Do not merge.
```
