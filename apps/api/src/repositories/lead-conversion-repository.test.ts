import { randomUUID } from "node:crypto";
import {
  type AppDb,
  conversations,
  createDb,
  createPool,
  jobs,
  messages,
  schedulingProposals,
} from "@rsjt/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { LeadConversionRepository } from "./lead-conversion-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("LeadConversionRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: LeadConversionRepository;
  const createdConversationIds: string[] = [];
  const createdJobIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new LeadConversionRepository(db);
  });

  afterEach(async () => {
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      createdJobIds.length = 0;
    }
    if (createdConversationIds.length > 0) {
      await db
        .delete(messages)
        .where(inArray(messages.conversationId, createdConversationIds));
      await db
        .delete(schedulingProposals)
        .where(
          inArray(schedulingProposals.conversationId, createdConversationIds),
        );
      await db
        .delete(conversations)
        .where(inArray(conversations.id, createdConversationIds));
      createdConversationIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("reads the conversation fields needed to seed a job", async () => {
    const conversationId = await createConversation({
      customerName: "Jordan Rivera",
      matchedRepairShoprEntityType: "customer",
      matchedRepairShoprId: "cust-9",
      matchedRepairShoprDisplayLabel: "Jordan Rivera (CRM)",
    });

    const conversation =
      await repository.getConversationForConversion(conversationId);
    expect(conversation).toMatchObject({
      id: conversationId,
      customerName: "Jordan Rivera",
      matchedRepairShoprId: "cust-9",
    });
  });

  it("detects a human reply only after a tech or manager answers", async () => {
    const conversationId = await createConversation({});

    await createMessage(conversationId, { direction: "inbound" });
    expect(await repository.hasHumanReply(conversationId)).toBe(false);

    await createMessage(conversationId, {
      direction: "outbound",
      authorRole: "tech",
    });
    expect(await repository.hasHumanReply(conversationId)).toBe(true);
  });

  it("treats an approved proposal as scheduled only when it has a start time", async () => {
    const conversationId = await createConversation({});

    await createApprovedProposal(conversationId, null);
    expect(await repository.hasScheduledAppointment(conversationId)).toBe(
      false,
    );

    await createApprovedProposal(
      conversationId,
      new Date("2026-06-02T13:00:00.000Z"),
    );
    expect(await repository.hasScheduledAppointment(conversationId)).toBe(true);
  });

  it("creates a scheduled job from the conversation and finds it by conversation id", async () => {
    const conversationId = await createConversation({
      customerName: "Jordan Rivera",
      matchedRepairShoprEntityType: "customer",
      matchedRepairShoprId: "cust-9",
      matchedRepairShoprDisplayLabel: "Jordan Rivera (CRM)",
    });

    expect(await repository.getJobByConversationId(conversationId)).toBeNull();

    const job = await repository.createJobFromConversation({
      conversationId,
      state: "scheduled",
      customerLabel: "Jordan Rivera",
      repairShoprEntityType: "customer",
      repairShoprId: "cust-9",
    });
    createdJobIds.push(job.id);

    expect(job.state).toBe("scheduled");
    expect(job.customerLabel).toBe("Jordan Rivera");
    expect(job.repairShoprReference?.repairShoprId).toBe("cust-9");

    const [row] = await db
      .select({ origin: jobs.origin })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1);
    expect(row?.origin).toBe("lead");

    const found = await repository.getJobByConversationId(conversationId);
    expect(found?.id).toBe(job.id);
  });

  async function createConversation(values: {
    customerName?: string;
    matchedRepairShoprEntityType?: string;
    matchedRepairShoprId?: string;
    matchedRepairShoprDisplayLabel?: string;
  }) {
    const id = randomUUID();
    createdConversationIds.push(id);
    await db.insert(conversations).values({
      id,
      externalPhone: "+15555550900",
      intakeState: "review_ready",
      ...values,
    });
    return id;
  }

  async function createMessage(
    conversationId: string,
    values: {
      direction: "inbound" | "outbound" | "internal";
      authorRole?: "tech" | "manager";
    },
  ) {
    await db.insert(messages).values({
      conversationId,
      direction: values.direction,
      authorRole: values.authorRole ?? null,
      body: "message body",
    });
  }

  async function createApprovedProposal(
    conversationId: string,
    startAt: Date | null,
  ) {
    await db.insert(schedulingProposals).values({
      conversationId,
      jobId: null,
      state: "approved",
      preferredWindowText: "Weekday mornings",
      startAt,
      endAt: startAt,
      customerMessageBody: "Would Tuesday at 9 AM work?",
      repairShoprAppointmentPayload: { status: "staged" },
      sourceEvidence: [{ messageId: randomUUID(), quote: "restarting" }],
    });
  }
});
