import type { ContactCardPreviewResponse, SessionUser } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import type { AuthSessionService } from "../services/auth-service.js";
import {
  ContactCardNotFoundError,
  type ContactCardServiceApi,
  ContactCardUnavailableError,
} from "../services/contact-card-service.js";

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

const conversationId = "00000000-0000-4000-8000-000000060401";

describe("contact card routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      contactCardService: new TestContactCardService(),
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/contact-card/preview`,
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects tech sessions", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      contactCardService: new TestContactCardService(),
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/contact-card/preview`,
      headers: authHeader("tech"),
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("returns contact card preview JSON for managers", async () => {
    const service = new TestContactCardService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      contactCardService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/contact-card/preview`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(contactPreviewFixture());
    expect(service.previewCalls).toEqual([conversationId]);
    await app.close();
  });

  it("returns vCard text for managers", async () => {
    const service = new TestContactCardService();
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      contactCardService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/contact-card`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/vcard");
    expect(response.body).toContain("FN:Casey Customer");
    expect(service.vcardCalls).toEqual([conversationId]);
    await app.close();
  });

  it("returns 409 when the contact card is unavailable", async () => {
    const service = new TestContactCardService();
    service.unavailable = true;
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      contactCardService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/contact-card`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "Contact card is unavailable" });
    await app.close();
  });

  it("returns 404 when the conversation is missing", async () => {
    const service = new TestContactCardService();
    service.missing = true;
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      contactCardService: service,
    });

    const response = await app.inject({
      method: "GET",
      url: `/manager/conversations/${conversationId}/contact-card/preview`,
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("returns 400 for invalid conversation IDs", async () => {
    const app = await buildApp(testConfig(), {
      authService: new TestAuthService(),
      contactCardService: new TestContactCardService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/manager/conversations/not-a-uuid/contact-card/preview",
      headers: authHeader("manager"),
    });

    expect(response.statusCode).toBe(400);
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

class TestContactCardService implements ContactCardServiceApi {
  missing = false;
  unavailable = false;
  readonly previewCalls: string[] = [];
  readonly vcardCalls: string[] = [];

  async getPreview(id: string) {
    this.throwIfMissing();
    this.previewCalls.push(id);
    return contactPreviewFixture();
  }

  async getVcard(id: string) {
    this.throwIfMissing();
    if (this.unavailable) {
      throw new ContactCardUnavailableError();
    }
    this.vcardCalls.push(id);
    return "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Casey Customer\r\nEND:VCARD";
  }

  private throwIfMissing() {
    if (this.missing) {
      throw new ContactCardNotFoundError();
    }
  }
}

function contactPreviewFixture(): ContactCardPreviewResponse {
  return {
    available: true,
    missingFields: [],
    state: "review_ready",
    contact: {
      conversationId,
      fullName: "Casey Customer",
      phone: "+15555550100",
      email: "casey@example.com",
      serviceAddress: "123 Main Street",
    },
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
