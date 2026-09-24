import type { ContactCardPreviewResponse, SessionUser } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import {
  ContactCardNotFoundError,
  type ContactCardServiceApi,
  ContactCardUnavailableError,
} from "../services/contact-card-service.js";
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

const conversationId = "00000000-0000-4000-8000-000000060401";

describe("contact card routes", () => {
  it("requires authentication", async () => {
    const app = await buildApp(testConfig(), {
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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
      authService: createFakeAuthService(sessions),
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

const sessions = {
  "session-token-manager": managerUser,
  "session-token-tech": techUser,
};

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
