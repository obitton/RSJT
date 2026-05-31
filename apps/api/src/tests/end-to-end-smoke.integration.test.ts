import type {
  ApprovalFilterQuery,
  ApprovalRecord,
  ContactCardPreviewResponse,
  CreateApprovalRequest,
  EditApprovalRequest,
  JobMoneyResponse,
  MatchSearchInput,
  MatchSearchResponse,
  MatchSelectionResponse,
  OverrideSplitCategoryRequest,
  RejectApprovalRequest,
  ReminderGenerationResponse,
  ReminderListResponse,
  RepairShoprReference,
  ResolveReminderResponse,
  SessionUser,
  UpdateExtractionResponse,
  UpdateJobMoneyRequest,
  WritebackExecution,
  WritebackExecutionListQuery,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { ApprovalServiceApi } from "../services/approval-service.js";
import type { AuthSessionService } from "../services/auth-service.js";
import type { ContactCardServiceApi } from "../services/contact-card-service.js";
import type { JobMoneyServiceApi } from "../services/job-money-service.js";
import type { MatchingServiceApi } from "../services/matching-service.js";
import type {
  MessagingWebhookRequestContext,
  MessagingWebhookServiceApi,
} from "../services/messaging-webhook-service.js";
import type { ReminderServiceApi } from "../services/reminder-service.js";
import type {
  ExtractJobUpdateInput,
  UpdateExtractionServiceApi,
} from "../services/update-extraction-service.js";
import type { WritebackExecutionServiceApi } from "../services/writeback-execution-service.js";

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};

const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000020",
  role: "tech",
  displayName: "Tech",
};

const jobId = "00000000-0000-4000-8000-000000200001";
const conversationId = "00000000-0000-4000-8000-000000200002";
const messageId = "00000000-0000-4000-8000-000000200003";
const approvalId = "00000000-0000-4000-8000-000000200004";
const candidateId = "00000000-0000-4000-8000-000000200005";
const executionId = "00000000-0000-4000-8000-000000200006";

const repairShoprReference: RepairShoprReference = {
  entityType: "ticket",
  repairShoprId: "fixture-ticket-200",
  displayLabel: "Fixture laptop repair",
};

const inboundPayload =
  "MessageSid=SMsmoke200&From=%2B15555550200&To=%2B15555550199&Body=Need+laptop+repair&NumMedia=0";

