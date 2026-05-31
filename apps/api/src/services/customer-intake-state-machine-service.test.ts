import type {
  ApprovalRecord,
  CreateApprovalRequest,
  CustomerIntakeSnapshot,
  CustomerIntakeState,
  MatchConfidenceBand,
  RepairShoprReference,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import type {
  ConversationFieldsPatch,
  InboundMessageSummary,
} from "../repositories/intake-repository.js";
import {
  type CustomerIntakeApprovalStore,
  type CustomerIntakeMatcher,
  CustomerIntakeStateMachineService,
  type CustomerIntakeStore,
} from "./customer-intake-state-machine-service.js";
import { IntakeSpamGate } from "./intake-spam-gate.js";

const intakeBotUserId = "00000000-0000-4000-8000-000000000099";

const baseSnapshot: CustomerIntakeSnapshot = {
  conversationId: "00000000-0000-4000-8000-000000060201",
  state: "unknown",
  customerName: null,
  phone: "+15555550100",
  email: null,
  serviceAddress: null,
  problemDescription: null,
  preferredTiming: null,
  blockedReason: null,
  spamScore: 0,
  matchedReference: null,
  matchedConfidenceBand: null,
  takeoverActive: false,
  lastInboundMessageId: null,
  lastInboundAt: null,
  updatedAt: new Date("2026-05-26T00:00:00.000Z"),
};

class FakeStore implements CustomerIntakeStore {
  snapshot: CustomerIntakeSnapshot = { ...baseSnapshot };
  recent: InboundMessageSummary[] = [];
  pendingApprovals: string[] = [];
  readonly updateCalls: Array<{
    state: CustomerIntakeState;
    fields: ConversationFieldsPatch;
    blockedReason: string | null;
  }> = [];
  readonly linkCalls: Array<{
    reference: RepairShoprReference | null;
    confidenceBand: string | null;
  }> = [];

  async getConversationSnapshot() {
    return this.snapshot;
  }
  async getRecentInboundMessages() {
    return this.recent;
  }
  async updateConversationIntake(input: {
    conversationId: string;
    state: CustomerIntakeState;
    spamScore: number;
    blockedReason: string | null;
    fields: ConversationFieldsPatch;
    lastInboundMessageId: string;
    lastInboundAt: Date;
  }) {
    this.updateCalls.push({
      state: input.state,
      fields: input.fields,
      blockedReason: input.blockedReason,
    });
    this.snapshot = {
      ...this.snapshot,
      state: input.state,
      blockedReason: input.blockedReason,
      spamScore: input.spamScore,
      customerName: input.fields.customerName ?? this.snapshot.customerName,
      email: input.fields.email ?? this.snapshot.email,
      serviceAddress:
        input.fields.serviceAddress ?? this.snapshot.serviceAddress,
      problemDescription:
        input.fields.problemDescription ?? this.snapshot.problemDescription,
      preferredTiming:
        input.fields.preferredTiming ?? this.snapshot.preferredTiming,
      lastInboundMessageId: input.lastInboundMessageId,
      lastInboundAt: input.lastInboundAt,
      updatedAt: new Date(),
    };
  }
  async linkMatchedRepairShoprReference(input: {
    reference: RepairShoprReference | null;
    confidenceBand: string | null;
  }) {
    this.linkCalls.push(input);
    this.snapshot = {
      ...this.snapshot,
      matchedReference: input.reference,
      matchedConfidenceBand:
        input.confidenceBand === "low" ||
        input.confidenceBand === "medium_high" ||
        input.confidenceBand === "high"
          ? input.confidenceBand
          : null,
    };
  }
  async listPendingIntakeApprovalIds() {
    return this.pendingApprovals;
  }
}

class FakeApprovalStore implements CustomerIntakeApprovalStore {
  readonly created: Array<{ user: SessionUser; input: CreateApprovalRequest }> =
    [];
  async createApproval(user: SessionUser, input: CreateApprovalRequest) {
    this.created.push({ user, input });
    const sequence = this.created.length.toString().padStart(12, "0");
    const approval: ApprovalRecord = {
      id: `00000000-0000-4000-8000-${sequence}`,
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
}

class FakeMatcher implements CustomerIntakeMatcher {
  next: {
    reference: RepairShoprReference;
    confidenceBand: MatchConfidenceBand;
  } | null = null;
  searches: Array<Parameters<CustomerIntakeMatcher["search"]>[0]> = [];
  async search(input: Parameters<CustomerIntakeMatcher["search"]>[0]) {
    this.searches.push(input);
    return this.next;
  }
}

describe("CustomerIntakeStateMachineService", () => {
  it("blocks the conversation when the spam gate trips", async () => {
    const store = new FakeStore();
    const approvalStore = new FakeApprovalStore();
    const service = new CustomerIntakeStateMachineService(
      store,
      approvalStore,
      new IntakeSpamGate(),
      null,
    );

    const evaluation = await service.evaluateInboundMessage({
      conversationId: store.snapshot.conversationId,
      messageId: "00000000-0000-4000-8000-000000060210",
      body: "Click here to claim your prize",
      hasMedia: false,
      intakeBotUserId,
    });

    expect(evaluation.blocked).toBe(true);
    expect(evaluation.state).toBe("blocked");
    expect(store.updateCalls[0]?.state).toBe("blocked");
    expect(approvalStore.created).toHaveLength(0);
  });

  it("moves an unknown sender with no fields to identifying state and stages a single prompt", async () => {
    const store = new FakeStore();
    const approvalStore = new FakeApprovalStore();
    const service = new CustomerIntakeStateMachineService(
      store,
      approvalStore,
      new IntakeSpamGate(),
      null,
    );

    const evaluation = await service.evaluateInboundMessage({
      conversationId: store.snapshot.conversationId,
      messageId: "00000000-0000-4000-8000-000000060211",
      body: "Hi",
      hasMedia: false,
      intakeBotUserId,
    });

    expect(evaluation.state).toBe("identifying");
    expect(evaluation.missingFields[0]).toBe("customerName");
    expect(evaluation.nextPrompt?.field).toBe("customerName");
    expect(approvalStore.created).toHaveLength(1);
    expect(approvalStore.created[0]?.input.kind).toBe("customer_message");
  });

  it("moves to matched when the matcher returns a high confidence reference", async () => {
    const store = new FakeStore();
    const approvalStore = new FakeApprovalStore();
    const matcher = new FakeMatcher();
    matcher.next = {
      reference: {
        entityType: "customer",
        repairShoprId: "rs-101",
        displayLabel: "Casey Customer",
      },
      confidenceBand: "high",
    };
    const service = new CustomerIntakeStateMachineService(
      store,
      approvalStore,
      new IntakeSpamGate(),
      matcher,
    );

    const evaluation = await service.evaluateInboundMessage({
      conversationId: store.snapshot.conversationId,
      messageId: "00000000-0000-4000-8000-000000060212",
      body: "My name is Casey",
      hasMedia: false,
      intakeBotUserId,
    });

    expect(matcher.searches).toHaveLength(1);
    expect(evaluation.state).toBe("matched");
    expect(evaluation.matchedReference?.repairShoprId).toBe("rs-101");
    expect(approvalStore.created).toHaveLength(0);
  });

  it("moves a matched conversation to review-ready when service context arrives", async () => {
    const store = new FakeStore();
    store.snapshot = {
      ...store.snapshot,
      customerName: "Casey Customer",
      matchedReference: {
        entityType: "customer",
        repairShoprId: "rs-101",
        displayLabel: "Casey Customer",
      },
      matchedConfidenceBand: "high",
      state: "matched",
    };
    const approvalStore = new FakeApprovalStore();
    const service = new CustomerIntakeStateMachineService(
      store,
      approvalStore,
      new IntakeSpamGate(),
      null,
    );

    const evaluation = await service.evaluateInboundMessage({
      conversationId: store.snapshot.conversationId,
      messageId: "00000000-0000-4000-8000-000000060213",
      body: "My laptop will not boot at 123 Main Street",
      hasMedia: false,
      intakeBotUserId,
    });

    expect(evaluation.state).toBe("review_ready");
    expect(approvalStore.created[0]?.input.kind).toBe("repairshopr_writeback");
  });

  it("stages a writeback approval only when minimum new-lead fields exist", async () => {
    const store = new FakeStore();
    store.snapshot = {
      ...store.snapshot,
      customerName: "Casey Customer",
      serviceAddress: "123 Main Street",
      problemDescription: "Existing problem",
      state: "collecting",
    };
    const approvalStore = new FakeApprovalStore();
    const service = new CustomerIntakeStateMachineService(
      store,
      approvalStore,
      new IntakeSpamGate(),
      null,
    );

    const evaluation = await service.evaluateInboundMessage({
      conversationId: store.snapshot.conversationId,
      messageId: "00000000-0000-4000-8000-000000060214",
      body: "Anything else you need?",
      hasMedia: false,
      intakeBotUserId,
    });

    expect(evaluation.state).toBe("review_ready");
    expect(evaluation.missingFields).toEqual([]);
    expect(approvalStore.created[0]?.input.kind).toBe("repairshopr_writeback");
  });

  it("does not stage customer-message prompts while takeover is active", async () => {
    const store = new FakeStore();
    store.snapshot = {
      ...store.snapshot,
      takeoverActive: true,
    };
    const approvalStore = new FakeApprovalStore();
    const service = new CustomerIntakeStateMachineService(
      store,
      approvalStore,
      new IntakeSpamGate(),
      null,
    );

    const evaluation = await service.evaluateInboundMessage({
      conversationId: store.snapshot.conversationId,
      messageId: "00000000-0000-4000-8000-000000060216",
      body: "Quick check while takeover is active",
      hasMedia: false,
      intakeBotUserId,
    });

    expect(evaluation.nextPrompt).toBeNull();
    expect(
      approvalStore.created.find(
        (record) => record.input.kind === "customer_message",
      ),
    ).toBeUndefined();
  });

  it("does not ask for already matched fields when the conversation is matched", async () => {
    const store = new FakeStore();
    store.snapshot = {
      ...store.snapshot,
      customerName: "Casey Customer",
      matchedReference: {
        entityType: "customer",
        repairShoprId: "rs-101",
        displayLabel: "Casey Customer",
      },
      matchedConfidenceBand: "high",
      state: "matched",
    };
    const approvalStore = new FakeApprovalStore();
    const service = new CustomerIntakeStateMachineService(
      store,
      approvalStore,
      new IntakeSpamGate(),
      null,
    );

    const evaluation = await service.evaluateInboundMessage({
      conversationId: store.snapshot.conversationId,
      messageId: "00000000-0000-4000-8000-000000060215",
      body: "Just checking in",
      hasMedia: false,
      intakeBotUserId,
    });

    expect(evaluation.state).toBe("matched");
    expect(approvalStore.created).toHaveLength(0);
    expect(evaluation.nextPrompt).toBeNull();
  });
});
