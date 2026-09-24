import type {
  SessionUser,
  WritebackExecution,
  WritebackExecutionListQuery,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import {
  InvalidWritebackPayloadError,
  WritebackApprovalNotApprovedError,
  WritebackApprovalNotFoundError,
  WritebackExecutionNotRetryableError,
  type WritebackExecutionServiceApi,
} from "../services/writeback-execution-service.js";
import { createFakeAuthService } from "./support/fake-auth-service.js";
import { testConfig } from "./support/test-config.js";

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
const approvalId = "00000000-0000-4000-8000-000000070101";
const executionId = "00000000-0000-4000-8000-000000070102";
const jobId = "00000000-0000-4000-8000-000000070103";

describe("writeback routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(
      testConfig({ REPAIRSHOPR_WRITEBACK_ENABLED: false }),
      {
        authService: createFakeAuthService(sessions),
        writebackExecutionService: new TestWritebackService(),
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/writebacks",
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("lists writeback executions for tech sessions", async () => {
    const service = new TestWritebackService();
    const app = await buildApp(
      testConfig({ REPAIRSHOPR_WRITEBACK_ENABLED: false }),
      {
        authService: createFakeAuthService(sessions),
        writebackExecutionService: service,
      },
    );

    const response = await app.inject({
      method: "GET",
      url: `/writebacks?state=ready&approvalId=${approvalId}&jobId=${jobId}`,
      headers: authHeader("tech"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      executions: [{ id: executionId, state: "ready" }],
    });
    expect(service.filters).toEqual([{ state: "ready", approvalId, jobId }]);
    await app.close();
  });

  it("executes approved approvals and retries executions", async () => {
    const service = new TestWritebackService();
    const app = await buildApp(
      testConfig({ REPAIRSHOPR_WRITEBACK_ENABLED: false }),
      {
        authService: createFakeAuthService(sessions),
        writebackExecutionService: service,
      },
    );

    const executeResponse = await app.inject({
      method: "POST",
      url: `/writebacks/approvals/${approvalId}/execute`,
      headers: authHeader("manager"),
    });
    const retryResponse = await app.inject({
      method: "POST",
      url: `/writebacks/${executionId}/retry`,
      headers: authHeader("tech"),
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(retryResponse.statusCode).toBe(200);
    expect(service.executeCalls).toEqual([approvalId]);
    expect(service.retryCalls).toEqual([executionId]);
    await app.close();
  });

  it("maps writeback service errors to HTTP errors", async () => {
    const service = new TestWritebackService();
    const app = await buildApp(
      testConfig({ REPAIRSHOPR_WRITEBACK_ENABLED: false }),
      {
        authService: createFakeAuthService(sessions),
        writebackExecutionService: service,
      },
    );

    service.nextError = new WritebackApprovalNotFoundError();
    const notFound = await app.inject({
      method: "POST",
      url: `/writebacks/approvals/${approvalId}/execute`,
      headers: authHeader("manager"),
    });

    service.nextError = new WritebackApprovalNotApprovedError();
    const conflict = await app.inject({
      method: "POST",
      url: `/writebacks/approvals/${approvalId}/execute`,
      headers: authHeader("manager"),
    });

    service.nextError = new WritebackExecutionNotRetryableError();
    const retryConflict = await app.inject({
      method: "POST",
      url: `/writebacks/${executionId}/retry`,
      headers: authHeader("manager"),
    });

    service.nextError = new InvalidWritebackPayloadError();
    const badRequest = await app.inject({
      method: "POST",
      url: `/writebacks/approvals/${approvalId}/execute`,
      headers: authHeader("manager"),
    });

    expect(notFound.statusCode).toBe(404);
    expect(conflict.statusCode).toBe(409);
    expect(retryConflict.statusCode).toBe(409);
    expect(badRequest.statusCode).toBe(400);
    await app.close();
  });

  it("returns 503 when the service is unavailable", async () => {
    const app = await buildApp(
      testConfig({ REPAIRSHOPR_WRITEBACK_ENABLED: false }),
      {
        authService: createFakeAuthService(sessions),
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/writebacks",
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(503);
    await app.close();
  });
});

const sessions = {
  "session-token-tech": techUser,
  "session-token-manager": managerUser,
};

class TestWritebackService implements WritebackExecutionServiceApi {
  nextError: Error | null = null;
  readonly filters: WritebackExecutionListQuery[] = [];
  readonly executeCalls: string[] = [];
  readonly retryCalls: string[] = [];

  async listExecutions(
    _user: SessionUser,
    filters?: WritebackExecutionListQuery,
  ) {
    this.filters.push(filters ?? {});
    return [executionFixture()];
  }

  async executeApprovedApproval(_user: SessionUser, approvalIdInput: string) {
    this.executeCalls.push(approvalIdInput);
    this.throwIfPending();
    return executionFixture({ state: "succeeded" });
  }

  async retryExecution(_user: SessionUser, executionIdInput: string) {
    this.retryCalls.push(executionIdInput);
    this.throwIfPending();
    return executionFixture({ state: "succeeded" });
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

function executionFixture(
  overrides: Partial<WritebackExecution> = {},
): WritebackExecution {
  const updatedAt = new Date("2026-05-26T00:00:00.000Z");
  return {
    id: executionId,
    approvalId,
    jobId,
    kind: "repairshopr_writeback",
    state: "ready",
    targetKind: "repairshopr",
    action: "lead_create",
    requestPayload: {
      action: "lead_create",
      target: { entityType: "lead", displayLabel: "New lead" },
      repairShoprPayload: { first_name: "Casey" },
    },
    responsePayload: null,
    errorMessage: null,
    repairShoprEntityType: null,
    repairShoprId: null,
    attemptCount: 0,
    lastAttemptedAt: null,
    executedByUserId: null,
    succeededAt: null,
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
