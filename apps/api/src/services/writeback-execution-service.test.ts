import type {
  ApprovalRecord,
  SessionUser,
  WritebackExecution,
  WritebackExecutionListQuery,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import type {
  CreateWritebackExecutionInput,
  MarkWritebackAttemptStartedInput,
  MarkWritebackFailedInput,
  MarkWritebackSucceededInput,
} from "../repositories/writeback-executions-repository.js";
import {
  type ApprovedApprovalStore,
  type CustomerMessageExecutor,
  type CustomerMessageResult,
  type CustomerMessageStore,
  InvalidWritebackPayloadError,
  type RepairShoprWriteExecutor,
  WritebackApprovalNotApprovedError,
  WritebackExecutionNotRetryableError,
  WritebackExecutionService,
  type WritebackExecutionStore,
} from "./writeback-execution-service.js";

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};
const approvalId = "00000000-0000-4000-8000-000000001001";
const executionId = "00000000-0000-4000-8000-000000001002";
const jobId = "00000000-0000-4000-8000-000000001003";

describe("WritebackExecutionService", () => {
  it("creates ready execution records when executable approvals are approved", async () => {
    const store = new FakeExecutionStore();
    const service = createService({ store });
    const approval = approvalRecord();

    await service.onApprovalApproved(managerUser, approval);
    await service.onApprovalApproved(managerUser, {
      ...approval,
      id: "00000000-0000-4000-8000-000000001004",
      kind: "payout_finalization",
    });

    expect(store.created).toEqual([
      expect.objectContaining({
        approvalId,
        kind: "repairshopr_writeback",
        action: "lead_create",
        targetKind: "repairshopr",
      }),
    ]);
  });

  it("requires approved approval state before execution", async () => {
    const approvals = new FakeApprovalStore(
      approvalRecord({ state: "pending" }),
    );
    const service = createService({ approvals });

    await expect(
      service.executeApprovedApproval(managerUser, approvalId),
    ).rejects.toBeInstanceOf(WritebackApprovalNotApprovedError);
  });

  it("marks RepairShopr execution blocked when writes are disabled", async () => {
    const store = new FakeExecutionStore();
    const repairShopr = new FakeRepairShoprWriteExecutor();
    const service = createService({
      store,
      repairShopr,
      repairShoprWritebackEnabled: false,
    });

    const execution = await service.executeApprovedApproval(
      managerUser,
      approvalId,
    );

    expect(execution).toMatchObject({
      state: "blocked",
      errorMessage: "RepairShopr writes disabled",
      attemptCount: 1,
    });
    expect(repairShopr.calls).toEqual([]);
  });

  it("executes RepairShopr lead and appointment writes through fakes", async () => {
    const repairShopr = new FakeRepairShoprWriteExecutor();
    const leadService = createService({ repairShopr });
    const leadExecution = await leadService.executeApprovedApproval(
      managerUser,
      approvalId,
    );

    const appointmentApproval = approvalRecord({
      id: "00000000-0000-4000-8000-000000001005",
      kind: "appointment_creation",
      payload: {
        appointment: {
          status: "staged",
          summary: "Visit",
        },
      },
    });
    const appointmentService = createService({
      approvals: new FakeApprovalStore(appointmentApproval),
      repairShopr,
    });
    const appointmentExecution =
      await appointmentService.executeApprovedApproval(
        managerUser,
        appointmentApproval.id,
      );

    expect(leadExecution).toMatchObject({
      state: "succeeded",
      repairShoprEntityType: "lead",
      repairShoprId: "901",
    });
    expect(appointmentExecution).toMatchObject({
      state: "succeeded",
      repairShoprEntityType: "appointment",
      repairShoprId: "904",
    });
    expect(repairShopr.calls).toEqual([
      { method: "createLead", payload: { first_name: "Casey" } },
      { method: "createAppointment", payload: { summary: "Visit" } },
    ]);
  });

  it("blocks non-allowlisted RepairShopr target updates", async () => {
    const approval = approvalRecord({
      payload: {
        action: "customer_update",
        target: { entityType: "customer", repairShoprId: "123" },
        repairShoprPayload: { firstname: "Casey" },
      },
    });
    const repairShopr = new FakeRepairShoprWriteExecutor();
    const service = createService({
      approvals: new FakeApprovalStore(approval),
      repairShopr,
      repairShoprTestRecordAllowlist: ["999"],
    });

    const execution = await service.executeApprovedApproval(
      managerUser,
      approval.id,
    );

    expect(execution).toMatchObject({
      state: "blocked",
      errorMessage: "RepairShopr target is not allowlisted",
    });
    expect(repairShopr.calls).toEqual([]);
  });

  it("marks RepairShopr API failures as failed and retryable", async () => {
    const repairShopr = new FakeRepairShoprWriteExecutor();
    repairShopr.nextError = new Error("RepairShopr unavailable");
    const service = createService({ repairShopr });

    const failed = await service.executeApprovedApproval(
      managerUser,
      approvalId,
    );

    expect(failed).toMatchObject({
      state: "failed",
      errorMessage: "RepairShopr unavailable",
      attemptCount: 1,
    });
    repairShopr.nextError = null;

    const retried = await service.retryExecution(managerUser, failed.id);

    expect(retried).toMatchObject({
      state: "succeeded",
      attemptCount: 2,
    });
  });

  it("executes approved customer messages through fakes", async () => {
    const approval = approvalRecord({
      kind: "customer_message",
      payload: {
        conversationId: "00000000-0000-4000-8000-000000001006",
        body: "I can check Friday after confirming availability.",
      },
    });
    const customerMessages = new FakeCustomerMessageExecutor();
    const customerMessageStore = new FakeCustomerMessageStore();
    const service = createService({
      approvals: new FakeApprovalStore(approval),
      customerMessages,
      customerMessageStore,
    });

    const execution = await service.executeApprovedApproval(
      managerUser,
      approval.id,
    );

    expect(execution).toMatchObject({
      state: "succeeded",
      responsePayload: {
        messageId: "00000000-0000-4000-8000-000000001007",
        twilioMessageSid: "SMapproved",
        status: "queued",
      },
    });
    expect(customerMessages.sentBodies).toEqual([
      "I can check Friday after confirming availability.",
    ]);
  });

  it("blocks disabled customer-message execution without sending", async () => {
    const approval = approvalRecord({
      kind: "customer_message",
      payload: {
        conversationId: "00000000-0000-4000-8000-000000001006",
        body: "I can check Friday after confirming availability.",
      },
    });
    const customerMessages = new FakeCustomerMessageExecutor();
    customerMessages.enabled = false;
    const service = createService({
      approvals: new FakeApprovalStore(approval),
      customerMessages,
    });

    const execution = await service.executeApprovedApproval(
      managerUser,
      approval.id,
    );

    expect(execution).toMatchObject({
      state: "blocked",
      errorMessage: "Outbound messaging disabled",
    });
    expect(customerMessages.sentBodies).toEqual([]);
  });

  it("rejects retry for non-retryable execution states", async () => {
    const store = new FakeExecutionStore();
    store.execution = { ...store.execution, state: "succeeded" };
    const service = createService({ store });

    await expect(
      service.retryExecution(managerUser, executionId),
    ).rejects.toBeInstanceOf(WritebackExecutionNotRetryableError);
  });

  it("rejects invalid executable approval payloads", async () => {
    const service = createService({
      approvals: new FakeApprovalStore(
        approvalRecord({ payload: { unsupported: true } }),
      ),
    });

    await expect(
      service.executeApprovedApproval(managerUser, approvalId),
    ).rejects.toBeInstanceOf(InvalidWritebackPayloadError);
  });
});

