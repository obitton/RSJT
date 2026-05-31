import type {
  ApprovalFilterQuery,
  ApprovalRecord,
  CreateApprovalRequest,
  EditApprovalRequest,
  RejectApprovalRequest,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import {
  ApprovalNotFoundError,
  ApprovalNotPendingError,
  ApprovalRoleError,
  type ApprovalServiceApi,
} from "../services/approval-service.js";
import type { AuthSessionService } from "../services/auth-service.js";

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
const jobId = "00000000-0000-4000-8000-000000009001";
const messageId = "00000000-0000-4000-8000-000000000201";

describe("approval routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      approvalService: new TestApprovalService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/approvals",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Authentication required" });

    await app.close();
  });

  it("creates a staged approval", async () => {
    const approvalService = new TestApprovalService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      approvalService,
    });
    const payload = createPayload();

    const response = await app.inject({
      method: "POST",
      url: "/approvals",
      headers: authHeader("manager"),
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ approval: serializedApproval() });
    expect(approvalService.creates).toEqual([{ user: managerUser, payload }]);

    await app.close();
  });

  it("validates create payloads", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      approvalService: new TestApprovalService(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/approvals",
      headers: authHeader("manager"),
      payload: {
        kind: "customer_message",
        risk: "scheduling",
        requiredRole: "admin",
        payload: { body: "Invalid role" },
        evidence: [{ messageId, quote: "Invalid role" }],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Invalid request" });

    await app.close();
  });

  it("lists approvals with filters", async () => {
    const approvalService = new TestApprovalService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      approvalService,
    });

    const response = await app.inject({
      method: "GET",
      url: `/approvals?state=pending&risk=scheduling&kind=customer_message&jobId=${jobId}&requiredRole=manager`,
      headers: authHeader("tech"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ approvals: [serializedApproval()] });
    expect(approvalService.filters).toEqual([
      {
        state: "pending",
        risk: "scheduling",
        kind: "customer_message",
        jobId,
        requiredRole: "manager",
      },
    ]);

    await app.close();
  });

  it("edits, approves, rejects, and expires approvals", async () => {
    const approvalService = new TestApprovalService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      approvalService,
    });

    const editResponse = await app.inject({
      method: "PATCH",
      url: `/approvals/${approvalId}`,
      headers: authHeader("manager"),
      payload: { payload: { body: "Schedule between 2 and 4." } },
    });
    const approveResponse = await app.inject({
      method: "POST",
      url: `/approvals/${approvalId}/approve`,
      headers: authHeader("manager"),
    });
    const rejectResponse = await app.inject({
      method: "POST",
      url: `/approvals/${approvalId}/reject`,
      headers: authHeader("manager"),
      payload: { reason: "Needs another time." },
    });
    const expireResponse = await app.inject({
      method: "POST",
      url: `/approvals/${approvalId}/expire`,
      headers: authHeader("manager"),
    });

    expect(editResponse.statusCode).toBe(200);
    expect(approveResponse.statusCode).toBe(200);
    expect(rejectResponse.statusCode).toBe(200);
    expect(expireResponse.statusCode).toBe(200);
    expect(approvalService.edits).toEqual([
      {
        user: managerUser,
        approvalId,
        input: { payload: { body: "Schedule between 2 and 4." } },
      },
    ]);
    expect(approvalService.decisions).toEqual([
      { action: "approve", user: managerUser, approvalId },
      {
        action: "reject",
        user: managerUser,
        approvalId,
        input: { reason: "Needs another time." },
      },
      { action: "expire", user: managerUser, approvalId },
    ]);

    await app.close();
  });

  it("maps approval service errors to HTTP errors", async () => {
    const approvalService = new TestApprovalService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      approvalService,
    });

    approvalService.nextError = new ApprovalRoleError();
    const forbiddenResponse = await app.inject({
      method: "POST",
      url: `/approvals/${approvalId}/approve`,
      headers: authHeader("tech"),
    });

    approvalService.nextError = new ApprovalNotFoundError();
    const notFoundResponse = await app.inject({
      method: "POST",
      url: `/approvals/${approvalId}/approve`,
      headers: authHeader("manager"),
    });

    approvalService.nextError = new ApprovalNotPendingError();
    const conflictResponse = await app.inject({
      method: "POST",
      url: `/approvals/${approvalId}/approve`,
      headers: authHeader("manager"),
    });

    expect(forbiddenResponse.statusCode).toBe(403);
    expect(forbiddenResponse.json()).toEqual({ error: "Insufficient role" });
    expect(notFoundResponse.statusCode).toBe(404);
    expect(notFoundResponse.json()).toEqual({ error: "Approval not found" });
    expect(conflictResponse.statusCode).toBe(409);
    expect(conflictResponse.json()).toEqual({
      error: "Approval is not pending",
    });

    await app.close();
  });

  it("keeps health available when the approval service is unavailable", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
    });

    const healthResponse = await app.inject({
      method: "GET",
      url: "/health",
    });
    const approvalResponse = await app.inject({
      method: "GET",
      url: "/approvals",
      headers: authHeader("manager"),
    });

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ ok: true });
    expect(approvalResponse.statusCode).toBe(503);
    expect(approvalResponse.json()).toEqual({
      error: "Approval service unavailable",
    });

    await app.close();
  });
});

