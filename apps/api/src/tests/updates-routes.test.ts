import type { SessionUser, UpdateExtractionResponse } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type {
  ExtractJobUpdateInput,
  UpdateExtractionServiceApi,
} from "../services/update-extraction-service.js";
import { createFakeAuthService } from "./support/fake-auth-service.js";
import { testConfig } from "./support/test-config.js";

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
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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

const sessions = {
  "session-token-manager": managerUser,
  "session-token-tech": techUser,
};

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
