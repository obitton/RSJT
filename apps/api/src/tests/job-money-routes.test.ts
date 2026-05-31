import type {
  JobMoneyResponse,
  OverrideSplitCategoryRequest,
  SessionUser,
  UpdateJobMoneyRequest,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import {
  JobMoneyNotFoundError,
  type JobMoneyServiceApi,
} from "../services/job-money-service.js";

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

const jobId = "00000000-0000-4000-8000-000000090001";

describe("job money routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobMoneyService: new TestJobMoneyService(),
    });

    const response = await app.inject({
      method: "GET",
      url: `/jobs/${jobId}/money`,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("allows tech sessions to read and patch money details", async () => {
    const service = new TestJobMoneyService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobMoneyService: service,
    });

    const getResponse = await app.inject({
      method: "GET",
      url: `/jobs/${jobId}/money`,
      headers: authHeader("tech"),
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().summary.jobId).toBe(jobId);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/jobs/${jobId}/money`,
      headers: authHeader("tech"),
      payload: {
        completed: true,
        grossChargeCents: 18000,
        expenses: [{ category: "parts", amountCents: 2500 }],
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    expect(service.updateCalls[0]?.input.grossChargeCents).toBe(18000);
    await app.close();
  });

  it("allows manager sessions to override split category", async () => {
    const service = new TestJobMoneyService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobMoneyService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: `/manager/jobs/${jobId}/split-override`,
      headers: authHeader("manager"),
      payload: {
        splitCategory: "customer_service_heavy",
        reason: "Extra customer-service effort required.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(service.overrideCalls[0]?.input.splitCategory).toBe(
      "customer_service_heavy",
    );
    await app.close();
  });

  it("rejects tech split override", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobMoneyService: new TestJobMoneyService(),
    });

    const response = await app.inject({
      method: "POST",
      url: `/manager/jobs/${jobId}/split-override`,
      headers: authHeader("tech"),
      payload: {
        splitCategory: "customer_service_heavy",
        reason: "Extra customer-service effort required.",
      },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("returns 404 when the job is missing", async () => {
    const service = new TestJobMoneyService();
    service.missing = true;
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobMoneyService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/jobs/${jobId}/money`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("returns 400 for invalid money payloads", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobMoneyService: new TestJobMoneyService(),
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/jobs/${jobId}/money`,
      headers: authHeader("tech"),
      payload: {
        grossChargeCents: -100,
      },
    });

    expect(response.statusCode).toBe(400);
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

class TestJobMoneyService implements JobMoneyServiceApi {
  missing = false;
  readonly updateCalls: Array<{
    user: SessionUser;
    jobId: string;
    input: UpdateJobMoneyRequest;
  }> = [];
  readonly overrideCalls: Array<{
    user: SessionUser;
    jobId: string;
    input: OverrideSplitCategoryRequest;
  }> = [];

  async getMoney() {
    this.throwIfMissing();
    return moneyFixture();
  }

  async updateMoney(
    user: SessionUser,
    jobIdInput: string,
    input: UpdateJobMoneyRequest,
  ) {
    this.throwIfMissing();
    this.updateCalls.push({ user, jobId: jobIdInput, input });
    return moneyFixture({
      grossChargeCents: input.grossChargeCents ?? 18000,
      payoutReady: input.completed ?? false,
    });
  }

  async overrideSplitCategory(
    user: SessionUser,
    jobIdInput: string,
    input: OverrideSplitCategoryRequest,
  ) {
    this.throwIfMissing();
    this.overrideCalls.push({ user, jobId: jobIdInput, input });
    return moneyFixture({ splitCategory: input.splitCategory });
  }

  private throwIfMissing() {
    if (this.missing) {
      throw new JobMoneyNotFoundError();
    }
  }
}

function moneyFixture(
  overrides: Partial<JobMoneyResponse["summary"]> = {},
): JobMoneyResponse {
  return {
    summary: {
      jobId,
      state: "completed",
      isCompleted: true,
      splitCategory: "new_lead",
      grossChargeCents: 18000,
      reportedExpenseCents: 2500,
      reportedProfitCents: null,
      calculatedProfitCents: 15500,
      profitBasis: "charge_minus_reported_expenses",
      managerPercent: 20,
      techPercent: 80,
      managerShareCents: 3100,
      techShareCents: 12400,
      payoutReady: true,
      missingFields: [],
      ...overrides,
    },
    expenses: [],
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
