import type { InboundMessageRecord } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import type { TwilioSignatureVerifier } from "../integrations/twilio/twilio-webhook-verifier.js";
import type {
  InboundTwilioMessageInput,
  StatusCallbackPersistInput,
} from "../repositories/messages-repository.js";
import {
  type IntakeEvaluator,
  MessagingWebhookService,
  type MessagingWebhookStore,
  TwilioWebhookSignatureError,
} from "./messaging-webhook-service.js";

class FakeStore implements MessagingWebhookStore {
  readonly inbound: InboundTwilioMessageInput[] = [];
  readonly callbacks: StatusCallbackPersistInput[] = [];
  conversationCalls: string[] = [];
  outboundLookup = new Map<string, string>();

  async findOrCreateConversationByExternalPhone({
    externalPhone,
  }: {
    externalPhone: string;
  }) {
    this.conversationCalls.push(externalPhone);
    return "11111111-1111-4111-8111-111111111111";
  }

  async persistInboundTwilioMessage(input: InboundTwilioMessageInput) {
    this.inbound.push(input);
    const record: InboundMessageRecord = {
      id: "22222222-2222-4222-8222-222222222222",
      conversationId: input.conversationId,
      twilioMessageSid: input.twilioMessageSid,
      body: input.body,
      media: input.media.map((media, index) => ({
        id: `33333333-3333-4333-8333-${index.toString().padStart(12, "0")}`,
        messageId: "22222222-2222-4222-8222-222222222222",
        mediaIndex: media.index,
        contentType: media.contentType,
        url: media.url,
        createdAt: new Date("2026-05-26T00:00:00.000Z"),
      })),
      createdAt: new Date("2026-05-26T00:00:00.000Z"),
    };
    return record;
  }

  async persistStatusCallback(input: StatusCallbackPersistInput) {
    this.callbacks.push(input);
    return {
      updatedMessageId: this.outboundLookup.get(input.twilioMessageSid) ?? null,
    };
  }
}

class FakeIntakeEvaluator implements IntakeEvaluator {
  readonly calls: Array<{
    conversationId: string;
    messageId: string;
    body: string;
    hasMedia: boolean;
    intakeBotUserId: string;
  }> = [];

  async evaluateInboundMessage(input: {
    conversationId: string;
    messageId: string;
    body: string;
    hasMedia: boolean;
    intakeBotUserId: string;
  }) {
    this.calls.push(input);
    return null;
  }
}

class StubVerifier implements TwilioSignatureVerifier {
  result = true;
  readonly calls: Array<{
    signature: string | undefined;
    requestUrl: string;
    payload: Record<string, unknown>;
  }> = [];

  verify(input: {
    signature: string | undefined;
    requestUrl: string;
    payload: Record<string, unknown>;
  }) {
    this.calls.push(input);
    return this.result;
  }
}

describe("MessagingWebhookService", () => {
  it("verifies the signature, persists the inbound message and media, and returns IDs", async () => {
    const store = new FakeStore();
    const verifier = new StubVerifier();
    const service = new MessagingWebhookService(store, verifier);
    const payload = {
      MessageSid: "SM123",
      From: "+15555550100",
      To: "+15555550199",
      Body: "Hello",
      NumMedia: "1",
      MediaUrl0: "https://api.twilio.com/media/abc",
      MediaContentType0: "image/jpeg",
    };

    const result = await service.handleInboundMessage(
      {
        signature: "sig",
        requestUrl: "/webhooks/twilio/messages",
      },
      payload,
    );

    expect(result.messageId).toBe("22222222-2222-4222-8222-222222222222");
    expect(store.inbound).toHaveLength(1);
    expect(store.inbound[0]?.media).toEqual([
      {
        index: 0,
        contentType: "image/jpeg",
        url: "https://api.twilio.com/media/abc",
      },
    ]);
    expect(verifier.calls).toHaveLength(1);
  });

  it("rejects payloads with invalid signatures before persistence", async () => {
    const store = new FakeStore();
    const verifier = new StubVerifier();
    verifier.result = false;
    const service = new MessagingWebhookService(store, verifier);

    await expect(
      service.handleInboundMessage(
        {
          signature: "bad",
          requestUrl: "/webhooks/twilio/messages",
        },
        { MessageSid: "SM124", From: "+1", To: "+1", Body: "", NumMedia: "0" },
      ),
    ).rejects.toBeInstanceOf(TwilioWebhookSignatureError);
    expect(store.inbound).toHaveLength(0);
  });

  it("persists status callbacks and surfaces matched outbound updates", async () => {
    const store = new FakeStore();
    store.outboundLookup.set("SMout", "55555555-5555-4555-8555-555555555555");
    const verifier = new StubVerifier();
    const service = new MessagingWebhookService(store, verifier);

    const result = await service.handleStatusCallback(
      {
        signature: "sig",
        requestUrl: "/webhooks/twilio/status",
      },
      {
        MessageSid: "SMout",
        MessageStatus: "delivered",
      },
    );

    expect(result.updatedMessageId).toBe(
      "55555555-5555-4555-8555-555555555555",
    );
    expect(store.callbacks).toEqual([
      {
        twilioMessageSid: "SMout",
        status: "delivered",
        rawPayload: {
          MessageSid: "SMout",
          MessageStatus: "delivered",
        },
      },
    ]);
  });

  it("calls the intake evaluator after inbound persistence when configured", async () => {
    const store = new FakeStore();
    const verifier = new StubVerifier();
    const intake = new FakeIntakeEvaluator();
    const service = new MessagingWebhookService(store, verifier, {
      intakeEvaluator: intake,
      intakeBotUserId: "99999999-9999-4999-8999-999999999999",
    });

    await service.handleInboundMessage(
      { signature: "sig", requestUrl: "/webhooks/twilio/messages" },
      {
        MessageSid: "SMintake",
        From: "+15555550100",
        To: "+15555550199",
        Body: "Hello",
        NumMedia: "0",
      },
    );

    expect(intake.calls).toHaveLength(1);
    expect(intake.calls[0]).toMatchObject({
      conversationId: "11111111-1111-4111-8111-111111111111",
      messageId: "22222222-2222-4222-8222-222222222222",
      body: "Hello",
      intakeBotUserId: "99999999-9999-4999-8999-999999999999",
    });
  });

  it("does not call the intake evaluator when none is configured", async () => {
    const store = new FakeStore();
    const verifier = new StubVerifier();
    const service = new MessagingWebhookService(store, verifier);

    await service.handleInboundMessage(
      { signature: "sig", requestUrl: "/webhooks/twilio/messages" },
      {
        MessageSid: "SMnobot",
        From: "+15555550100",
        To: "+15555550199",
        Body: "Hello",
        NumMedia: "0",
      },
    );

    expect(store.inbound).toHaveLength(1);
  });

  it("rejects status callbacks with invalid signatures", async () => {
    const store = new FakeStore();
    const verifier = new StubVerifier();
    verifier.result = false;
    const service = new MessagingWebhookService(store, verifier);

    await expect(
      service.handleStatusCallback(
        { signature: undefined, requestUrl: "/webhooks/twilio/status" },
        { MessageSid: "SMout", MessageStatus: "delivered" },
      ),
    ).rejects.toBeInstanceOf(TwilioWebhookSignatureError);
  });
});
