import { randomUUID } from "node:crypto";
import {
  type AppDb,
  conversations,
  createDb,
  createPool,
  jobs,
  schedulingProposals,
} from "@rsjt/db";
import { inArray } from "drizzle-orm";
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

  it("reads conversation fields and approved-proposal state", async () => {
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

    expect(await repository.hasApprovedSchedulingProposal(conversationId)).toBe(
      false,
    );

    await createApprovedProposal(conversationId);
    expect(await repository.hasApprovedSchedulingProposal(conversationId)).toBe(
      true,
    );
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

  async function createApprovedProposal(conversationId: string) {
    await db.insert(schedulingProposals).values({
      conversationId,
      jobId: null,
      state: "approved",
      preferredWindowText: "Weekday mornings",
      customerMessageBody: "Would Tuesday at 9 AM work?",
      repairShoprAppointmentPayload: { status: "staged" },
      sourceEvidence: [{ messageId: randomUUID(), quote: "restarting" }],
    });
  }
});
