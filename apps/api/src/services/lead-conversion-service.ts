import type { JobState, JobSummary, SessionUser } from "@rsjt/shared";

// The conversation fields needed to seed a job when converting a lead.
export type ConversionConversation = {
  id: string;
  intakeState: string;
  customerName: string | null;
  matchedRepairShoprEntityType: string | null;
  matchedRepairShoprId: string | null;
  matchedRepairShoprDisplayLabel: string | null;
};

export type CreateJobFromConversationInput = {
  conversationId: string;
  state: JobState;
  customerLabel: string | null;
  repairShoprEntityType: string | null;
  repairShoprId: string | null;
};

export interface LeadConversionStore {
  getConversationForConversion(
    conversationId: string,
  ): Promise<ConversionConversation | null>;
  // True once a tech or manager has replied to the customer (the "working on"
  // stage). An AI-only conversation has no human reply.
  hasHumanReply(conversationId: string): Promise<boolean>;
  // True only when an approved scheduling proposal has a concrete appointment
  // time. An approved proposal with no time is just a draft sent to the
  // customer, not a booked appointment.
  hasScheduledAppointment(conversationId: string): Promise<boolean>;
  getJobByConversationId(conversationId: string): Promise<JobSummary | null>;
  createJobFromConversation(
    input: CreateJobFromConversationInput,
  ): Promise<JobSummary>;
}

export interface LeadConversionServiceApi {
  convertToJob(user: SessionUser, conversationId: string): Promise<JobSummary>;
}

export class ConversationNotFoundError extends Error {
  constructor() {
    super("Conversation not found");
  }
}

export class LeadBlockedError extends Error {
  constructor() {
    super("A blocked lead cannot be converted to a job");
  }
}

export class LeadNotAnsweredError extends Error {
  constructor() {
    super("A lead must be answered by a tech before it can become a job");
  }
}

export class LeadNotScheduledError extends Error {
  constructor() {
    super("Lead must have a scheduled appointment before it can become a job");
  }
}

export class LeadAlreadyConvertedError extends Error {
  constructor() {
    super("Lead has already been converted to a job");
  }
}

export class LeadConversionService implements LeadConversionServiceApi {
  constructor(private readonly store: LeadConversionStore) {}

  async convertToJob(_user: SessionUser, conversationId: string) {
    const conversation =
      await this.store.getConversationForConversion(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError();
    }
    if (conversation.intakeState === "blocked") {
      throw new LeadBlockedError();
    }

    // A conversation maps to at most one job, so a second conversion is a
    // conflict rather than a silent duplicate.
    const existingJob = await this.store.getJobByConversationId(conversationId);
    if (existingJob) {
      throw new LeadAlreadyConvertedError();
    }

    // The lifecycle is: needs tech answer -> working on -> confirmed +
    // scheduled -> job. A lead no human has answered is still "needs tech
    // answer" and cannot become a job.
    const answered = await this.store.hasHumanReply(conversationId);
    if (!answered) {
      throw new LeadNotAnsweredError();
    }

    // Require a genuinely scheduled appointment, not just an approved proposal
    // (approving a proposal only authorises sending a draft to the customer).
    const scheduled = await this.store.hasScheduledAppointment(conversationId);
    if (!scheduled) {
      throw new LeadNotScheduledError();
    }

    return this.store.createJobFromConversation({
      conversationId,
      state: "scheduled",
      customerLabel:
        conversation.customerName ??
        conversation.matchedRepairShoprDisplayLabel,
      repairShoprEntityType: conversation.matchedRepairShoprEntityType,
      repairShoprId: conversation.matchedRepairShoprId,
    });
  }
}
