import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { createDb, createPool } from "./connection.js";
import { conversations, jobs, messages, users } from "./schema.js";

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
      id: "00000000-0000-4000-8000-000000010101",
      state: "accepted",
      customerLabel: "Local laptop repair",
      repairShoprEntityType: "ticket",
      repairShoprId: "local-ticket-101",
      grossChargeCents: 18000,
      updatedAt: new Date("2026-05-20T14:00:00.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000010102",
      state: "scheduled",
      customerLabel: "Scheduled onsite setup",
      repairShoprEntityType: "ticket",
      repairShoprId: "local-ticket-102",
      updatedAt: new Date("2026-05-21T14:00:00.000Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000010103",
      state: "unmatched",
      customerLabel: "Unmatched walk-in update",
      updatedAt: new Date("2026-05-22T14:00:00.000Z"),
    },
  ])
  .onConflictDoNothing();

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

await pool.end();
