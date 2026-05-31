import type {
  ApprovalRecord,
  CreateApprovalRequest,
  SchedulingProposal,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import type {
  EditSchedulingProposalPatch,
  ListSchedulingFilters,
} from "../repositories/scheduling-proposals-repository.js";
import {
  type SchedulingApprovalService,
  SchedulingProposalNotFoundError,
  SchedulingProposalNotPendingError,
  SchedulingProposalService,
  type SchedulingProposalStore,
  UnsafeSchedulingWordingError,
} from "./scheduling-proposal-service.js";

const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000020",
  role: "tech",
  displayName: "Tech",
};

const baseProposal: SchedulingProposal = {
  id: "00000000-0000-4000-8000-000000080100",
  conversationId: "00000000-0000-4000-8000-000000080200",
  jobId: null,
  state: "pending",
  preferredWindowText: "Tomorrow afternoon",
  startAt: null,
  endAt: null,
  customerMessageBody:
    "I can come tomorrow afternoon after I confirm the exact time.",
  repairShoprAppointmentPayload: { status: "staged" },
  sourceEvidence: [
    { messageId: "00000000-0000-4000-8000-000000080300", quote: "tomorrow" },
  ],
  customerMessageApprovalId: "00000000-0000-4000-8000-000000080400",
  appointmentApprovalId: "00000000-0000-4000-8000-000000080401",
  decidedByUserId: null,
  decidedAt: null,
  createdAt: new Date("2026-05-26T00:00:00.000Z"),
  updatedAt: new Date("2026-05-26T00:00:00.000Z"),
};

class FakeStore implements SchedulingProposalStore {
  proposal: SchedulingProposal | null = baseProposal;
  pendingFromList: SchedulingProposal[] = [baseProposal];
  decidedFromList: SchedulingProposal[] = [];
  readonly createCalls: Array<
    Parameters<SchedulingProposalStore["create"]>[0]
  > = [];

  async create(input: Parameters<SchedulingProposalStore["create"]>[0]) {
    this.createCalls.push(input);
    const created: SchedulingProposal = {
      ...baseProposal,
      id: "00000000-0000-4000-8000-000000080500",
      conversationId: input.conversationId,
      jobId: input.jobId,
      preferredWindowText: input.preferredWindowText,
      customerMessageBody: input.customerMessageBody,
      sourceEvidence: input.sourceEvidence,
      repairShoprAppointmentPayload: input.repairShoprAppointmentPayload,
      customerMessageApprovalId: input.customerMessageApprovalId,
      appointmentApprovalId: input.appointmentApprovalId,
    };
    return created;
  }
  async list(_filters?: ListSchedulingFilters) {
    return {
      pending: this.pendingFromList,
      decided: this.decidedFromList,
    };
  }
  async getById(_proposalId: string) {
    return this.proposal;
  }
  async updatePending(_proposalId: string, patch: EditSchedulingProposalPatch) {
    if (!this.proposal) {
      return null;
    }
    this.proposal = {
      ...this.proposal,
      preferredWindowText:
        patch.preferredWindowText ?? this.proposal.preferredWindowText,
      customerMessageBody:
        patch.customerMessageBody ?? this.proposal.customerMessageBody,
    };
    return this.proposal;
  }
  async setState(input: Parameters<SchedulingProposalStore["setState"]>[0]) {
    if (!this.proposal) {
      return null;
    }
    this.proposal = {
      ...this.proposal,
      state: input.state,
      decidedByUserId: input.actorUserId,
      decidedAt: new Date(),
    };
    return this.proposal;
  }
}

class FakeApprovalService implements SchedulingApprovalService {
  readonly creates: Array<{ user: SessionUser; input: CreateApprovalRequest }> =
    [];
  readonly approved: string[] = [];
  readonly rejected: Array<{ id: string; reason: string | undefined }> = [];
  nextId = 0;