describe("end-to-end smoke workflow", () => {
  it("walks the fixture workflow without live external writes", async () => {
    const messagingWebhookService = new FixtureMessagingWebhookService();
    const matchingService = new FixtureMatchingService();
    const approvalService = new FixtureApprovalService();
    const writebackExecutionService = new FixtureWritebackExecutionService();
    const updateExtractionService = new FixtureUpdateExtractionService();
    const jobMoneyService = new FixtureJobMoneyService();
    const reminderService = new FixtureReminderService();
    const contactCardService = new FixtureContactCardService();
    const app = await buildApp(testConfig(), {
      authService: new FixtureAuthService(),
      messagingWebhookService,
      matchingService,
      approvalService,
      writebackExecutionService,
      updateExtractionService,
      jobMoneyService,
      reminderService,
      contactCardService,
    });

    const inbound = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/messages",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "fixture-signature",
      },
      payload: inboundPayload,
    });
    const matchSearch = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/matches/search`,
      headers: authHeader("manager"),
      payload: {
        input: {
          phone: "+15555550200",
          name: "Casey Customer",
        },
      },
    });
    const matchSelection = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/matches/${candidateId}/select`,
      headers: authHeader("manager"),
    });
    const approvalCreate = await app.inject({
      method: "POST",
      url: "/approvals",
      headers: authHeader("manager"),
      payload: {
        jobId,
        kind: "repairshopr_writeback",
        risk: "crm_writeback",
        requiredRole: "manager",
        payload: {
          action: "ticket_comment_create",
          target: {
            entityType: "ticket",
            repairShoprId: "fixture-ticket-200",
          },
          repairShoprPayload: {
            body: "Fixture smoke writeback.",
          },
        },
        evidence: [{ messageId, quote: "Need laptop repair" }],
      },
    });
    const approvalApprove = await app.inject({
      method: "POST",
      url: `/approvals/${approvalId}/approve`,
      headers: authHeader("manager"),
    });
    const writeback = await app.inject({
      method: "POST",
      url: `/writebacks/approvals/${approvalId}/execute`,
      headers: authHeader("manager"),
    });
    const extraction = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/updates/extract`,
      headers: authHeader("tech"),
      payload: {
        body: "Completed Casey laptop repair. Charged $180. No follow up.",
      },
    });
    const money = await app.inject({
      method: "PATCH",
      url: `/jobs/${jobId}/money`,
      headers: authHeader("tech"),
      payload: {
        completed: true,
        grossChargeCents: 18000,
        expenses: [{ category: "parts", amountCents: 2500 }],
      },
    });
    const reminders = await app.inject({
      method: "POST",
      url: "/reminders/generate",
      headers: authHeader("tech"),
    });
    const contactCard = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/contact-card/preview`,
      headers: authHeader("manager"),
    });

    expect(inbound.statusCode).toBe(200);
    expect(inbound.body).toBe("<Response></Response>");
    expect(matchSearch.statusCode).toBe(200);
    expect(matchSelection.statusCode).toBe(200);
    expect(approvalCreate.statusCode).toBe(200);
    expect(approvalApprove.statusCode).toBe(200);
    expect(writeback.statusCode).toBe(200);
    expect(extraction.statusCode).toBe(200);
    expect(money.statusCode).toBe(200);
    expect(money.json().summary.payoutReady).toBe(true);
    expect(reminders.statusCode).toBe(200);
    expect(contactCard.statusCode).toBe(200);
    expect(contactCard.json().available).toBe(true);

    expect(messagingWebhookService.inboundCalls).toHaveLength(1);
    expect(matchingService.searches).toEqual([
      {
        jobId,
        input: {
          phone: "+15555550200",
          name: "Casey Customer",
        },
      },
    ]);
    expect(approvalService.createdPayloads).toHaveLength(1);
    expect(approvalService.approvedIds).toEqual([approvalId]);
    expect(writebackExecutionService.executedApprovalIds).toEqual([approvalId]);
    expect(updateExtractionService.inputs[0]?.authorRole).toBe("tech");
    expect(jobMoneyService.updateInputs[0]?.input.completed).toBe(true);
    expect(reminderService.generateCalls).toBe(1);

    await app.close();
  });
});

class FixtureAuthService implements AuthSessionService {
  async login() {
    return {
      token: "session-token-manager",
      user: managerUser,
    };
  }

  async getSession(token: string) {
    if (token === "session-token-manager") {
      return { user: managerUser };
    }
    if (token === "session-token-tech") {
      return { user: techUser };
    }
    return null;
  }

  async logout() {}
}

class FixtureMessagingWebhookService implements MessagingWebhookServiceApi {
  readonly inboundCalls: Array<{
    context: MessagingWebhookRequestContext;
    payload: Record<string, unknown>;
  }> = [];

  async handleInboundMessage(
    context: MessagingWebhookRequestContext,
    payload: Record<string, unknown>,
  ) {
    this.inboundCalls.push({ context, payload });
    return { conversationId, messageId };
  }

  async handleStatusCallback() {
    return { updatedMessageId: null };
  }
}

class FixtureMatchingService implements MatchingServiceApi {
  readonly searches: Array<{ jobId: string; input: MatchSearchInput }> = [];

  async listJobMatches() {
    return matchResponse();
  }

  async searchJobMatches(jobIdInput: string, input: MatchSearchInput) {
    this.searches.push({ jobId: jobIdInput, input });
    return matchResponse();
  }

  async selectMatch(): Promise<MatchSelectionResponse> {
    return {
      jobId,
      selectedCandidateId: candidateId,
      repairShoprReference,
    };
  }

  async unlinkMatch(): Promise<MatchSelectionResponse> {
    return {
      jobId,
      selectedCandidateId: null,
      repairShoprReference: null,
    };
  }
}

class FixtureApprovalService implements ApprovalServiceApi {
  readonly createdPayloads: CreateApprovalRequest[] = [];
  readonly approvedIds: string[] = [];

  async createApproval(_user: SessionUser, input: CreateApprovalRequest) {
    this.createdPayloads.push(input);
    return approvalFixture({ state: "pending", payload: input.payload });
  }

