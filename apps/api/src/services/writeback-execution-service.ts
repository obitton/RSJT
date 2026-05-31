import type {
  AppointmentCreationPayload,
  ApprovalKind,
  ApprovalRecord,
  CustomerMessageExecutionPayload,
  RepairShoprEntityType,
  RepairShoprWritebackPayload,
  SessionUser,
  WritebackExecution,
  WritebackExecutionListQuery,
} from "@rsjt/shared";
import {
  AppointmentCreationPayloadSchema,
  CustomerMessageExecutionPayloadSchema,
  RepairShoprWritebackPayloadSchema,
} from "@rsjt/shared";
import type {
  RepairShoprAppointment,
  RepairShoprContact,
  RepairShoprCustomer,
  RepairShoprLead,
  RepairShoprTicket,
  RepairShoprTicketComment,
} from "../integrations/repairshopr/repairshopr-types.js";
import type {
  CreateOutboundMessageInput,
  MarkOutboundFailedInput,
  MarkOutboundSentInput,
} from "../repositories/conversations-repository.js";
import type {
  CreateWritebackExecutionInput,
  MarkWritebackAttemptStartedInput,
  MarkWritebackFailedInput,
  MarkWritebackSucceededInput,
} from "../repositories/writeback-executions-repository.js";
import type { ApprovalExecutionHandoff } from "./approval-service.js";

type RepairShoprWriteResult =
  | RepairShoprCustomer
  | RepairShoprContact
  | RepairShoprLead
  | RepairShoprTicket
  | RepairShoprAppointment
  | RepairShoprTicketComment;

export interface WritebackExecutionStore {
  ensureReadyForApproval(
    input: CreateWritebackExecutionInput,
  ): Promise<WritebackExecution>;
  list(filters?: WritebackExecutionListQuery): Promise<WritebackExecution[]>;
  getById(executionId: string): Promise<WritebackExecution | null>;
  getByApprovalId(approvalId: string): Promise<WritebackExecution | null>;
  markAttemptStarted(
    input: MarkWritebackAttemptStartedInput,
  ): Promise<WritebackExecution | null>;
  markSucceeded(
    input: MarkWritebackSucceededInput,
  ): Promise<WritebackExecution | null>;
  markFailed(
    input: MarkWritebackFailedInput,
  ): Promise<WritebackExecution | null>;
  markBlocked(
    input: MarkWritebackFailedInput,
  ): Promise<WritebackExecution | null>;
}

export interface ApprovedApprovalStore {
  getById(approvalId: string): Promise<ApprovalRecord | null>;
}

export interface RepairShoprWriteExecutor {
  updateCustomer(
    id: number,
    payload: Record<string, unknown>,
  ): Promise<RepairShoprCustomer>;
  updateContact(
    id: number,
    payload: Record<string, unknown>,
  ): Promise<RepairShoprContact>;
  createLead(payload: Record<string, unknown>): Promise<RepairShoprLead>;
  createTicket(payload: Record<string, unknown>): Promise<RepairShoprTicket>;
  createTicketComment(
    ticketId: number,
    payload: Record<string, unknown>,
  ): Promise<RepairShoprTicketComment>;
  createAppointment(
    payload: Record<string, unknown>,
  ): Promise<RepairShoprAppointment>;
}

export type CustomerMessageResult =
  | {
      kind: "sent";
      twilioMessageSid: string;
      status: string;
    }
  | {
      kind: "disabled";
      reason: string;
    }
  | {
      kind: "failed";
      reason: string;
    };

export interface CustomerMessageExecutor {
  isEnabled(): boolean;
  send(input: {
    toExternalPhone: string;
    body: string;
  }): Promise<CustomerMessageResult>;
}

