# REV01: Leads / Jobs / Payout lifecycle

Status: Draft for review (slice 1 of a sliced rollout)
Owner: Ofir
Scope: Reframe the manager dashboard and intake model around a Lead to Job to Payout lifecycle.

## Why

Today the dashboard shows job-centric groups (open, scheduled, completed, unmatched, payout)
and a separate "Customer Chat" list of conversations. Conversations and jobs are disconnected,
and no job is ever created at runtime. We want a single lifecycle a manager can follow from a
first inbound message to a paid-out job.

## Core idea

A conversation is a Lead. A Job is a Lead that the customer confirmed and that has been scheduled.
Creating a Job is the moment a CRM ticket is created (tied to an existing CRM customer, or a new
CRM customer entry is created and the ticket tied to it). Nothing writes to the CRM before that.

```
inbound message
  -> Lead (conversation)            [no CRM write]
       needs tech answer  (AI only, no human took over)
       working on         (tech or manager took over)
  -> confirmed + scheduled
  -> Job                            [CRM ticket created here]
       scheduled
       repair
  -> completed by tech
  -> Payout (manager not yet paid their split)
```

## Dashboard (three fields, replaces the current five groups)

1. LEADS = b  (total non-spam, non-blocked conversations)
   - needs tech answer = n out of b   -> conversations with takeoverActive = false
   - working on        = p out of b   -> conversations with takeoverActive = true
2. JOBS = f  (jobs created from scheduled leads)
   - scheduled = j out of f           -> job state "scheduled"
   - repair    = s out of f           -> job state in repair / in progress
3. PAYOUT = number of completed jobs not yet paid out to the manager
   -> job state "payout_ready"

Confirmed by Ofir: scheduled and repair are sub-counts of JOBS (out of f). Scheduling is what
turns a lead into a job, so both indicators are measured against total jobs f, not p.

## Lead naming

- If the inbound number matches a CRM customer on the initial check, use the customer name.
- If not matched, use the phone number as the label.
- When a match is confirmed later, the label auto-updates from the phone number to the customer name.

## Lead detail page (new)

Clicking a Lead opens a Lead detail page with:
- A description built from facts collected so far in the conversation (name, phone, address,
  problem, preferred timing as available).
- A Chat section with an "Open chat" button that opens the conversation page.
- Later: a "Process lead" action to match-or-mark-new and (when scheduled) convert to a Job.

## Job detail page (existing, extended)

The existing job detail page gains a Chat section + "Open chat" button linking to the originating
conversation.

## Conversation page (existing, extended)

- Manager can take over a conversation (same takeover switch techs use).
- Messages show who sent them internally (manager vs tech vs AI/system vs customer), using the
  authorRole and sentByUserId already stored on each message. Customers never see this internal
  attribution.

## Out of scope for now

- Real CRM ticket / customer creation calls (stays gated and staged until the convert-to-job slice).
- Real outbound messaging (stays gated).
- Real LLM extraction (stays deterministic).

## Slice plan

1. This spec (review).
2. Dashboard relabel + recount: LEADS / JOBS / PAYOUT with sub-counts, backed by existing data.
3. Lead detail page + route, with description and Chat section.
4. Job detail page: add Chat section + Open chat button.
5. Conversation page: manager takeover + internal sender attribution.
6. Lead naming: phone-number fallback + auto-update on match.
7. Convert lead to job on schedule (creates job; stages CRM ticket, still gated).

Each slice ships with typecheck + test + lint green and is reviewed before the next.
