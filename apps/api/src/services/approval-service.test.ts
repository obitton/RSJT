import type {
  ApprovalFilterQuery,
  ApprovalPayload,
  ApprovalRecord,
  ApprovalState,
  CreateApprovalRequest,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import type {
  ApprovalStateMetadata,
  CreateApprovalInput,
} from "../repositories/approvals-repository.js";
import {
  type ApprovalExecutionHandoff,
  ApprovalNotPendingError,
  ApprovalRoleError,
  ApprovalService,
  type ApprovalStore,
} from "./approval-service.js";

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};
const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000002",
  role: "tech",
  displayName: "Tech",
};
const approvalId = "00000000-0000-4000-8000-000000000301";
const messageId = "00000000-0000-4000-8000-000000000201";

describe("ApprovalService", () => {
  it("creates approvals with the authenticated creator", async () => {
    const store = new InMemoryApprovalStore();
    const service = new ApprovalService(store);

    const approval = await service.createApproval(
      techUser,
      createApprovalRequest({ requiredRole: "manager" }),
    );

    expect(approval).toMatchObject({
      createdByUserId: techUser.id,
      requiredRole: "manager",
      state: "pending",
    });
  });

  it("blocks tech users from manager-required approvals", async () => {
    const store = new InMemoryApprovalStore([
      approvalRecord({ requiredRole: "manager" }),
    ]);
    const service = new ApprovalService(store);

    await expect(service.approveApproval(techUser, approvalId)).rejects.toThrow(
      ApprovalRoleError,
    );
  });

  it("lets manager users approve manager-required approvals without execution", async () => {
    const store = new InMemoryApprovalStore([
      approvalRecord({ requiredRole: "manager" }),
    ]);
    const service = new ApprovalService(store);

    const approval = await service.approveApproval(managerUser, approvalId);

    expect(approval).toMatchObject({
      id: approvalId,
      state: "approved",
      decidedByUserId: managerUser.id,
    });
    expect(store.executions).toEqual([]);
  });

  it("calls approval handoff after approval succeeds", async () => {
    const store = new InMemoryApprovalStore([
      approvalRecord({ requiredRole: "manager" }),
    ]);
    const handoff = new FakeApprovalHandoff();
    const service = new ApprovalService(store, handoff);

    const approval = await service.approveApproval(managerUser, approvalId);

    expect(approval.state).toBe("approved");
    expect(handoff.calls).toEqual([{ user: managerUser, approval }]);
  });

  it("does not undo approval when approval handoff fails", async () => {
    const store = new InMemoryApprovalStore([
      approvalRecord({ requiredRole: "manager" }),
    ]);
    const handoff = new FakeApprovalHandoff();
    handoff.nextError = new Error("Handoff failed");
    const service = new ApprovalService(store, handoff);

    const approval = await service.approveApproval(managerUser, approvalId);

    expect(approval.state).toBe("approved");
    expect(handoff.calls).toHaveLength(1);
  });

  it("lets tech users reject tech-required approvals without execution", async () => {
    const store = new InMemoryApprovalStore([
      approvalRecord({ requiredRole: "tech" }),
    ]);
    const service = new ApprovalService(store);

    const approval = await service.rejectApproval(techUser, approvalId, {
      reason: "Needs another time.",
    });

    expect(approval).toMatchObject({
      id: approvalId,
      state: "rejected",
      decidedByUserId: techUser.id,
    });
    expect(store.metadata).toEqual([{ reason: "Needs another time." }]);
    expect(store.executions).toEqual([]);
  });

  it("preserves original payload when editing a pending approval", async () => {
    const store = new InMemoryApprovalStore([
      approvalRecord({
        requiredRole: "tech",
        payload: { body: "Schedule tomorrow." },
        originalPayload: { body: "Schedule tomorrow." },
      }),
    ]);
    const service = new ApprovalService(store);

    const approval = await service.editApproval(techUser, approvalId, {
      payload: { body: "Schedule between 2 and 4." },
    });

    expect(approval).toMatchObject({
      payload: { body: "Schedule between 2 and 4." },
      originalPayload: { body: "Schedule tomorrow." },
    });
  });

  it("rejects lifecycle changes after an approval is no longer pending", async () => {
    const store = new InMemoryApprovalStore([
      approvalRecord({ state: "approved" }),
    ]);
    const service = new ApprovalService(store);

    await expect(
      service.rejectApproval(managerUser, approvalId, {}),
    ).rejects.toThrow(ApprovalNotPendingError);
  });
});