export interface CustomerMessageStore {
  getDetail(conversationId: string): Promise<{
    id: string;
    externalPhone: string | null;
  } | null>;
  createOutboundMessage(input: CreateOutboundMessageInput): Promise<{
    id: string;
  }>;
  markOutboundSent(input: MarkOutboundSentInput): Promise<unknown>;
  markOutboundBlocked(input: MarkOutboundFailedInput): Promise<unknown>;
  markOutboundFailed(input: MarkOutboundFailedInput): Promise<unknown>;
}

export type WritebackExecutionOptions = {
  repairShoprWritebackEnabled: boolean;
  repairShoprTestRecordAllowlist: readonly string[];
};

export interface WritebackExecutionServiceApi {
  listExecutions(
    user: SessionUser,
    filters?: WritebackExecutionListQuery,
  ): Promise<WritebackExecution[]>;
  executeApprovedApproval(
    user: SessionUser,
    approvalId: string,
  ): Promise<WritebackExecution>;
  retryExecution(
    user: SessionUser,
    executionId: string,
  ): Promise<WritebackExecution>;
}

export class WritebackApprovalNotFoundError extends Error {
  constructor() {
    super("Approval not found");
  }
}

export class WritebackExecutionNotFoundError extends Error {
  constructor() {
    super("Writeback execution not found");
  }
}

export class WritebackApprovalNotApprovedError extends Error {
  constructor() {
    super("Approval is not approved");
  }
}

export class WritebackExecutionNotRetryableError extends Error {
  constructor() {
    super("Writeback execution is not retryable");
  }
}

export class InvalidWritebackPayloadError extends Error {
  constructor() {
    super("Invalid writeback payload");
  }
}

