import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import {
  type MessagingWebhookRequestContext,
  type MessagingWebhookServiceApi,
  TwilioWebhookSignatureError,
} from "../services/messaging-webhook-service.js";
import { createFakeAuthService } from "./support/fake-auth-service.js";
import { testConfig } from "./support/test-config.js";

const inboundPayload =
  "MessageSid=SMtest123&From=%2B15555550100&To=%2B15555550199&Body=Hello&NumMedia=0";

const statusPayload =
  "MessageSid=SMtest456&MessageStatus=delivered&AccountSid=AC123";

describe("twilio webhook routes", () => {
  it("returns empty TwiML for a valid inbound webhook", async () => {
    const service = new TestMessagingWebhookService();
    const app = await buildApp(testConfig(), {
      messagingWebhookService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/messages",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "sig",
      },
      payload: inboundPayload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/xml");
    expect(response.body).toBe("<Response></Response>");
    expect(service.inboundCalls).toHaveLength(1);
    expect(service.inboundCalls[0]?.context.signature).toBe("sig");
    expect(service.inboundCalls[0]?.payload.MessageSid).toBe("SMtest123");

    await app.close();
  });

  it("returns 403 for invalid Twilio signatures on inbound webhook", async () => {
    const service = new TestMessagingWebhookService();
    service.signatureValid = false;
    const app = await buildApp(testConfig(), {
      messagingWebhookService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/messages",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "bad",
      },
      payload: inboundPayload,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Invalid Twilio signature" });

    await app.close();
  });

  it("returns 415 when the inbound payload is not form-encoded", async () => {
    const service = new TestMessagingWebhookService();
    const app = await buildApp(testConfig(), {
      messagingWebhookService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/messages",
      headers: {
        "content-type": "text/plain",
        "x-twilio-signature": "sig",
      },
      payload: "not form encoded",
    });

    expect(response.statusCode).toBe(415);

    await app.close();
  });

  it("returns 204 for a valid status callback", async () => {
    const service = new TestMessagingWebhookService();
    const app = await buildApp(testConfig(), {
      messagingWebhookService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/status",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "sig",
      },
      payload: statusPayload,
    });

    expect(response.statusCode).toBe(204);
    expect(service.statusCalls).toHaveLength(1);
    expect(service.statusCalls[0]?.payload.MessageStatus).toBe("delivered");

    await app.close();
  });

  it("returns 403 for invalid Twilio signatures on status webhook", async () => {
    const service = new TestMessagingWebhookService();
    service.signatureValid = false;
    const app = await buildApp(testConfig(), {
      messagingWebhookService: service,
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/status",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "bad",
      },
      payload: statusPayload,
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });

  it("returns 503 when the messaging webhook service is unavailable", async () => {
    const app = await buildApp(testConfig(), {
      authService: createFakeAuthService({}),
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/messages",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "sig",
      },
      payload: inboundPayload,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "Messaging webhook service unavailable",
    });

    await app.close();
  });
});

class TestMessagingWebhookService implements MessagingWebhookServiceApi {
  signatureValid = true;
  readonly inboundCalls: Array<{
    context: MessagingWebhookRequestContext;
    payload: Record<string, unknown>;
  }> = [];
  readonly statusCalls: Array<{
    context: MessagingWebhookRequestContext;
    payload: Record<string, unknown>;
  }> = [];

  async handleInboundMessage(
    context: MessagingWebhookRequestContext,
    payload: Record<string, unknown>,
  ) {
    if (!this.signatureValid) {
      throw new TwilioWebhookSignatureError();
    }
    this.inboundCalls.push({ context, payload });
    return {
      conversationId: "11111111-1111-4111-8111-111111111111",
      messageId: "22222222-2222-4222-8222-222222222222",
    };
  }

  async handleStatusCallback(
    context: MessagingWebhookRequestContext,
    payload: Record<string, unknown>,
  ) {
    if (!this.signatureValid) {
      throw new TwilioWebhookSignatureError();
    }
    this.statusCalls.push({ context, payload });
    return { updatedMessageId: null };
  }
}
