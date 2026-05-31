import type {
  ApprovalFilterQuery,
  ApprovalPayload,
  ApprovalRecord,
  ApprovalState,
  CreateApprovalRequest,
  EditApprovalRequest,
  RejectApprovalRequest,
  SessionUser,
} from "@rsjt/shared";
import type {
  ApprovalStateMetadata,
  CreateApprovalInput,
} from "../repositories/approvals-repository.js";

type DecisionState = Exclude<ApprovalState, "pending" | "executed" | "failed">;

export interface ApprovalStore {
  create(input: CreateApprovalInput): Promise<ApprovalRecord>;
  list(filters?: ApprovalFilterQuery): Promise<ApprovalRecord[]>;
  getById(id: string): Promise<ApprovalRecord | null>;
  editPending(
    id: string,
    actorUserId: string,
    payload: ApprovalPayload,
  ): Promise<ApprovalRecord | null>;
  setState(
    id: string,
    state: DecisionState,
    actorUserId: string,
    metadata?: ApprovalStateMetadata,
  ): Promise<ApprovalRecord | null>;
}

export interface ApprovalServiceApi {
  createApproval(
    user: SessionUser,
    input: CreateApprovalRequest,
  ): Promise<ApprovalRecord>;
  listApprovals(filters?: ApprovalFilterQuery): Promise<ApprovalRecord[]>;
  editApproval(
    user: SessionUser,
    approvalId: string,
    input: EditApprovalRequest,
  ): Promise<ApprovalRecord>;
  approveApproval(
    user: SessionUser,
    approvalId: string,
  ): Promise<ApprovalRecord>;
  rejectApproval(
    user: SessionUser,
    approvalId: string,
    input: RejectApprovalRequest,
  ): Promise<ApprovalRecord>;
  expireApproval(
    user: SessionUser,
    approvalId: string,
  ): Promise<ApprovalRecord>;
}

export interface ApprovalExecutionHandoff {
  onApprovalApproved(
    user: SessionUser,
    approval: ApprovalRecord,
  ): Promise<void>;
}

export class ApprovalNotFoundError extends Error {
  constructor() {
    super("Approval not found");
  }
}

export class ApprovalNotPendingError extends Error {
  constructor() {
    super("Approval is not pending");
  }
}

export class ApprovalRoleError extends Error {
  constructor() {
    super("Insufficient role");
  }
}

export class ApprovalService implements ApprovalServiceApi {
  constructor(
    private readonly store: ApprovalStore,
    private readonly handoff?: ApprovalExecutionHandoff,
  ) {}

  async createApproval(user: SessionUser, input: CreateApprovalRequest) {
    return this.store.create({
      ...input,
      createdByUserId: user.id,
    });
  }

  async listApprovals(filters: ApprovalFilterQuery = {}) {
    return this.store.list(filters);
  }

  async editApproval(
    user: SessionUser,
    approvalId: string,
    input: EditApprovalRequest,
  ) {
    const approval = await this.requirePendingApproval(approvalId);
    enforceRole(user, approval);

    return this.setPendingPayload(approvalId, user.id, input.payload);
  }

  async approveApproval(user: SessionUser, approvalId: string) {
    const approval = await this.requirePendingApproval(approvalId);
    enforceRole(user, approval);

    const approved = await this.setPendingState(
      approvalId,
      "approved",
      user.id,
    );
    await this.runApprovalHandoff(user, approved);
    return approved;
  }

  async rejectApproval(
    user: SessionUser,
    approvalId: string,
    input: RejectApprovalRequest,
  ) {
    const approval = await this.requirePendingApproval(approvalId);
    enforceRole(user, approval);

    return this.setPendingState(
      approvalId,
      "rejected",
      user.id,
      input.reason ? { reason: input.reason } : {},
    );
  }

  async expireApproval(user: SessionUser, approvalId: string) {
    const approval = await this.requirePendingApproval(approvalId);
    enforceRole(user, approval);

    return this.setPendingState(approvalId, "expired", user.id);
  }

  private async requirePendingApproval(approvalId: string) {
    const approval = await this.store.getById(approvalId);
    if (!approval) {
      throw new ApprovalNotFoundError();
    }

    if (approval.state !== "pending") {
      throw new ApprovalNotPendingError();
    }

    return approval;
  }

  private async setPendingPayload(
    approvalId: string,
    actorUserId: string,
    payload: ApprovalPayload,
  ) {
    const approval = await this.store.editPending(
      approvalId,
      actorUserId,
      payload,
    );

    if (!approval) {
      throw new ApprovalNotPendingError();
    }

    return approval;
  }

  private async setPendingState(
    approvalId: string,
    state: DecisionState,
    actorUserId: string,
    metadata?: ApprovalStateMetadata,
  ) {
    const approval = await this.store.setState(
      approvalId,
      state,
      actorUserId,
      metadata,
    );

    if (!approval) {
      throw new ApprovalNotPendingError();
    }

    return approval;
  }

  private async runApprovalHandoff(
    user: SessionUser,
    approval: ApprovalRecord,
  ) {
    if (!this.handoff) {
      return;
    }

    try {
      await this.handoff.onApprovalApproved(user, approval);
    } catch {
      return;
    }
  }
}

function enforceRole(user: SessionUser, approval: ApprovalRecord) {
  if (user.role === "manager") {
    return;
  }

  if (approval.requiredRole === user.role) {
    return;
  }

  throw new ApprovalRoleError();
}
