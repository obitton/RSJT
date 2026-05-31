import type { SessionUser, UpdateExtractionResponse } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import type {
  ExtractJobUpdateInput,
  UpdateExtractionServiceApi,
} from "../services/update-extraction-service.js";

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
const jobId = "00000000-0000-4000-8000-000000009001";
const messageId = "00000000-0000-4000-8000-000000000201";

describe("update routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      updateExtractionService: new TestUpdateExtractionService(),
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/updates/extract`,
      payload: { body: "went to Michele, 1 hr 200" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Authentication required" });

    await app.close();
  });

  it("validates request bodies", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      updateExtractionService: new TestUpdateExtractionService(),
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/updates/extract`,
      headers: authHeader("tech"),
      payload: { body: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Invalid request" });

    await app.close();
  });

  it("extracts updates submitted by a tech user", async () => {
    const updateExtractionService = new TestUpdateExtractionService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      updateExtractionService,
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/updates/extract`,
      headers: authHeader("tech"),
      payload: { body: "  went to Michele, 1 hr 200  " },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(extractionResponse());
    expect(updateExtractionService.requests).toEqual([
      {
        jobId,
        authorRole: "tech",
        body: "went to Michele, 1 hr 200",
      },
    ]);

    await app.close();
  });

  it("extracts updates submitted by a manager user", async () => {
    const updateExtractionService = new TestUpdateExtractionService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      updateExtractionService,
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/updates/extract`,
      headers: authHeader("manager"),
      payload: { body: "fixed for Michele, 90 min charged 300" },
    });

    expect(response.statusCode).toBe(200);
    expect(updateExtractionService.requests).toEqual([
      {
        jobId,
        authorRole: "manager",
        body: "fixed for Michele, 90 min charged 300",
      },
    ]);

    await app.close();
  });

  it("keeps health available when the update extraction service is unavailable", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
    });

    const healthResponse = await app.inject({
      method: "GET",
      url: "/health",
    });
    const updateResponse = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/updates/extract`,
      headers: authHeader("tech"),
      payload: { body: "went to Michele, 1 hr 200" },
    });

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ ok: true });
    expect(updateResponse.statusCode).toBe(503);
    expect(updateResponse.json()).toEqual({
      error: "Update extraction service unavailable",
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

class TestUpdateExtractionService implements UpdateExtractionServiceApi {
  readonly requests: ExtractJobUpdateInput[] = [];

  async extractJobUpdate(input: ExtractJobUpdateInput) {
    this.requests.push(input);
    return extractionResponse();
  }
}

function extractionResponse(): UpdateExtractionResponse {
  return {
    jobId,
    messageId,
    facts: [
      {
        type: "customer_hint",
        value: { text: "Michele" },
        confidence: 0.7,
        evidence: { messageId, quote: "Michele" },
        requiresConfirmation: true,
      },
    ],
    missingFields: ["expense_cents", "follow_up_needed"],
    prompts: [
      {
        field: "expense_cents",
        message: "Any parts, materials, or subcontractor costs for this job?",
      },
      {
        field: "follow_up_needed",
        message: "Any follow-up needed with the customer?",
      },
    ],
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