  async listApprovals(_filters?: ApprovalFilterQuery) {
    return [approvalFixture()];
  }

  async editApproval(
    _user: SessionUser,
    _approvalId: string,
    input: EditApprovalRequest,
  ) {
    return approvalFixture({ payload: input.payload });
  }

  async approveApproval(_user: SessionUser, approvalIdInput: string) {
    this.approvedIds.push(approvalIdInput);
    return approvalFixture({
      state: "approved",
      decidedByUserId: managerUser.id,
      decidedAt: new Date("2026-05-26T12:01:00.000Z"),
    });
  }

  async rejectApproval(
    _user: SessionUser,
    _approvalId: string,
    _input: RejectApprovalRequest,
  ) {
    return approvalFixture({ state: "rejected" });
  }

  async expireApproval() {
    return approvalFixture({ state: "expired" });
  }
}

class FixtureWritebackExecutionService implements WritebackExecutionServiceApi {
  readonly executedApprovalIds: string[] = [];

  async listExecutions(
    _user: SessionUser,
    _filters?: WritebackExecutionListQuery,
  ) {
    return [writebackFixture()];
  }

  async executeApprovedApproval(_user: SessionUser, approvalIdInput: string) {
    this.executedApprovalIds.push(approvalIdInput);
    return writebackFixture({ state: "succeeded", attemptCount: 1 });
  }

  async retryExecution() {
    return writebackFixture({ state: "succeeded", attemptCount: 1 });
  }
}

class FixtureUpdateExtractionService implements UpdateExtractionServiceApi {
  readonly inputs: ExtractJobUpdateInput[] = [];

  async extractJobUpdate(
    input: ExtractJobUpdateInput,
  ): Promise<UpdateExtractionResponse> {
    this.inputs.push(input);
    return {
      jobId: input.jobId,
      messageId,
      facts: [
        {
          type: "gross_charge_cents",
          value: { amountCents: 18000 },
          confidence: 0.9,
          evidence: { messageId, quote: "$180" },
          requiresConfirmation: false,
        },
        {
          type: "completion_state",
          value: { state: "completed" },
          confidence: 0.9,
          evidence: { messageId, quote: "Completed" },
          requiresConfirmation: false,
        },
        {
          type: "follow_up_needed",
          value: { needed: false },
          confidence: 0.85,
          evidence: { messageId, quote: "No follow up" },
          requiresConfirmation: false,
        },
      ],
      missingFields: [],
      prompts: [],
    };
  }
}

class FixtureJobMoneyService implements JobMoneyServiceApi {
  readonly updateInputs: Array<{
    user: SessionUser;
    jobId: string;
    input: UpdateJobMoneyRequest;
  }> = [];

  async getMoney() {
    return moneyResponse({ payoutReady: false });
  }

  async updateMoney(
    user: SessionUser,
    jobIdInput: string,
    input: UpdateJobMoneyRequest,
  ) {
    this.updateInputs.push({ user, jobId: jobIdInput, input });
    return moneyResponse({ payoutReady: true });
  }

  async overrideSplitCategory(
    _user: SessionUser,
    _jobId: string,
    input: OverrideSplitCategoryRequest,
  ) {
    return moneyResponse({ splitCategory: input.splitCategory });
  }
}

class FixtureReminderService implements ReminderServiceApi {
  generateCalls = 0;

  async generateReminders(): Promise<ReminderGenerationResponse> {
    this.generateCalls += 1;
    return { createdCount: 0, resolvedCount: 1, reminders: [] };
  }

  async listReminders(): Promise<ReminderListResponse> {
    return { reminders: [] };
  }

  async listStaleReminders(): Promise<ReminderListResponse> {
    return { reminders: [] };
  }

  async resolveReminder(): Promise<ResolveReminderResponse> {
    return {
      reminder: {
        id: "00000000-0000-4000-8000-000000200007",
        jobId,
        jobState: "completed",
        customerLabel: "Fixture laptop repair",
        reason: "follow_up_needed",
        createdAt: new Date("2026-05-26T12:00:00.000Z"),
        resolvedAt: new Date("2026-05-26T12:02:00.000Z"),
        stale: false,
      },
    };
  }
}

