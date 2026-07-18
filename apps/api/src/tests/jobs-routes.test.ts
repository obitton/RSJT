import type {
  JobSummary,
  JobUpdateFeedResponse,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import {
  type JobCancellationServiceApi,
  JobNotCancelableError,
  JobNotFoundError,
} from "../services/job-cancellation-service.js";
import type { JobUpdateFeedServiceApi } from "../services/job-update-feed-service.js";

const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000002",
  role: "tech",
  displayName: "Tech",
};

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};

const cancelJobId = "00000000-0000-4000-8000-0000000b0001";

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

describe("jobs routes: cancel", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobCancellationService: new TestJobCancellationService(),
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${cancelJobId}/cancel`,
      payload: { reason: "no auth" },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("cancels a job for both tech and manager", async () => {
    const service = new TestJobCancellationService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobCancellationService: service,
    });

    const techResponse = await app.inject({
      method: "POST",
      url: `/jobs/${cancelJobId}/cancel`,
      headers: authHeader("tech"),
      payload: { reason: "Customer canceled the visit" },
    });
    expect(techResponse.statusCode).toBe(200);
    expect(techResponse.json()).toMatchObject({ job: { state: "canceled" } });

    const managerResponse = await app.inject({
      method: "POST",
      url: `/jobs/${cancelJobId}/cancel`,
      headers: authHeader("manager"),
      payload: { reason: "Duplicate job" },
    });
    expect(managerResponse.statusCode).toBe(200);

    expect(service.calls).toHaveLength(2);
    expect(service.calls[0]?.user.role).toBe("tech");
    expect(service.calls[0]?.reason).toBe("Customer canceled the visit");
    expect(service.calls[1]?.user.role).toBe("manager");

    await app.close();
  });

  it("rejects an empty reason with 400 and does not call the service", async () => {
    const service = new TestJobCancellationService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobCancellationService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${cancelJobId}/cancel`,
      headers: authHeader("tech"),
      payload: { reason: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(service.calls).toHaveLength(0);

    await app.close();
  });

  it("maps not-found and not-cancelable errors", async () => {
    const service = new TestJobCancellationService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      jobCancellationService: service,
    });

    service.nextError = new JobNotFoundError();
    const missing = await app.inject({
      method: "POST",
      url: `/jobs/${cancelJobId}/cancel`,
      headers: authHeader("manager"),
      payload: { reason: "gone" },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "Job not found" });

    service.nextError = new JobNotCancelableError();
    const terminal = await app.inject({
      method: "POST",
      url: `/jobs/${cancelJobId}/cancel`,
      headers: authHeader("tech"),
      payload: { reason: "too late" },
    });
    expect(terminal.statusCode).toBe(409);
    expect(terminal.json()).toEqual({
      error: "This job can no longer be canceled",
    });

    await app.close();
  });

  it("returns 503 when the job cancellation service is unavailable", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
    });

    const response = await app.inject({
      method: "POST",
      url: `/jobs/${cancelJobId}/cancel`,
      headers: authHeader("tech"),
      payload: { reason: "no service" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "Job cancellation service unavailable",
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

    if (token === "session-token-manager") {
      return { user: managerUser };
    }

    return null;
  }

  async logout() {}
}

class TestJobCancellationService implements JobCancellationServiceApi {
  nextError: Error | null = null;
  readonly calls: Array<{
    user: SessionUser;
    jobId: string;
    reason: string;
  }> = [];

  async cancelJob(user: SessionUser, jobId: string, reason: string) {
    this.calls.push({ user, jobId, reason });
    if (this.nextError) {
      const error = this.nextError;
      this.nextError = null;
      throw error;
    }
    return {
      id: jobId,
      state: "canceled",
      cancelReason: reason,
    } satisfies JobSummary;
  }
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

function authHeader(role: "tech" | "manager" = "tech") {
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
