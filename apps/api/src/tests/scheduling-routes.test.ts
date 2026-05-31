import type {
  EditSchedulingProposalRequest,
  RejectSchedulingProposalRequest,
  SchedulingProposal,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import {
  SchedulingProposalNotPendingError,
  type SchedulingProposalServiceApi,
  UnsafeSchedulingWordingError,
} from "../services/scheduling-proposal-service.js";

const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000020",
  role: "tech",
  displayName: "Tech",
};

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};

const proposalId = "00000000-0000-4000-8000-000000080100";

describe("scheduling routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      schedulingProposalService: new TestSchedulingService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/tech/scheduling/proposals",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("lists proposals for a tech session", async () => {
    const service = new TestSchedulingService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      schedulingProposalService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: "/tech/scheduling/proposals",
      headers: authHeader("tech"),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      pending: [{ id: proposalId }],
      decided: [],
    });
    await app.close();
  });

  it("returns 404 when fetching a missing proposal", async () => {
    const service = new TestSchedulingService();
    service.missing = true;
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      schedulingProposalService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/tech/scheduling/proposals/${proposalId}`,
      headers: authHeader("tech"),
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("returns 400 when the edit wording is unsafe", async () => {
    const service = new TestSchedulingService();
    service.nextError = new UnsafeSchedulingWordingError(
      "Edited wording must not confirm availability before approval",
    );
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      schedulingProposalService: service,
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/tech/scheduling/proposals/${proposalId}`,
      headers: authHeader("tech"),
      payload: { customerMessageBody: "We are confirmed" },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("returns 409 when approving a non-pending proposal", async () => {
    const service = new TestSchedulingService();
    service.nextError = new SchedulingProposalNotPendingError();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      schedulingProposalService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: `/tech/scheduling/proposals/${proposalId}/approve`,
      headers: authHeader("tech"),
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("approves and rejects proposals via tech sessions", async () => {
    const service = new TestSchedulingService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      schedulingProposalService: service,
    });

    const approveResponse = await app.inject({
      method: "POST",
      url: `/tech/scheduling/proposals/${proposalId}/approve`,
      headers: authHeader("tech"),
    });
    expect(approveResponse.statusCode).toBe(200);
    expect(service.approveCalls).toEqual([proposalId]);

    const rejectResponse = await app.inject({
      method: "POST",
      url: `/tech/scheduling/proposals/${proposalId}/reject`,
      headers: authHeader("manager"),
      payload: { reason: "Customer cannot make it" },
    });
    expect(rejectResponse.statusCode).toBe(200);
    expect(service.rejectCalls[0]?.input.reason).toBe(
      "Customer cannot make it",
    );

    await app.close();
  });

  it("returns 503 when the service is unavailable", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/tech/scheduling/proposals",
      headers: authHeader("tech"),
    });
    expect(response.statusCode).toBe(503);
    await app.close();
  });
});

class TestAuthService implements AuthSessionService {
  async login() {
    return {
      token: "session-token-tech",
      user: techUser,
    };
  }
  async getSession(token: string) {
    if (token === "session-token-tech") {
      return { user: techUser };
    }
    if (token === "session-token-manager") {
      return { user: managerUser };
    }
    return null;
  }
  async logout() {}
}

class TestSchedulingService implements SchedulingProposalServiceApi {
  missing = false;
  nextError: Error | null = null;
  readonly approveCalls: string[] = [];
  readonly rejectCalls: Array<{
    proposalId: string;
    input: RejectSchedulingProposalRequest;
  }> = [];
  readonly editCalls: Array<{
    proposalId: string;
    input: EditSchedulingProposalRequest;
  }> = [];

  async generateFromConversation() {
    return proposalFixture();
  }
  async listProposals() {
    return {
      pending: [proposalFixture()],
      decided: [],
    };
  }
  async getProposal() {
    if (this.missing) {
      return null;
    }
    return proposalFixture();
  }
  async editProposal(
    _user: SessionUser,
    proposalIdInput: string,
    input: EditSchedulingProposalRequest,
  ) {
    this.editCalls.push({ proposalId: proposalIdInput, input });
    this.throwIfPending();
    return proposalFixture({
      ...(input.customerMessageBody
        ? { customerMessageBody: input.customerMessageBody }
        : {}),
      ...(input.preferredWindowText
        ? { preferredWindowText: input.preferredWindowText }
        : {}),
    });
  }
  async approveProposal(_user: SessionUser, proposalIdInput: string) {
    this.approveCalls.push(proposalIdInput);
    this.throwIfPending();
    return proposalFixture({ state: "approved" });
  }
  async rejectProposal(
    _user: SessionUser,
    proposalIdInput: string,
    input: RejectSchedulingProposalRequest,
  ) {
    this.rejectCalls.push({ proposalId: proposalIdInput, input });
    this.throwIfPending();
    return proposalFixture({ state: "rejected" });
  }

  private throwIfPending() {
    if (!this.nextError) {
      return;
    }
    const error = this.nextError;
    this.nextError = null;
    throw error;
  }
}

function proposalFixture(
  overrides: Partial<SchedulingProposal> = {},
): SchedulingProposal {
  const updatedAt = new Date("2026-05-26T00:00:00.000Z");
  return {
    id: proposalId,
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
      {
        messageId: "00000000-0000-4000-8000-000000080300",
        quote: "tomorrow",
      },
    ],
    customerMessageApprovalId: "00000000-0000-4000-8000-000000080400",
    appointmentApprovalId: "00000000-0000-4000-8000-000000080401",
    decidedByUserId: null,
    decidedAt: null,
    createdAt: updatedAt,
    updatedAt,
    ...overrides,
  };
}

function authHeader(role: "tech" | "manager") {
  return {
    authorization:
      role === "tech"
        ? "Bearer session-token-tech"
        : "Bearer session-token-manager",
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
    MESSAGING_CHANNEL: "whatsapp_sandbox",
    MESSAGING_OUTBOUND_ENABLED: false,
  };
}