class FakeExecutionStore implements WritebackExecutionStore {
  readonly created: CreateWritebackExecutionInput[] = [];
  execution: WritebackExecution = executionRecord();

  async ensureReadyForApproval(input: CreateWritebackExecutionInput) {
    this.created.push(input);
    this.execution = {
      ...this.execution,
      approvalId: input.approvalId,
      jobId: input.jobId,
      kind: input.kind,
      targetKind: input.targetKind,
      action: input.action,
      requestPayload: input.requestPayload,
    };
    return this.execution;
  }

  async list(_filters?: WritebackExecutionListQuery) {
    return [this.execution];
  }

  async getById(_executionId: string) {
    return this.execution;
  }

  async getByApprovalId(_approvalId: string) {
    return this.execution;
  }

  async markAttemptStarted(_input: MarkWritebackAttemptStartedInput) {
    this.execution = {
      ...this.execution,
      state: "ready",
      attemptCount: this.execution.attemptCount + 1,
      lastAttemptedAt: new Date(),
    };
    return this.execution;
  }

  async markSucceeded(input: MarkWritebackSucceededInput) {
    this.execution = {
      ...this.execution,
      state: "succeeded",
      responsePayload: input.responsePayload,
      errorMessage: null,
      repairShoprEntityType: input.repairShoprEntityType,
      repairShoprId: input.repairShoprId,
      succeededAt: new Date(),
    };
    return this.execution;
  }

  async markFailed(input: MarkWritebackFailedInput) {
    this.execution = {
      ...this.execution,
      state: "failed",
      errorMessage: input.errorMessage,
      responsePayload: input.responsePayload ?? null,
    };
    return this.execution;
  }

  async markBlocked(input: MarkWritebackFailedInput) {
    this.execution = {
      ...this.execution,
      state: "blocked",
      errorMessage: input.errorMessage,
      responsePayload: input.responsePayload ?? null,
    };
    return this.execution;
  }
}

