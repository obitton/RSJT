import type { JobSummary, SessionUser } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import {
  ConversationNotFoundError,
  type ConversionConversation,
  type CreateJobFromConversationInput,
  LeadAlreadyConvertedError,
  LeadBlockedError,
  LeadConversionService,
  type LeadConversionStore,
  LeadNotAnsweredError,
  LeadNotScheduledError,
} from "./lead-conversion-service.js";

const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000002",
  role: "tech",
  displayName: "Tech",
};

const conversationId = "00000000-0000-4000-8000-000000020201";

describe("LeadConversionService", () => {
  it("creates a scheduled job seeded from the conversation", async () => {
    const store = new FakeStore({
      conversation: conversationFixture({
        customerName: "Jordan Rivera",
        matchedRepairShoprEntityType: "customer",
        matchedRepairShoprId: "cust-1",
        matchedRepairShoprDisplayLabel: "Jordan Rivera (CRM)",
      }),
      answered: true,
      scheduled: true,
    });

    const job = await new LeadConversionService(store).convertToJob(
      techUser,
      conversationId,
    );

    expect(job.state).toBe("scheduled");
    expect(store.createInput).toMatchObject({
      conversationId,
      state: "scheduled",
      customerLabel: "Jordan Rivera",
      repairShoprEntityType: "customer",
      repairShoprId: "cust-1",
    });
  });

  it("falls back to the matched display label when there is no customer name", async () => {
    const store = new FakeStore({
      conversation: conversationFixture({
        customerName: null,
        matchedRepairShoprDisplayLabel: "Jordan Rivera (CRM)",
      }),
      answered: true,
      scheduled: true,
    });

    await new LeadConversionService(store).convertToJob(
      techUser,
      conversationId,
    );

    expect(store.createInput?.customerLabel).toBe("Jordan Rivera (CRM)");
  });

  it("throws when the conversation does not exist", async () => {
    const store = new FakeStore({
      conversation: null,
      answered: true,
      scheduled: true,
    });

    await expect(
      new LeadConversionService(store).convertToJob(techUser, conversationId),
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  it("throws when the lead is blocked", async () => {
    const store = new FakeStore({
      conversation: conversationFixture({ intakeState: "blocked" }),
      answered: true,
      scheduled: true,
    });

    await expect(
      new LeadConversionService(store).convertToJob(techUser, conversationId),
    ).rejects.toBeInstanceOf(LeadBlockedError);
  });

  it("throws when the lead already has a job", async () => {
    const store = new FakeStore({
      conversation: conversationFixture({}),
      answered: true,
      scheduled: true,
      existingJob: { id: "job-1", state: "scheduled" },
    });

    await expect(
      new LeadConversionService(store).convertToJob(techUser, conversationId),
    ).rejects.toBeInstanceOf(LeadAlreadyConvertedError);
    expect(store.createInput).toBeNull();
  });

  it("throws when no tech has answered the lead", async () => {
    const store = new FakeStore({
      conversation: conversationFixture({}),
      answered: false,
      scheduled: true,
    });

    await expect(
      new LeadConversionService(store).convertToJob(techUser, conversationId),
    ).rejects.toBeInstanceOf(LeadNotAnsweredError);
    expect(store.createInput).toBeNull();
  });

  it("throws when the lead has no scheduled appointment", async () => {
    const store = new FakeStore({
      conversation: conversationFixture({}),
      answered: true,
      scheduled: false,
    });

    await expect(
      new LeadConversionService(store).convertToJob(techUser, conversationId),
    ).rejects.toBeInstanceOf(LeadNotScheduledError);
    expect(store.createInput).toBeNull();
  });
});

function conversationFixture(
  overrides: Partial<ConversionConversation>,
): ConversionConversation {
  return {
    id: conversationId,
    intakeState: "review_ready",
    customerName: "Jordan Rivera",
    matchedRepairShoprEntityType: null,
    matchedRepairShoprId: null,
    matchedRepairShoprDisplayLabel: null,
    ...overrides,
  };
}

class FakeStore implements LeadConversionStore {
  createInput: CreateJobFromConversationInput | null = null;
  private readonly conversation: ConversionConversation | null;
  private readonly answered: boolean;
  private readonly scheduled: boolean;
  private readonly existingJob: JobSummary | null;

  constructor(input: {
    conversation: ConversionConversation | null;
    answered: boolean;
    scheduled: boolean;
    existingJob?: JobSummary | null;
  }) {
    this.conversation = input.conversation;
    this.answered = input.answered;
    this.scheduled = input.scheduled;
    this.existingJob = input.existingJob ?? null;
  }

  async getConversationForConversion() {
    return this.conversation;
  }

  async hasHumanReply() {
    return this.answered;
  }

  async hasScheduledAppointment() {
    return this.scheduled;
  }

  async getJobByConversationId() {
    return this.existingJob;
  }

  async createJobFromConversation(input: CreateJobFromConversationInput) {
    this.createInput = input;
    return {
      id: "00000000-0000-4000-8000-0000000a0001",
      state: input.state,
      ...(input.customerLabel ? { customerLabel: input.customerLabel } : {}),
    } satisfies JobSummary;
  }
}
