import type {
  MatchSearchInput,
  MatchSearchResponse,
  MatchSelectionResponse,
  RepairShoprReference,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import {
  MatchCandidateNotFoundError,
  type MatchingServiceApi,
} from "../services/matching-service.js";

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};
const jobId = "00000000-0000-4000-8000-000000009001";
const candidateId = "00000000-0000-4000-8000-000000000101";
const missingCandidateId = "00000000-0000-4000-8000-000000000999";
const repairShoprReference: RepairShoprReference = {
  entityType: "customer",
  repairShoprId: "101",
  displayLabel: "Fixture Customer",
  url: "https://example.repairshopr.com/api/v1/customers/101",
};

describe("match routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      matchingService: new TestMatchingService(),
    });

    const response = await app.inject({
      method: "GET",
      url: `/jobs/${jobId}/matches`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Authentication required" });

    await app.close();
  });

  it("searches matches for an authenticated user", async () => {
    const matchingService = new TestMatchingService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      matchingService,
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/matches/search`,
      headers: authHeader(),
      payload: {
        input: {
          phone: "555-0101",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(matchSearchResponse(jobId));
    expect(matchingService.searches).toEqual([
      {
        jobId,
        input: {
          phone: "555-0101",
        },
      },
    ]);

    await app.close();
  });

  it("validates search request bodies", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      matchingService: new TestMatchingService(),
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/matches/search`,
      headers: authHeader(),
      payload: {
        input: {},
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Invalid request" });

    await app.close();
  });

  it("lists stored candidates and reasons", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      matchingService: new TestMatchingService(),
    });

    const response = await app.inject({
      method: "GET",
      url: `/jobs/${jobId}/matches`,
      headers: authHeader(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(matchSearchResponse(jobId));

    await app.close();
  });

  it("selects a candidate", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      matchingService: new TestMatchingService(),
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/matches/${candidateId}/select`,
      headers: authHeader(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      jobId,
      selectedCandidateId: candidateId,
      repairShoprReference,
    });

    await app.close();
  });

  it("returns not found for an unknown selected candidate", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      matchingService: new TestMatchingService(),
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${jobId}/matches/${missingCandidateId}/select`,
      headers: authHeader(),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Match candidate not found" });

    await app.close();
  });

  it("unlinks a selected candidate", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      matchingService: new TestMatchingService(),
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/jobs/${jobId}/matches/selection`,
      headers: authHeader(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      jobId,
      selectedCandidateId: null,
      repairShoprReference: null,
    });

    await app.close();
  });

  it("keeps health available when the matching service is not configured", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
    });

    const healthResponse = await app.inject({
      method: "GET",
      url: "/health",
    });
    const matchResponse = await app.inject({
      method: "GET",
      url: `/jobs/${jobId}/matches`,
      headers: authHeader(),
    });

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ ok: true });
    expect(matchResponse.statusCode).toBe(503);
    expect(matchResponse.json()).toEqual({
      error: "Matching service unavailable",
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
    if (token !== "session-token-manager") {
      return null;
    }

    return { user: managerUser };
  }

  async logout() {}
}

class TestMatchingService implements MatchingServiceApi {
  readonly searches: Array<{ jobId: string; input: MatchSearchInput }> = [];

  async listJobMatches(jobId: string) {
    return matchSearchResponse(jobId);
  }

  async searchJobMatches(jobId: string, input: MatchSearchInput) {
    this.searches.push({ jobId, input });
    return matchSearchResponse(jobId);
  }

  async selectMatch(
    jobId: string,
    selectedCandidateId: string,
  ): Promise<MatchSelectionResponse> {
    if (selectedCandidateId === missingCandidateId) {
      throw new MatchCandidateNotFoundError();
    }

    return {
      jobId,
      selectedCandidateId,
      repairShoprReference,
    };
  }

  async unlinkMatch(jobId: string): Promise<MatchSelectionResponse> {
    return {
      jobId,
      selectedCandidateId: null,
      repairShoprReference: null,
    };
  }
}

function matchSearchResponse(id: string): MatchSearchResponse {
  return {
    jobId: id,
    candidates: [
      {
        id: candidateId,
        confidence: 0.85,
        confidenceBand: "high",
        reasons: [
          {
            label: "Phone match",
            detail: "Phone or mobile number matches.",
            weight: 0.45,
          },
        ],
        repairShoprReference,
      },
    ],
    displayLinkedCandidateId: candidateId,
    requiresConfirmation: false,
  };
}

function authHeader() {
  return {
    authorization: "Bearer session-token-manager",
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