  async createApproval(user: SessionUser, input: CreateApprovalRequest) {
    this.creates.push({ user, input });
    this.nextId += 1;
    const approval: ApprovalRecord = {
      id: `00000000-0000-4000-8000-${this.nextId.toString().padStart(12, "0")}`,
      jobId: input.jobId ?? null,
      kind: input.kind,
      state: "pending",
      risk: input.risk,
      requiredRole: input.requiredRole,
      payload: input.payload,
      originalPayload: input.payload,
      evidence: input.evidence,
      createdByUserId: user.id,
      decidedByUserId: null,
      decidedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return approval;
  }
  async approveApproval(user: SessionUser, approvalId: string) {
    this.approved.push(approvalId);
    return decisionRecord(approvalId, user, "approved");
  }
  async rejectApproval(
    user: SessionUser,
    approvalId: string,
    input: { reason?: string },
  ) {
    this.rejected.push({ id: approvalId, reason: input.reason });
    return decisionRecord(approvalId, user, "rejected");
  }
}

describe("SchedulingProposalService", () => {
  it("creates a proposal with linked approvals and staged appointment payload", async () => {
    const store = new FakeStore();
    store.proposal = null;
    const approvals = new FakeApprovalService();
    const service = new SchedulingProposalService(store, approvals);

    const proposal = await service.generateFromConversation(techUser, {
      conversationId: baseProposal.conversationId,
      jobId: null,
      preferredWindowText: "Tomorrow afternoon",
      startAt: null,
      endAt: null,
      customerMessageBody:
        "I can come tomorrow afternoon after I confirm the exact time.",
      sourceEvidence: [
        {
          messageId: "00000000-0000-4000-8000-000000080300",
          quote: "tomorrow",
        },
      ],
    });

    expect(approvals.creates).toHaveLength(2);
    expect(approvals.creates[0]?.input.kind).toBe("customer_message");
    expect(approvals.creates[1]?.input.kind).toBe("appointment_creation");
    expect(proposal.customerMessageApprovalId).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(proposal.appointmentApprovalId).toBe(
      "00000000-0000-4000-8000-000000000002",
    );
    expect(proposal.repairShoprAppointmentPayload.status).toBe("staged");
  });

  it("rejects unsafe wording on generate", async () => {
    const store = new FakeStore();
    store.proposal = null;
    const service = new SchedulingProposalService(
      store,
      new FakeApprovalService(),
    );

    await expect(
      service.generateFromConversation(techUser, {
        conversationId: baseProposal.conversationId,
        jobId: null,
        preferredWindowText: "Tomorrow",
        startAt: null,
        endAt: null,
        customerMessageBody: "We will be there at 2 pm confirmed",
        sourceEvidence: [
          {
            messageId: "00000000-0000-4000-8000-000000080300",
            quote: "confirm",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnsafeSchedulingWordingError);
  });

  it("rejects unsafe edits and accepts safe edits", async () => {
    const store = new FakeStore();
    const service = new SchedulingProposalService(
      store,
      new FakeApprovalService(),
    );

    await expect(
      service.editProposal(techUser, baseProposal.id, {
        customerMessageBody: "We are booked for 2 pm tomorrow",
      }),
    ).rejects.toBeInstanceOf(UnsafeSchedulingWordingError);

    const updated = await service.editProposal(techUser, baseProposal.id, {
      preferredWindowText: "Friday morning",
    });
    expect(updated.preferredWindowText).toBe("Friday morning");
  });

  it("approves linked approvals and updates the proposal state", async () => {
    const store = new FakeStore();
    const approvals = new FakeApprovalService();
    const service = new SchedulingProposalService(store, approvals);

    const result = await service.approveProposal(techUser, baseProposal.id);

    expect(result.state).toBe("approved");
    expect(approvals.approved).toEqual([
      baseProposal.customerMessageApprovalId,
      baseProposal.appointmentApprovalId,
    ]);
  });

  it("rejects linked approvals and updates the proposal state", async () => {
    const store = new FakeStore();
    const approvals = new FakeApprovalService();
    const service = new SchedulingProposalService(store, approvals);

    const result = await service.rejectProposal(techUser, baseProposal.id, {
      reason: "Customer cannot make it",
    });
    expect(result.state).toBe("rejected");
    expect(approvals.rejected).toHaveLength(2);
    expect(approvals.rejected[0]?.reason).toBe("Customer cannot make it");
  });

  it("throws when the proposal does not exist", async () => {
    const store = new FakeStore();
    store.proposal = null;
    const service = new SchedulingProposalService(
      store,
      new FakeApprovalService(),
    );
    await expect(
      service.approveProposal(techUser, baseProposal.id),
    ).rejects.toBeInstanceOf(SchedulingProposalNotFoundError);
  });

  it("throws when the proposal has already been decided", async () => {
    const store = new FakeStore();
    store.proposal = { ...baseProposal, state: "rejected" };
    const service = new SchedulingProposalService(
      store,
      new FakeApprovalService(),
    );
    await expect(
      service.approveProposal(techUser, baseProposal.id),
    ).rejects.toBeInstanceOf(SchedulingProposalNotPendingError);
  });
});

function decisionRecord(
  approvalId: string,
  user: SessionUser,
  state: "approved" | "rejected",
): ApprovalRecord {
  return {
    id: approvalId,
    jobId: null,
    kind: "customer_message",
    state,
    risk: "scheduling",
    requiredRole: "tech",
    payload: {},
    originalPayload: {},
    evidence: [
      { messageId: "00000000-0000-4000-8000-000000080300", quote: "x" },
    ],
    createdByUserId: user.id,
    decidedByUserId: user.id,
    decidedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