class InMemoryApprovalStore implements ApprovalStore {
  readonly approvals = new Map<string, ApprovalRecord>();
  readonly executions: unknown[] = [];
  readonly metadata: ApprovalStateMetadata[] = [];

  constructor(initialApprovals: ApprovalRecord[] = []) {
    for (const approval of initialApprovals) {
      this.approvals.set(approval.id, approval);
    }
  }

  async create(input: CreateApprovalInput) {
    const approval = approvalRecord({
      id: approvalId,
      jobId: input.jobId ?? null,
      kind: input.kind,
      risk: input.risk,
      requiredRole: input.requiredRole,
      payload: input.payload,
      originalPayload: input.payload,
      evidence: input.evidence,
      createdByUserId: input.createdByUserId,
      state: "pending",
    });
    this.approvals.set(approval.id, approval);
    return approval;
  }

  async list(_filters?: ApprovalFilterQuery) {
    return [...this.approvals.values()];
  }

  async getById(id: string) {
    return this.approvals.get(id) ?? null;
  }

  async editPending(
    id: string,
    _actorUserId: string,
    payload: ApprovalPayload,
  ) {
    const approval = this.approvals.get(id);
    if (!approval || approval.state !== "pending") {
      return null;
    }

    const editedApproval = { ...approval, payload, updatedAt: new Date() };
    this.approvals.set(id, editedApproval);
    return editedApproval;
  }

  async setState(
    id: string,
    state: Exclude<ApprovalState, "pending" | "executed" | "failed">,
    actorUserId: string,
    metadata: ApprovalStateMetadata = {},
  ) {
    const approval = this.approvals.get(id);
    if (!approval || approval.state !== "pending") {
      return null;
    }

    this.metadata.push(metadata);
    const decidedApproval = {
      ...approval,
      state,
      decidedByUserId: actorUserId,
      decidedAt: new Date(),
      updatedAt: new Date(),
    };
    this.approvals.set(id, decidedApproval);
    return decidedApproval;
  }
}

class FakeApprovalHandoff implements ApprovalExecutionHandoff {
  readonly calls: Array<{ user: SessionUser; approval: ApprovalRecord }> = [];
  nextError: Error | null = null;

  async onApprovalApproved(user: SessionUser, approval: ApprovalRecord) {
    this.calls.push({ user, approval });
    if (this.nextError) {
      throw this.nextError;
    }
  }
}

function createApprovalRequest(
  overrides: Partial<CreateApprovalRequest> = {},
): CreateApprovalRequest {
  return {
    kind: "customer_message",
    risk: "scheduling",
    requiredRole: "tech",
    payload: { body: "Schedule tomorrow." },
    evidence: [{ messageId, quote: "Schedule tomorrow." }],
    ...overrides,
  };
}

function approvalRecord(
  overrides: Partial<ApprovalRecord> = {},
): ApprovalRecord {
  const now = new Date("2026-05-22T12:00:00.000Z");

  return {
    id: approvalId,
    jobId: null,
    kind: "customer_message",
    state: "pending",
    risk: "scheduling",
    requiredRole: "tech",
    payload: { body: "Schedule tomorrow." },
    originalPayload: { body: "Schedule tomorrow." },
    evidence: [{ messageId, quote: "Schedule tomorrow." }],
    createdByUserId: techUser.id,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
