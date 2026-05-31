import type {
  ReminderGenerationResponse,
  ReminderListResponse,
  ResolveReminderResponse,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import {
  ReminderNotFoundError,
  type ReminderServiceApi,
} from "../services/reminder-service.js";

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

const reminderId = "00000000-0000-4000-8000-000000180001";

describe("reminder routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      reminderService: new TestReminderService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/reminders",
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("allows tech sessions to list, generate, and resolve reminders", async () => {
    const service = new TestReminderService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      reminderService: service,
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/reminders",
      headers: authHeader("tech"),
    });
    const generateResponse = await app.inject({
      method: "POST",
      url: "/reminders/generate",
      headers: authHeader("tech"),
    });
    const resolveResponse = await app.inject({
      method: "POST",
      url: `/reminders/${reminderId}/resolve`,
      headers: authHeader("tech"),
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().reminders[0].id).toBe(reminderId);
    expect(generateResponse.statusCode).toBe(200);
    expect(service.generateCalls).toBe(1);
    expect(resolveResponse.statusCode).toBe(200);
    expect(service.resolveCalls).toEqual([reminderId]);
    await app.close();
  });

  it("allows managers to list stale reminders", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      reminderService: new TestReminderService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/manager/reminders/stale",
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().reminders[0].stale).toBe(true);
    await app.close();
  });

  it("rejects tech sessions from manager stale reminders", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      reminderService: new TestReminderService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/manager/reminders/stale",
      headers: authHeader("tech"),
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("returns 404 when a reminder is missing", async () => {
    const service = new TestReminderService();
    service.missing = true;
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      reminderService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: `/reminders/${reminderId}/resolve`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("returns 400 for invalid reminder ids", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      reminderService: new TestReminderService(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/reminders/not-a-uuid/resolve",
      headers: authHeader("tech"),
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

class TestReminderService implements ReminderServiceApi {
  missing = false;
  generateCalls = 0;
  readonly resolveCalls: string[] = [];

  async generateReminders(): Promise<ReminderGenerationResponse> {
    this.generateCalls += 1;
    return {
      createdCount: 1,
      resolvedCount: 0,
      reminders: [reminderFixture()],
    };
  }

  async listReminders(): Promise<ReminderListResponse> {
    return { reminders: [reminderFixture()] };
  }

  async listStaleReminders(): Promise<ReminderListResponse> {
    return { reminders: [reminderFixture({ stale: true })] };
  }

  async resolveReminder(id: string): Promise<ResolveReminderResponse> {
    if (this.missing) {
      throw new ReminderNotFoundError();
    }
    this.resolveCalls.push(id);
    return {
      reminder: reminderFixture({
        id,
        resolvedAt: new Date("2026-05-26T12:30:00.000Z"),
      }),
    };
  }
}

function reminderFixture(
  overrides: Partial<ReminderListResponse["reminders"][number]> = {},
): ReminderListResponse["reminders"][number] {
  return {
    id: reminderId,
    jobId: "00000000-0000-4000-8000-000000010102",
    jobState: "scheduled",
    customerLabel: "Scheduled onsite setup",
    reason: "missing_completion",
    createdAt: new Date("2026-05-26T12:00:00.000Z"),
    resolvedAt: null,
    stale: false,
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
