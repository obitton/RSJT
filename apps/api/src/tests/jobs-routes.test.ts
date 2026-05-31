import type { JobUpdateFeedResponse, SessionUser } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import type { JobUpdateFeedServiceApi } from "../services/job-update-feed-service.js";

const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000002",
  role: "tech",
  displayName: "Tech",
};

describe("jobs routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobUpdateFeedService: new TestJobUpdateFeedService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/jobs/update-feed",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Authentication required" });

    await app.close();
  });

  it("returns update feed jobs for an authenticated user", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobUpdateFeedService: new TestJobUpdateFeedService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/jobs/update-feed",
      headers: authHeader(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(jobUpdateFeedResponse());

    await app.close();
  });

  it("keeps health available when the job feed service is unavailable", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
    });

    const healthResponse = await app.inject({
      method: "GET",
      url: "/health",
    });
    const feedResponse = await app.inject({
      method: "GET",
      url: "/jobs/update-feed",
      headers: authHeader(),
    });

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ ok: true });
    expect(feedResponse.statusCode).toBe(503);
    expect(feedResponse.json()).toEqual({
      error: "Job update feed service unavailable",
    });

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

    return null;
  }

  async logout() {}
}

class TestJobUpdateFeedService implements JobUpdateFeedServiceApi {
  async listUpdateFeed() {
    return jobUpdateFeedResponse();
  }
}

function jobUpdateFeedResponse(): JobUpdateFeedResponse {
  return {
    activeJobs: [
      {
        id: "00000000-0000-4000-8000-000000010101",
        state: "accepted",
        customerLabel: "Local laptop repair",
      },
    ],
    unresolvedJobs: [
      {
        id: "00000000-0000-4000-8000-000000010103",
        state: "unmatched",
        customerLabel: "Unmatched walk-in update",
      },
    ],
  };
}

function authHeader() {
  return {
    authorization: "Bearer session-token-tech",
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
