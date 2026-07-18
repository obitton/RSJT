import argon2 from "argon2";
import { eq, sql } from "drizzle-orm";
import { createDb, createPool } from "./connection.js";
import {
  conversations,
  jobs,
  messages,
  schedulingProposals,
  users,
} from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = createPool(databaseUrl);
const db = createDb(pool);

await db
  .insert(users)
  .values([
    {
      username: "manager",
      displayName: "Manager",
      role: "manager",
      passcodeHash: await argon2.hash(
        process.env.LOCAL_MANAGER_PASSCODE ?? "manager-dev",
      ),
    },
    {
      username: "tech",
      displayName: "Tech",
      role: "tech",
      passcodeHash: await argon2.hash(
        process.env.LOCAL_TECH_PASSCODE ?? "tech-dev",
      ),
    },
  ])
  .onConflictDoNothing();

await db
  .insert(jobs)
  .values([
    {
      // Linked to Casey's conversation below, so this represents a lead-based job.
      id: "00000000-0000-4000-8000-000000010101",
      origin: "lead",
      state: "accepted",
      customerLabel: "Local laptop repair",
      repairShoprEntityType: "ticket",
      repairShoprId: "local-ticket-101",
      grossChargeCents: 18000,
      updatedAt: new Date("2026-05-20T14:00:00.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000010102",
      origin: "manual",
      originNote: "Phone-in booking entered by the office, no chat thread.",
      state: "scheduled",
      customerLabel: "Scheduled onsite setup",
      repairShoprEntityType: "ticket",
      repairShoprId: "local-ticket-102",
      updatedAt: new Date("2026-05-21T14:00:00.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000010103",
      origin: "manual",
      originNote: "Walk-in customer; job created at the counter.",
      state: "unmatched",
      customerLabel: "Unmatched walk-in update",
      updatedAt: new Date("2026-05-22T14:00:00.000Z"),
    },
    {
      // A canceled job so the Canceled dashboard section has something to show,
      // along with the reason it was canceled.
      id: "00000000-0000-4000-8000-000000010104",
      origin: "manual",
      originNote: "Walk-in that changed their mind before any work started.",
      state: "canceled",
      customerLabel: "Canceled tune-up",
      cancelReason:
        "Customer decided to replace the device instead of repairing it.",
      canceledAt: new Date("2026-05-23T14:00:00.000Z"),
      updatedAt: new Date("2026-05-23T14:00:00.000Z"),
    },
  ])
  // Refresh origin/originNote on re-seed so existing demo jobs pick up the tags.
  .onConflictDoUpdate({
    target: jobs.id,
    set: {
      origin: sql`excluded.origin`,
      originNote: sql`excluded.origin_note`,
    },
  });

const demoConversationId = "00000000-0000-4000-8000-000000020101";
const demoInboundMessageId = "00000000-0000-4000-8000-000000020102";
const demoConversation = {
  id: demoConversationId,
  externalPhone: "+15555550200",
  takeoverActive: true,
  takeoverStartedAt: new Date("2026-05-26T14:03:00.000Z"),
  takeoverStartedByUserId: null,
  intakeState: "review_ready" as const,
  customerName: "Casey Customer",
  customerEmail: "casey@example.com",
  serviceAddress: "123 Main Street",
  problemDescription: "Laptop will not charge after a liquid spill.",
  preferredTiming: "Today after 3 PM",
  blockedReason: null,
  spamScore: 0,
  matchedRepairShoprEntityType: "ticket",
  matchedRepairShoprId: "local-ticket-101",
  matchedRepairShoprDisplayLabel: "Local laptop repair",
  matchedConfidenceBand: "high",
  lastInboundMessageId: demoInboundMessageId,
  lastInboundAt: new Date("2026-05-26T14:02:00.000Z"),
  updatedAt: new Date("2026-05-26T14:03:00.000Z"),
};

await db
  .insert(conversations)
  .values(demoConversation)
  .onConflictDoUpdate({
    target: conversations.id,
    set: {
      externalPhone: demoConversation.externalPhone,
      takeoverActive: demoConversation.takeoverActive,
      takeoverStartedAt: demoConversation.takeoverStartedAt,
      takeoverStartedByUserId: demoConversation.takeoverStartedByUserId,
      intakeState: demoConversation.intakeState,
      customerName: demoConversation.customerName,
      customerEmail: demoConversation.customerEmail,
      serviceAddress: demoConversation.serviceAddress,
      problemDescription: demoConversation.problemDescription,
      preferredTiming: demoConversation.preferredTiming,
      blockedReason: demoConversation.blockedReason,
      spamScore: demoConversation.spamScore,
      matchedRepairShoprEntityType:
        demoConversation.matchedRepairShoprEntityType,
      matchedRepairShoprId: demoConversation.matchedRepairShoprId,
      matchedRepairShoprDisplayLabel:
        demoConversation.matchedRepairShoprDisplayLabel,
      matchedConfidenceBand: demoConversation.matchedConfidenceBand,
      lastInboundMessageId: demoConversation.lastInboundMessageId,
      lastInboundAt: demoConversation.lastInboundAt,
      updatedAt: demoConversation.updatedAt,
    },
  });

// Link the demo job to the conversation it originated from so the job detail
// page has a chat to open. Runs after the conversation upsert so the foreign
// key resolves, and also patches databases seeded before the link existed.
await db
  .update(jobs)
  .set({ conversationId: demoConversationId })
  .where(eq(jobs.id, "00000000-0000-4000-8000-000000010101"));

await db
  .delete(messages)
  .where(eq(messages.conversationId, demoConversationId));

await db
  .insert(messages)
  .values([
    {
      id: demoInboundMessageId,
      conversationId: demoConversationId,
      direction: "inbound",
      authorRole: null,
      body: "Hi, my laptop stopped charging after coffee spilled near the keyboard. Can someone come by today?",
      twilioMessageSid: "SMlocaldemo001",
      createdAt: new Date("2026-05-26T14:00:00.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000020103",
      conversationId: demoConversationId,
      direction: "internal",
      authorRole: "manager",
      body: "Matched to Local laptop repair. Needs tech response and scheduling confirmation.",
      createdAt: new Date("2026-05-26T14:01:00.000Z"),
    },
    {
      // No authorRole: an AI/system note, so the transcript shows "Automated".
      id: "00000000-0000-4000-8000-000000020105",
      conversationId: demoConversationId,
      direction: "internal",
      authorRole: null,
      body: "AI summary: liquid spill near keyboard, laptop will not charge. Likely onsite diagnostic. Draft reply prepared for tech review.",
      createdAt: new Date("2026-05-26T14:01:30.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000020104",
      conversationId: demoConversationId,
      direction: "outbound",
      authorRole: "tech",
      body: "I can take a look today after 3 PM. Please keep the laptop powered off until I arrive.",
      externalStatus: "blocked",
      createdAt: new Date("2026-05-26T14:03:00.000Z"),
    },
  ])
  .onConflictDoNothing();

// A second lead that is scheduled but not yet a job, so the "Convert to job"
// action has something to act on. The first demo lead already has a job, which
// would correctly hit the already-converted guard.
const convertibleConversationId = "00000000-0000-4000-8000-000000020201";
const convertibleInboundMessageId = "00000000-0000-4000-8000-000000020202";
const convertibleProposalId = "00000000-0000-4000-8000-000000020203";

// Reset this demo lead's dependent rows so every seed run leaves it freshly
// eligible to convert (a tech reply plus a timed, approved appointment) and
// removes any job created by a previous demo conversion.
await db.delete(jobs).where(eq(jobs.conversationId, convertibleConversationId));
await db
  .delete(schedulingProposals)
  .where(eq(schedulingProposals.conversationId, convertibleConversationId));
await db
  .delete(messages)
  .where(eq(messages.conversationId, convertibleConversationId));

await db
  .insert(conversations)
  .values({
    id: convertibleConversationId,
    externalPhone: "+15555550300",
    takeoverActive: false,
    intakeState: "review_ready",
    customerName: "Jordan Rivera",
    problemDescription: "Desktop keeps restarting at random.",
    preferredTiming: "Weekday mornings",
    spamScore: 0,
    lastInboundAt: new Date("2026-05-27T15:00:00.000Z"),
    updatedAt: new Date("2026-05-27T15:05:00.000Z"),
  })
  .onConflictDoNothing();

await db
  .insert(messages)
  .values([
    {
      id: convertibleInboundMessageId,
      conversationId: convertibleConversationId,
      direction: "inbound",
      authorRole: null,
      body: "Hi, my desktop keeps restarting at random. When can a technician come take a look?",
      twilioMessageSid: "SMlocaldemo010",
      createdAt: new Date("2026-05-27T15:00:00.000Z"),
    },
    {
      // A tech reply, so the lead counts as answered ("working on") and is
      // eligible for conversion. Outbound is gated locally, hence "blocked".
      id: "00000000-0000-4000-8000-000000020204",
      conversationId: convertibleConversationId,
      direction: "outbound",
      authorRole: "tech",
      body: "Happy to help. Would Tuesday at 9 AM work for an onsite visit?",
      externalStatus: "blocked",
      createdAt: new Date("2026-05-27T15:02:00.000Z"),
    },
  ])
  .onConflictDoNothing();

await db
  .insert(schedulingProposals)
  .values({
    id: convertibleProposalId,
    conversationId: convertibleConversationId,
    jobId: null,
    state: "approved",
    preferredWindowText: "Weekday mornings",
    // A concrete appointment time, so this is a booked appointment rather than
    // an open-ended proposal.
    startAt: new Date("2026-06-02T13:00:00.000Z"),
    endAt: new Date("2026-06-02T14:00:00.000Z"),
    customerMessageBody: "Would Tuesday at 9 AM work for a visit?",
    repairShoprAppointmentPayload: {
      status: "staged",
      customerLabel: "Jordan Rivera",
      notes: "Desktop restarting; onsite diagnostic.",
    },
    sourceEvidence: [
      {
        messageId: convertibleInboundMessageId,
        quote: "my desktop keeps restarting at random",
      },
    ],
    decidedAt: new Date("2026-05-27T15:05:00.000Z"),
    updatedAt: new Date("2026-05-27T15:05:00.000Z"),
  })
  .onConflictDoNothing();

await pool.end();
