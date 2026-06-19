import type {
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
  JobSummary,
  SendConversationMessageRequest,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import {
  LeadAlreadyConvertedError,
  type LeadConversionServiceApi,
  LeadNotAnsweredError,
  LeadNotScheduledError,
} from "../services/lead-conversion-service.js";
import {
  ConversationNotFoundError,
  type LiveTakeoverServiceApi,
  OutboundMessagingDisabledError,
  TakeoverInactiveError,
} from "../services/live-takeover-service.js";

const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000003",
  role: "tech",
  displayName: "Tech",
};

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};

const conversationId = "00000000-0000-4000-8000-000000070101";

describe("tech conversation routes", () => {
  it("requires authentication", async () => {
    const service = new TestLiveTakeoverService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      liveTakeoverService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: "/tech/conversations",
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns the conversation list for a tech session", async () => {
    const service = new TestLiveTakeoverService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      liveTakeoverService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: "/tech/conversations",
      headers: authHeader("tech"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      active: [{ id: conversationId }],
    });
    await app.close();
  });

  it("returns conversation detail or 404", async () => {
    const service = new TestLiveTakeoverService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      liveTakeoverService: service,
    });

    const okResponse = await app.inject({
      method: "GET",
      url: `/tech/conversations/${conversationId}`,
      headers: authHeader("tech"),
    });
    expect(okResponse.statusCode).toBe(200);
    expect(okResponse.json()).toMatchObject({
      conversation: { id: conversationId },
    });

    service.missing = true;
    const missingResponse = await app.inject({
      method: "GET",
      url: `/tech/conversations/${conversationId}`,
      headers: authHeader("tech"),
    });
    expect(missingResponse.statusCode).toBe(404);

    await app.close();
  });

  it("toggles takeover and rejects unauthorized roles", async () => {
    const service = new TestLiveTakeoverService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      liveTakeoverService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/takeover`,
      headers: authHeader("manager"),
      payload: { active: true },
    });

    expect(response.statusCode).toBe(200);
    expect(service.takeoverCalls).toHaveLength(1);
    expect(service.takeoverCalls[0]?.active).toBe(true);

    await app.close();
  });

  it("returns 409 when sending without takeover or with outbound disabled", async () => {
    const service = new TestLiveTakeoverService();
    service.nextSendError = new TakeoverInactiveError();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      liveTakeoverService: service,
    });

    const inactiveResponse = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/messages`,
      headers: authHeader("tech"),
      payload: { body: "Hello" },
    });
    expect(inactiveResponse.statusCode).toBe(409);
    expect(inactiveResponse.json()).toEqual({
      error: "Takeover must be active",
    });

    service.nextSendError = new OutboundMessagingDisabledError();
    const disabledResponse = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/messages`,
      headers: authHeader("tech"),
      payload: { body: "Hello" },
    });
    expect(disabledResponse.statusCode).toBe(409);
    expect(disabledResponse.json()).toEqual({
      error: "Outbound messaging is disabled",
    });

    await app.close();
  });

  it("returns the persisted message on a successful send", async () => {
    const service = new TestLiveTakeoverService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      liveTakeoverService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/messages`,
      headers: authHeader("tech"),
      payload: { body: "Hello" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      message: { externalStatus: "queued" },
    });
    expect(service.sendCalls).toHaveLength(1);
    expect(service.sendCalls[0]?.input.body).toBe("Hello");

    await app.close();
  });

  it("returns 503 when the tech conversation service is unavailable", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/tech/conversations",
      headers: authHeader("tech"),
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "Tech conversation service unavailable",
    });

    await app.close();
  });

  it("converts a scheduled lead to a job for both tech and manager", async () => {
    const conversionService = new TestLeadConversionService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      liveTakeoverService: new TestLiveTakeoverService(),
      leadConversionService: conversionService,
    });

    const techResponse = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/convert-to-job`,
      headers: authHeader("tech"),
    });
    expect(techResponse.statusCode).toBe(200);
    expect(techResponse.json()).toMatchObject({ job: { state: "scheduled" } });

    const managerResponse = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/convert-to-job`,
      headers: authHeader("manager"),
    });
    expect(managerResponse.statusCode).toBe(200);

    expect(conversionService.calls).toHaveLength(2);
    expect(conversionService.calls[0]?.user.role).toBe("tech");
    expect(conversionService.calls[1]?.user.role).toBe("manager");

    await app.close();
  });

  it("maps conversion conflicts to 409", async () => {
    const conversionService = new TestLeadConversionService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      liveTakeoverService: new TestLiveTakeoverService(),
      leadConversionService: conversionService,
    });

    conversionService.nextError = new LeadNotAnsweredError();
    const notAnswered = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/convert-to-job`,
      headers: authHeader("tech"),
    });
    expect(notAnswered.statusCode).toBe(409);
    expect(notAnswered.json()).toEqual({
      error: "A lead must be answered by a tech before it can become a job",
    });

    conversionService.nextError = new LeadNotScheduledError();
    const notScheduled = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/convert-to-job`,
      headers: authHeader("tech"),
    });
    expect(notScheduled.statusCode).toBe(409);
    expect(notScheduled.json()).toEqual({
      error:
        "Lead must have a scheduled appointment before it can become a job",
    });

    conversionService.nextError = new LeadAlreadyConvertedError();
    const alreadyConverted = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/convert-to-job`,
      headers: authHeader("manager"),
    });
    expect(alreadyConverted.statusCode).toBe(409);
    expect(alreadyConverted.json()).toEqual({
      error: "Lead has already been converted to a job",
    });

    await app.close();
  });

  it("returns 503 when the lead conversion service is unavailable", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
    });

    const response = await app.inject({
      method: "POST",
      url: `/tech/conversations/${conversationId}/convert-to-job`,
      headers: authHeader("tech"),
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "Lead conversion service unavailable",
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

class TestLiveTakeoverService implements LiveTakeoverServiceApi {
  missing = false;
  nextSendError: Error | null = null;
  readonly takeoverCalls: Array<{
    user: SessionUser;
    conversationId: string;
    active: boolean;
  }> = [];
  readonly sendCalls: Array<{
    user: SessionUser;
    conversationId: string;
    input: SendConversationMessageRequest;
  }> = [];

  async listConversations() {
    return {
      active: [conversationSummary()] satisfies ConversationSummary[],
      needsResponse: [] as ConversationSummary[],
      recent: [] as ConversationSummary[],
    };
  }
  async getConversation() {
    if (this.missing) {
      return null;
    }
    return conversationDetail();
  }
  async setTakeover(user: SessionUser, convoId: string, active: boolean) {
    this.takeoverCalls.push({ user, conversationId: convoId, active });
    return conversationDetail({ takeoverActive: active });
  }
  async sendMessage(
    user: SessionUser,
    convoId: string,
    input: SendConversationMessageRequest,
  ) {
    this.sendCalls.push({ user, conversationId: convoId, input });
    if (this.nextSendError) {
      const error = this.nextSendError;
      this.nextSendError = null;
      throw error;
    }
    return conversationMessage();
  }

  triggerNotFound() {
    this.nextSendError = new ConversationNotFoundError();
  }
}

class TestLeadConversionService implements LeadConversionServiceApi {
  nextError: Error | null = null;
  readonly calls: Array<{ user: SessionUser; conversationId: string }> = [];

  async convertToJob(user: SessionUser, convoId: string) {
    this.calls.push({ user, conversationId: convoId });
    if (this.nextError) {
      const error = this.nextError;
      this.nextError = null;
      throw error;
    }
    return {
      id: "00000000-0000-4000-8000-0000000a0001",
      state: "scheduled",
      customerLabel: "Jordan Rivera",
    } satisfies JobSummary;
  }
}

function conversationSummary(
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary {
  const updatedAt = new Date("2026-05-26T00:00:00.000Z");
  return {
    id: conversationId,
    externalPhone: "+15555550100",
    takeoverActive: true,
    takeoverStartedAt: updatedAt,
    takeoverStartedByUserId: techUser.id,
    intakeState: "collecting",
    customerName: "Casey Customer",
    lastInboundAt: updatedAt,
    lastInboundPreview: "Hello",
    updatedAt,
    ...overrides,
  };
}

function conversationDetail(
  overrides: Partial<ConversationDetail> = {},
): ConversationDetail {
  return {
    ...conversationSummary(),
    jobId: null,
    messages: [],
    ...overrides,
  };
}

function conversationMessage(
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return {
    id: "00000000-0000-4000-8000-000000070500",
    direction: "outbound",
    authorRole: "tech",
    body: "Hello",
    twilioMessageSid: "SMout",
    externalStatus: "queued",
    sentByUserId: techUser.id,
    createdAt: new Date("2026-05-26T00:00:00.000Z"),
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