class FakeApprovalStore implements ApprovedApprovalStore {
  constructor(private readonly approval: ApprovalRecord = approvalRecord()) {}

  async getById(_approvalId: string) {
    return this.approval;
  }
}

class FakeRepairShoprWriteExecutor implements RepairShoprWriteExecutor {
  readonly calls: Array<{ method: string; payload: Record<string, unknown> }> =
    [];
  nextError: Error | null = null;

  async updateCustomer(_id: number, payload: Record<string, unknown>) {
    this.calls.push({ method: "updateCustomer", payload });
    return this.record({ id: 101 });
  }

  async updateContact(_id: number, payload: Record<string, unknown>) {
    this.calls.push({ method: "updateContact", payload });
    return this.record({ id: 201 });
  }

  async createLead(payload: Record<string, unknown>) {
    this.calls.push({ method: "createLead", payload });
    return this.record({ id: 901, business_then_name: "Casey" });
  }

  async createTicket(payload: Record<string, unknown>) {
    this.calls.push({ method: "createTicket", payload });
    return this.record({ id: 902, subject: "Repair" });
  }

  async createTicketComment(
    _ticketId: number,
    payload: Record<string, unknown>,
  ) {
    this.calls.push({ method: "createTicketComment", payload });
    return this.record({ id: 903, body: "Note" });
  }

  async createAppointment(payload: Record<string, unknown>) {
    this.calls.push({ method: "createAppointment", payload });
    return this.record({ id: 904, summary: "Visit" });
  }

  private record<T extends { id: number }>(value: T) {
    if (this.nextError) {
      throw this.nextError;
    }
    return value;
  }
}

class FakeCustomerMessageExecutor implements CustomerMessageExecutor {
  enabled = true;
  nextResult: CustomerMessageResult = {
    kind: "sent",
    twilioMessageSid: "SMapproved",
    status: "queued",
  };
  readonly sentBodies: string[] = [];

  isEnabled() {
    return this.enabled;
  }

  async send(input: { toExternalPhone: string; body: string }) {
    this.sentBodies.push(input.body);
    return this.nextResult;
  }
}

class FakeCustomerMessageStore implements CustomerMessageStore {
  async getDetail(_conversationId: string) {
    return {
      id: "00000000-0000-4000-8000-000000001006",
      externalPhone: "+15555550100",
    };
  }

  async createOutboundMessage() {
    return { id: "00000000-0000-4000-8000-000000001007" };
  }

  async markOutboundSent() {}
  async markOutboundBlocked() {}
  async markOutboundFailed() {}
}

function createService({
  approvals = new FakeApprovalStore(),
  customerMessages = new FakeCustomerMessageExecutor(),
  customerMessageStore = new FakeCustomerMessageStore(),
  repairShopr = new FakeRepairShoprWriteExecutor(),
  repairShoprWritebackEnabled = true,
  repairShoprTestRecordAllowlist = [],
  store = new FakeExecutionStore(),
}: Partial<{
  approvals: ApprovedApprovalStore;
  customerMessages: CustomerMessageExecutor | null;
  customerMessageStore: CustomerMessageStore;
  repairShopr: RepairShoprWriteExecutor | null;
  repairShoprWritebackEnabled: boolean;
  repairShoprTestRecordAllowlist: readonly string[];
  store: WritebackExecutionStore;
}> = {}) {
  return new WritebackExecutionService(
    store,
    approvals,
    repairShopr,
    customerMessages,
    customerMessageStore,
    {
      repairShoprWritebackEnabled,
      repairShoprTestRecordAllowlist,
    },
  );
}

function approvalRecord(
  overrides: Partial<ApprovalRecord> = {},
): ApprovalRecord {
  const now = new Date("2026-05-26T00:00:00.000Z");
  return {
    id: approvalId,
    jobId,
    kind: "repairshopr_writeback",
    state: "approved",
    risk: "crm_writeback",
    requiredRole: "manager",
    payload: leadPayload(),
    originalPayload: leadPayload(),
    evidence: [
      {
        messageId: "00000000-0000-4000-8000-000000001008",
        quote: "New lead",
      },
    ],
    createdByUserId: managerUser.id,
    decidedByUserId: managerUser.id,
    decidedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function executionRecord(
  overrides: Partial<WritebackExecution> = {},
): WritebackExecution {
  const now = new Date("2026-05-26T00:00:00.000Z");
  return {
    id: executionId,
    approvalId,
    jobId,
    kind: "repairshopr_writeback",
    state: "ready",
    targetKind: "repairshopr",
    action: "lead_create",
    requestPayload: leadPayload(),
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

function leadPayload() {
  return {
    action: "lead_create" as const,
    target: { entityType: "lead" as const, displayLabel: "New lead" },
    repairShoprPayload: { first_name: "Casey" },
  };
}