class FixtureContactCardService implements ContactCardServiceApi {
  async getPreview(): Promise<ContactCardPreviewResponse> {
    return {
      available: true,
      missingFields: [],
      state: "review_ready",
      contact: {
        conversationId,
        fullName: "Casey Customer",
        phone: "+15555550200",
        email: "casey@example.com",
        serviceAddress: "123 Main Street",
      },
    };
  }

  async getVcard() {
    return "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Casey Customer\r\nEND:VCARD";
  }
}

function matchResponse(): MatchSearchResponse {
  return {
    jobId,
    candidates: [
      {
        id: candidateId,
        confidence: 0.9,
        confidenceBand: "high",
        reasons: [
          {
            label: "Phone match",
            detail: "Phone number matches the fixture ticket.",
            weight: 0.45,
          },
        ],
        repairShoprReference,
      },
    ],
    displayLinkedCandidateId: candidateId,
    requiresConfirmation: false,
  };
}

function approvalFixture(
  overrides: Partial<ApprovalRecord> = {},
): ApprovalRecord {
  const now = new Date("2026-05-26T12:00:00.000Z");
  const payload = {
    action: "ticket_comment_create",
    target: {
      entityType: "ticket",
      repairShoprId: "fixture-ticket-200",
    },
    repairShoprPayload: {
      body: "Fixture smoke writeback.",
    },
  };

  return {
    id: approvalId,
    jobId,
    kind: "repairshopr_writeback",
    state: "pending",
    risk: "crm_writeback",
    requiredRole: "manager",
    payload,
    originalPayload: payload,
    evidence: [{ messageId, quote: "Need laptop repair" }],
    createdByUserId: managerUser.id,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function writebackFixture(
  overrides: Partial<WritebackExecution> = {},
): WritebackExecution {
  const now = new Date("2026-05-26T12:00:00.000Z");
  return {
    id: executionId,
    approvalId,
    jobId,
    kind: "repairshopr_writeback",
    state: "ready",
    targetKind: "repairshopr",
    action: "ticket_comment_create",
    requestPayload: {
      action: "ticket_comment_create",
      target: {
        entityType: "ticket",
        repairShoprId: "fixture-ticket-200",
      },
      repairShoprPayload: {
        body: "Fixture smoke writeback.",
      },
    },
    responsePayload: null,
    errorMessage: null,
    repairShoprEntityType: null,
    repairShoprId: null,
    attemptCount: 0,
    lastAttemptedAt: null,
    executedByUserId: null,
    succeededAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function moneyResponse(
  overrides: Partial<JobMoneyResponse["summary"]> = {},
): JobMoneyResponse {
  return {
    summary: {
      jobId,
      state: "payout_ready",
      isCompleted: true,
      splitCategory: "new_lead",
      grossChargeCents: 18000,
      reportedExpenseCents: 2500,
      reportedProfitCents: null,
      calculatedProfitCents: 15500,
      profitBasis: "charge_minus_reported_expenses",
      managerPercent: 20,
      techPercent: 80,
      managerShareCents: 3100,
      techShareCents: 12400,
      payoutReady: true,
      missingFields: [],
      ...overrides,
    },
    expenses: [
      {
        id: "00000000-0000-4000-8000-000000200008",
        jobId,
        category: "parts",
        amountCents: 2500,
        description: "Adapter",
        enteredByUserId: techUser.id,
        createdAt: new Date("2026-05-26T12:00:00.000Z"),
        updatedAt: new Date("2026-05-26T12:00:00.000Z"),
      },
    ],
  };
}

function authHeader(role: "manager" | "tech") {
  return {
    authorization:
      role === "manager"
        ? "Bearer session-token-manager"
        : "Bearer session-token-tech",
  };
}

function testConfig(): ApiConfig {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev",
    API_HOST: "127.0.0.1",
    API_PORT: 47630,
    SESSION_TTL_HOURS: 720,
    REPAIRSHOPR_TIMEOUT_MS: 10000,
    REPAIRSHOPR_WRITEBACK_ENABLED: false,
    MESSAGING_CHANNEL: "whatsapp_sandbox",
    MESSAGING_OUTBOUND_ENABLED: false,
  };
}