export class WritebackExecutionService
  implements WritebackExecutionServiceApi, ApprovalExecutionHandoff
{
  constructor(
    private readonly store: WritebackExecutionStore,
    private readonly approvals: ApprovedApprovalStore,
    private readonly repairShopr: RepairShoprWriteExecutor | null,
    private readonly customerMessages: CustomerMessageExecutor | null,
    private readonly customerMessageStore: CustomerMessageStore,
    private readonly options: WritebackExecutionOptions,
  ) {}

  async onApprovalApproved(_user: SessionUser, approval: ApprovalRecord) {
    if (!isExecutableKind(approval.kind)) {
      return;
    }

    const input = toExecutionInput(approval);
    await this.store.ensureReadyForApproval(input);
  }

  async listExecutions(
    _user: SessionUser,
    filters: WritebackExecutionListQuery = {},
  ) {
    return this.store.list(filters);
  }

  async executeApprovedApproval(user: SessionUser, approvalId: string) {
    const approval = await this.requireApprovedApproval(approvalId);
    const input = toExecutionInput(approval);
    const execution = await this.store.ensureReadyForApproval(input);
    return this.execute(user, approval, execution);
  }

  async retryExecution(user: SessionUser, executionId: string) {
    const execution = await this.store.getById(executionId);
    if (!execution) {
      throw new WritebackExecutionNotFoundError();
    }
    if (execution.state !== "failed" && execution.state !== "blocked") {
      throw new WritebackExecutionNotRetryableError();
    }

    const approval = await this.requireApprovedApproval(execution.approvalId);
    return this.execute(user, approval, execution);
  }

  private async requireApprovedApproval(approvalId: string) {
    const approval = await this.approvals.getById(approvalId);
    if (!approval) {
      throw new WritebackApprovalNotFoundError();
    }
    if (approval.state !== "approved") {
      throw new WritebackApprovalNotApprovedError();
    }
    return approval;
  }

  private async execute(
    user: SessionUser,
    approval: ApprovalRecord,
    execution: WritebackExecution,
  ) {
    const started = await this.store.markAttemptStarted({
      executionId: execution.id,
      actorUserId: user.id,
    });
    if (!started) {
      throw new WritebackExecutionNotFoundError();
    }

    try {
      if (approval.kind === "customer_message") {
        return await this.executeCustomerMessage(user, started);
      }

      return await this.executeRepairShopr(user, started);
    } catch (error) {
      const failed = await this.store.markFailed({
        executionId: started.id,
        actorUserId: user.id,
        errorMessage:
          error instanceof Error ? error.message : "Writeback execution failed",
      });
      if (!failed) {
        throw new WritebackExecutionNotFoundError();
      }
      return failed;
    }
  }

  private async executeRepairShopr(
    user: SessionUser,
    execution: WritebackExecution,
  ) {
    if (!this.options.repairShoprWritebackEnabled || !this.repairShopr) {
      return this.markBlocked(
        execution.id,
        user.id,
        "RepairShopr writes disabled",
      );
    }

    const payload = repairShoprPayloadFromExecution(execution);
    const targetId = targetRepairShoprId(payload);
    if (
      targetId &&
      this.options.repairShoprTestRecordAllowlist.length > 0 &&
      !this.options.repairShoprTestRecordAllowlist.includes(targetId)
    ) {
      return this.markBlocked(
        execution.id,
        user.id,
        "RepairShopr target is not allowlisted",
      );
    }

    const result = await this.executeRepairShoprPayload(payload);
    const reference = repairShoprReferenceForPayload(payload, result);
    const succeeded = await this.store.markSucceeded({
      executionId: execution.id,
      actorUserId: user.id,
      responsePayload: { id: result.id },
      repairShoprEntityType: reference.entityType,
      repairShoprId: reference.repairShoprId,
    });
    if (!succeeded) {
      throw new WritebackExecutionNotFoundError();
    }
    return succeeded;
  }

  private async executeCustomerMessage(
    user: SessionUser,
    execution: WritebackExecution,
  ) {
    if (!this.customerMessages || !this.customerMessages.isEnabled()) {
      return this.markBlocked(
        execution.id,
        user.id,
        "Outbound messaging disabled",
      );
    }

    const payload = CustomerMessageExecutionPayloadSchema.parse(
      execution.requestPayload,
    );
    const conversation = await this.customerMessageStore.getDetail(
      payload.conversationId,
    );
    if (!conversation?.externalPhone) {
      throw new Error("Conversation has no external phone");
    }

    const draft = await this.customerMessageStore.createOutboundMessage({
      conversationId: payload.conversationId,
      body: payload.body,
      sentByUserId: user.id,
      authorRole: user.role,
    });
    const result = await this.customerMessages.send({
      toExternalPhone: conversation.externalPhone,
      body: payload.body,
    });

    if (result.kind === "disabled") {
      await this.customerMessageStore.markOutboundBlocked({
        messageId: draft.id,
        reason: result.reason,
      });
      return this.markBlocked(execution.id, user.id, result.reason);
    }
    if (result.kind === "failed") {
      await this.customerMessageStore.markOutboundFailed({
        messageId: draft.id,
        reason: result.reason,
      });
      throw new Error(result.reason);
    }

    await this.customerMessageStore.markOutboundSent({
      messageId: draft.id,
      twilioMessageSid: result.twilioMessageSid,
      status: result.status,
    });
    const succeeded = await this.store.markSucceeded({
      executionId: execution.id,
      actorUserId: user.id,
      responsePayload: {
        messageId: draft.id,
        twilioMessageSid: result.twilioMessageSid,
        status: result.status,
      },
      repairShoprEntityType: null,
      repairShoprId: null,
    });
    if (!succeeded) {
      throw new WritebackExecutionNotFoundError();
    }
    return succeeded;
  }

  private async executeRepairShoprPayload(
    payload: RepairShoprWritebackPayload,
  ): Promise<RepairShoprWriteResult> {
    if (!this.repairShopr) {
      throw new Error("RepairShopr writes disabled");
    }

    switch (payload.action) {
      case "customer_update":
        return this.repairShopr.updateCustomer(
          Number(payload.target.repairShoprId),
          payload.repairShoprPayload,
        );
      case "contact_update":
        return this.repairShopr.updateContact(
          Number(payload.target.repairShoprId),
          payload.repairShoprPayload,
        );
      case "lead_create":
        return this.repairShopr.createLead(payload.repairShoprPayload);
      case "ticket_create":
        return this.repairShopr.createTicket(payload.repairShoprPayload);
      case "ticket_comment_create":
        return this.repairShopr.createTicketComment(
          Number(payload.target.repairShoprId),
          payload.repairShoprPayload,
        );
      case "appointment_create":
        return this.repairShopr.createAppointment(payload.repairShoprPayload);
    }
  }

  private async markBlocked(
    executionId: string,
    actorUserId: string,
    errorMessage: string,
  ) {
    const blocked = await this.store.markBlocked({
      executionId,
      actorUserId,
      errorMessage,
    });
    if (!blocked) {
      throw new WritebackExecutionNotFoundError();
    }
    return blocked;
  }
}

