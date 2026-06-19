import type {
  CustomerIntakeSnapshot,
  ManagerDashboardResponse,
  ManagerJobDetailResponse,
  ManagerLeadDetailResponse,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import type { CustomerIntakeStateMachineServiceApi } from "../services/customer-intake-state-machine-service.js";
import type { ManagerDashboardServiceApi } from "../services/manager-dashboard-service.js";

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

const jobId = "00000000-0000-4000-8000-000000010101";

describe("manager routes", () => {
  it("requires authentication for the dashboard", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: new TestManagerDashboardService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/manager/dashboard",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Authentication required" });

    await app.close();
  });

  it("rejects tech sessions from the manager dashboard", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: new TestManagerDashboardService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/manager/dashboard",
      headers: authHeader("tech"),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Insufficient role" });

    await app.close();
  });

  it("returns the dashboard payload for a manager session", async () => {
    const service = new TestManagerDashboardService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: "/manager/dashboard",
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(serializeDashboard(dashboardResponse()));
    expect(service.dashboardCalls).toBe(1);

    await app.close();
  });

  it("returns the job detail for a manager session", async () => {
    const service = new TestManagerDashboardService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/jobs/${jobId}`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(serializeJobDetail(jobDetailResponse()));
    expect(service.jobDetailCalls).toEqual([jobId]);

    await app.close();
  });

  it("returns 404 when the job is missing", async () => {
    const service = new TestManagerDashboardService();
    service.missingJobIds.add(jobId);
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/jobs/${jobId}`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Job not found" });

    await app.close();
  });

  it("validates the job id", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: new TestManagerDashboardService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/manager/jobs/not-a-uuid",
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Invalid request" });

    await app.close();
  });

  it("returns the lead detail for a manager session", async () => {
    const conversationId = "00000000-0000-4000-8000-000000060101";
    const service = new TestManagerDashboardService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/lead`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      lead: { id: conversationId, intakeState: "collecting" },
    });
    expect(service.leadDetailCalls).toEqual([conversationId]);

    await app.close();
  });

  it("returns 404 when the lead is missing", async () => {
    const conversationId = "00000000-0000-4000-8000-000000060101";
    const service = new TestManagerDashboardService();
    service.missingLeadIds.add(conversationId);
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/lead`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Lead not found" });

    await app.close();
  });

  it("validates the lead conversation id", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: new TestManagerDashboardService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/manager/conversations/not-a-uuid/lead",
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Invalid request" });

    await app.close();
  });

  it("returns an intake snapshot for an authenticated manager", async () => {
    const service = new TestManagerDashboardService();
    const intakeService = new TestIntakeService();
    const conversationId = "00000000-0000-4000-8000-000000060101";
    intakeService.snapshots.set(
      conversationId,
      intakeSnapshotFixture(conversationId),
    );

    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: service,
      customerIntakeService: intakeService,
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/intake`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      snapshot: { conversationId, state: "collecting" },
    });

    await app.close();
  });

  it("returns 404 when the intake conversation does not exist", async () => {
    const service = new TestManagerDashboardService();
    const intakeService = new TestIntakeService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      managerDashboardService: service,
      customerIntakeService: intakeService,
    });

    const response = await app.inject({
      method: "GET",
      url: "/manager/conversations/00000000-0000-4000-8000-000000060999/intake",
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it("returns 503 when the manager dashboard service is unavailable", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
    });

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/manager/dashboard",
      headers: authHeader("manager"),
    });
    const detailResponse = await app.inject({
      method: "GET",
      url: `/manager/jobs/${jobId}`,
      headers: authHeader("manager"),
    });

    expect(dashboardResponse.statusCode).toBe(503);
    expect(dashboardResponse.json()).toEqual({
      error: "Manager dashboard service unavailable",
    });
    expect(detailResponse.statusCode).toBe(503);

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

class TestIntakeService implements CustomerIntakeStateMachineServiceApi {
  readonly snapshots = new Map<string, CustomerIntakeSnapshot>();

  async getConversationSnapshot(conversationId: string) {
    return this.snapshots.get(conversationId) ?? null;
  }

  async evaluateInboundMessage(): Promise<never> {
    throw new Error("not used in route tests");
  }
}

function intakeSnapshotFixture(conversationId: string): CustomerIntakeSnapshot {
  return {
    conversationId,
    state: "collecting",
    customerName: "Casey Customer",
    phone: "+15555550100",
    email: null,
    serviceAddress: null,
    problemDescription: "My laptop will not boot",
    preferredTiming: null,
    blockedReason: null,
    spamScore: 0,
    matchedReference: null,
    matchedConfidenceBand: null,
    takeoverActive: false,
    lastInboundMessageId: "00000000-0000-4000-8000-000000060102",
    lastInboundAt: new Date("2026-05-26T00:00:00.000Z"),
    updatedAt: new Date("2026-05-26T00:00:00.000Z"),
  };
}

class TestManagerDashboardService implements ManagerDashboardServiceApi {
  dashboardCalls = 0;
  jobDetailCalls: string[] = [];
  missingJobIds = new Set<string>();
  leadDetailCalls: string[] = [];
  missingLeadIds = new Set<string>();

  async getDashboard() {
    this.dashboardCalls += 1;
    return dashboardResponse();
  }

  async getJobDetail(jobId: string) {
    this.jobDetailCalls.push(jobId);
    if (this.missingJobIds.has(jobId)) {
      return null;
    }
    return jobDetailResponse();
  }

  async getLeadDetail(conversationId: string) {
    this.leadDetailCalls.push(conversationId);
    if (this.missingLeadIds.has(conversationId)) {
      return null;
    }
    return leadDetailResponse(conversationId);
  }
}

function dashboardResponse(): ManagerDashboardResponse {
  const updatedAt = new Date("2026-05-22T12:00:00.000Z");

  return {
    summary: {
      leadsCount: 1,
      needsTechAnswerCount: 0,
      workingOnCount: 1,
      jobsCount: 0,
      repairCount: 0,
      openCount: 1,
      scheduledCount: 0,
      completedCount: 0,
      unmatchedCount: 1,
      takeoverCount: 1,
      payoutReadyCount: 0,
    },
    groups: {
      openJobs: [
        {
          id: jobId,
          state: "accepted",
          origin: "lead",
          customerLabel: "Local laptop repair",
          updatedAt,
          grossChargeCents: 18000,
          pendingApprovalCount: 1,
          selectedMatchConfidenceBand: "high",
        },
      ],
      scheduledJobs: [],
      completedJobs: [],
      unmatchedJobs: [
        {
          id: "00000000-0000-4000-8000-000000010102",
          state: "unmatched",
          origin: "manual",
          originNote: "Walk-in customer.",
          customerLabel: "Unmatched walk-in",
          updatedAt,
          pendingApprovalCount: 0,
        },
      ],
      payoutReadyJobs: [],
    },
    leads: [],
    takeoverConversations: [
      {
        id: "00000000-0000-4000-8000-000000020101",
        externalPhone: "+15555550100",
        takeoverActive: true,
        takeoverStartedAt: updatedAt,
        updatedAt,
      },
    ],
  };
}

function jobDetailResponse(): ManagerJobDetailResponse {
  const updatedAt = new Date("2026-05-22T12:00:00.000Z");

  return {
    job: {
      id: jobId,
      conversationId: "00000000-0000-4000-8000-000000020101",
      state: "accepted",
      origin: "lead",
      customerLabel: "Local laptop repair",
      updatedAt,
      grossChargeCents: 18000,
      pendingApprovalCount: 1,
    },
    pendingApprovals: [
      {
        id: "00000000-0000-4000-8000-000000040101",
        kind: "customer_message",
        risk: "scheduling",
        requiredRole: "manager",
        updatedAt,
      },
    ],
    selectedMatch: {
      id: "00000000-0000-4000-8000-000000030101",
      confidence: 0.9,
      confidenceBand: "high",
      repairShoprReference: {
        entityType: "ticket",
        repairShoprId: "local-ticket-101",
        displayLabel: "Local laptop repair",
      },
    },
  };
}

function leadDetailResponse(conversationId: string): ManagerLeadDetailResponse {
  const updatedAt = new Date("2026-05-26T00:00:00.000Z");

  return {
    lead: {
      id: conversationId,
      label: "+15555550100",
      externalPhone: "+15555550100",
      intakeState: "collecting",
      takeoverActive: false,
      customerName: null,
      customerEmail: null,
      serviceAddress: null,
      problemDescription: "My laptop will not boot",
      preferredTiming: null,
      matchedReference: null,
      lastInboundAt: updatedAt,
      updatedAt,
    },
  };
}

function serializeDashboard(response: ManagerDashboardResponse) {
  return JSON.parse(JSON.stringify(response)) as unknown;
}

function serializeJobDetail(response: ManagerJobDetailResponse) {
  return JSON.parse(JSON.stringify(response)) as unknown;
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