class TestAuthService implements AuthSessionService {
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

class TestApprovalService implements ApprovalServiceApi {
  nextError: Error | null = null;
  readonly creates: Array<{
    user: SessionUser;
    payload: CreateApprovalRequest;
  }> = [];
  readonly filters: ApprovalFilterQuery[] = [];
  readonly edits: Array<{
    user: SessionUser;
    approvalId: string;
    input: EditApprovalRequest;
  }> = [];
  readonly decisions: Array<
    | { action: "approve" | "expire"; user: SessionUser; approvalId: string }
    | {
        action: "reject";
        user: SessionUser;
        approvalId: string;
        input: RejectApprovalRequest;
      }
  > = [];

  async createApproval(user: SessionUser, payload: CreateApprovalRequest) {
    this.creates.push({ user, payload });
    return approvalRecord();
  }

  async listApprovals(filters: ApprovalFilterQuery = {}) {
    this.filters.push(filters);
    return [approvalRecord()];
  }

  async editApproval(
    user: SessionUser,
    approvalId: string,
    input: EditApprovalRequest,
  ) {
    this.throwNextError();
    this.edits.push({ user, approvalId, input });
    return approvalRecord({ payload: input.payload });
  }

  async approveApproval(user: SessionUser, approvalId: string) {
    this.throwNextError();
    this.decisions.push({ action: "approve", user, approvalId });
    return approvalRecord({ state: "approved" });
  }

  async rejectApproval(
    user: SessionUser,
    approvalId: string,
    input: RejectApprovalRequest,
  ) {
    this.throwNextError();
    this.decisions.push({ action: "reject", user, approvalId, input });
    return approvalRecord({ state: "rejected" });
  }

  async expireApproval(user: SessionUser, approvalId: string) {
    this.throwNextError();
    this.decisions.push({ action: "expire", user, approvalId });
    return approvalRecord({ state: "expired" });
  }

  private throwNextError() {
    if (!this.nextError) {
      return;
    }

    const error = this.nextError;
    this.nextError = null;
    throw error;
  }
}

function createPayload(): CreateApprovalRequest {
  return {
    jobId,
    kind: "customer_message",
    risk: "scheduling",
    requiredRole: "manager",
    payload: { body: "Schedule tomorrow." },
    evidence: [{ messageId, quote: "Schedule tomorrow." }],
  };
}

function approvalRecord(
  overrides: Partial<ApprovalRecord> = {},
): ApprovalRecord {
  const now = new Date("2026-05-22T12:00:00.000Z");

  return {
    id: approvalId,
    jobId,
    kind: "customer_message",
    state: "pending",
    risk: "scheduling",
    requiredRole: "manager",
    payload: { body: "Schedule tomorrow." },
    originalPayload: { body: "Schedule tomorrow." },
    evidence: [{ messageId, quote: "Schedule tomorrow." }],
    createdByUserId: managerUser.id,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function serializedApproval(overrides: Partial<ApprovalRecord> = {}) {
  const approval = approvalRecord(overrides);

  return {
    ...approval,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
    decidedAt: approval.decidedAt?.toISOString() ?? null,
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
    MESSAGING_CHANNEL: "whatsapp_sandbox",
    MESSAGING_OUTBOUND_ENABLED: false,
  };
}