function isExecutableKind(kind: ApprovalKind) {
  return (
    kind === "repairshopr_writeback" ||
    kind === "appointment_creation" ||
    kind === "customer_message"
  );
}

function toExecutionInput(
  approval: ApprovalRecord,
): CreateWritebackExecutionInput {
  if (approval.kind === "repairshopr_writeback") {
    const payload = RepairShoprWritebackPayloadSchema.safeParse(
      approval.payload,
    );
    if (!payload.success) {
      throw new InvalidWritebackPayloadError();
    }
    return {
      approvalId: approval.id,
      jobId: approval.jobId,
      kind: approval.kind,
      targetKind: "repairshopr",
      action: payload.data.action,
      requestPayload: payload.data,
    };
  }

  if (approval.kind === "appointment_creation") {
    const payload = AppointmentCreationPayloadSchema.safeParse(
      approval.payload,
    );
    if (!payload.success) {
      throw new InvalidWritebackPayloadError();
    }
    return {
      approvalId: approval.id,
      jobId: approval.jobId ?? payload.data.jobId ?? null,
      kind: approval.kind,
      targetKind: "repairshopr",
      action: "appointment_create",
      requestPayload: payload.data,
    };
  }

  if (approval.kind === "customer_message") {
    const payload = CustomerMessageExecutionPayloadSchema.safeParse(
      approval.payload,
    );
    if (!payload.success) {
      throw new InvalidWritebackPayloadError();
    }
    return {
      approvalId: approval.id,
      jobId: approval.jobId ?? payload.data.jobId ?? null,
      kind: approval.kind,
      targetKind: "customer_message",
      action: "customer_message_send",
      requestPayload: payload.data,
    };
  }

  throw new InvalidWritebackPayloadError();
}

function repairShoprPayloadFromExecution(
  execution: WritebackExecution,
): RepairShoprWritebackPayload {
  if (execution.kind === "appointment_creation") {
    const payload = AppointmentCreationPayloadSchema.parse(
      execution.requestPayload,
    );
    return {
      action: "appointment_create",
      target: { entityType: "appointment" },
      repairShoprPayload: normalizeAppointmentPayload(payload),
    };
  }

  return RepairShoprWritebackPayloadSchema.parse(execution.requestPayload);
}

function normalizeAppointmentPayload(payload: AppointmentCreationPayload) {
  return Object.fromEntries(
    Object.entries(payload.appointment).filter(([key]) => key !== "status"),
  );
}

function targetRepairShoprId(payload: RepairShoprWritebackPayload) {
  return "repairShoprId" in payload.target
    ? payload.target.repairShoprId
    : undefined;
}

function repairShoprReferenceForPayload(
  payload: RepairShoprWritebackPayload,
  result: RepairShoprWriteResult,
): { entityType: RepairShoprEntityType; repairShoprId: string } {
  if (payload.action === "ticket_comment_create") {
    return {
      entityType: "ticket_comment",
      repairShoprId: String(result.id),
    };
  }

  return {
    entityType: payload.target.entityType,
    repairShoprId: String(result.id),
  };
}
