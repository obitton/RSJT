import type {
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
  SessionUser,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import type {
  OutboundMessageInput,
  OutboundMessageResult,
  OutboundMessenger,
} from "../integrations/twilio/twilio-outbound-messenger.js";
import type {
  CreateOutboundMessageInput,
  MarkOutboundFailedInput,
  MarkOutboundSentInput,
  SetTakeoverInput,
} from "../repositories/conversations-repository.js";
import {
  ConversationNotFoundError,
  LiveTakeoverService,
  type LiveTakeoverStore,
  OutboundMessagingDisabledError,
  TakeoverInactiveError,
} from "./live-takeover-service.js";

const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000003",
  role: "tech",
  displayName: "Tech",
};

class FakeStore implements LiveTakeoverStore {
  detail: ConversationDetail | null = null;
  readonly takeoverCalls: SetTakeoverInput[] = [];
  readonly outboundCalls: CreateOutboundMessageInput[] = [];
  readonly sentCalls: MarkOutboundSentInput[] = [];
  readonly blockedCalls: MarkOutboundFailedInput[] = [];
  readonly failedCalls: MarkOutboundFailedInput[] = [];
  outboundMessageId = "00000000-0000-4000-8000-000000070001";

  async listForTech() {
    return {
      active: [] as ConversationSummary[],
      needsResponse: [] as ConversationSummary[],
      recent: [] as ConversationSummary[],
    };
  }
  async getDetail(_conversationId: string) {
    return this.detail;
  }
  async setTakeover(input: SetTakeoverInput) {
    this.takeoverCalls.push(input);
    if (this.detail) {
      this.detail = {
        ...this.detail,
        takeoverActive: input.active,
        takeoverStartedAt: input.active ? new Date() : null,
        takeoverStartedByUserId: input.active ? input.actorUserId : null,
      };
    }
  }
  async createOutboundMessage(input: CreateOutboundMessageInput) {
    this.outboundCalls.push(input);
    return makeMessage({
      id: this.outboundMessageId,
      direction: "outbound",
      body: input.body,
      authorRole: input.authorRole,
      sentByUserId: input.sentByUserId,
      externalStatus: "draft",
    });
  }
  async markOutboundSent(input: MarkOutboundSentInput) {
    this.sentCalls.push(input);
    return makeMessage({
      id: input.messageId,
      direction: "outbound",
      body: "body",
      authorRole: "tech",
      sentByUserId: techUser.id,
      externalStatus: input.status,
      twilioMessageSid: input.twilioMessageSid,
    });
  }
  async markOutboundBlocked(input: MarkOutboundFailedInput) {
    this.blockedCalls.push(input);
    return makeMessage({
      id: input.messageId,
      direction: "outbound",
      body: "body",
      authorRole: "tech",
      sentByUserId: techUser.id,
      externalStatus: "blocked",
    });
  }
  async markOutboundFailed(input: MarkOutboundFailedInput) {
    this.failedCalls.push(input);
    return makeMessage({
      id: input.messageId,
      direction: "outbound",
      body: "body",
      authorRole: "tech",
      sentByUserId: techUser.id,
      externalStatus: "failed",
    });
  }
}

class FakeMessenger implements OutboundMessenger {
  enabled = true;
  result: OutboundMessageResult = {
    kind: "sent",
    twilioMessageSid: "SMout",
    status: "queued",
  };
  calls: OutboundMessageInput[] = [];
  isEnabled() {
    return this.enabled;
  }
  async send(input: OutboundMessageInput) {
    this.calls.push(input);
    return this.result;
  }
}

describe("LiveTakeoverService", () => {
  it("rejects sending when takeover is inactive", async () => {
    const store = new FakeStore();
    store.detail = makeDetail({ takeoverActive: false });
    const messenger = new FakeMessenger();
    const service = new LiveTakeoverService(store, messenger, {
      channel: "whatsapp_sandbox",
    });

    await expect(
      service.sendMessage(techUser, store.detail.id, {
        body: "Hello",
      }),
    ).rejects.toBeInstanceOf(TakeoverInactiveError);
    expect(store.outboundCalls).toHaveLength(0);
  });

  it("blocks outbound and marks draft when messaging is disabled", async () => {
    const store = new FakeStore();
    store.detail = makeDetail({ takeoverActive: true });
    const messenger = new FakeMessenger();
    messenger.enabled = false;
    const service = new LiveTakeoverService(store, messenger, {
      channel: "whatsapp_sandbox",
    });

    await expect(
      service.sendMessage(techUser, store.detail.id, { body: "Hello" }),
    ).rejects.toBeInstanceOf(OutboundMessagingDisabledError);
    expect(store.outboundCalls).toHaveLength(1);
    expect(store.blockedCalls).toHaveLength(1);
    expect(messenger.calls).toHaveLength(0);
  });

  it("sends and persists the Twilio sid when outbound is enabled", async () => {
    const store = new FakeStore();
    store.detail = makeDetail({ takeoverActive: true });
    const messenger = new FakeMessenger();
    const service = new LiveTakeoverService(store, messenger, {
      channel: "whatsapp_sandbox",
    });

    const message = await service.sendMessage(techUser, store.detail.id, {
      body: "Hello",
    });

    expect(messenger.calls).toHaveLength(1);
    expect(store.sentCalls).toHaveLength(1);
    expect(message.externalStatus).toBe("queued");
    expect(message.twilioMessageSid).toBe("SMout");
  });

  it("marks the draft as failed when Twilio returns an error", async () => {
    const store = new FakeStore();
    store.detail = makeDetail({ takeoverActive: true });
    const messenger = new FakeMessenger();
    messenger.result = { kind: "failed", reason: "Twilio error" };
    const service = new LiveTakeoverService(store, messenger, {
      channel: "whatsapp_sandbox",
    });

    const message = await service.sendMessage(techUser, store.detail.id, {
      body: "Hello",
    });
    expect(message.externalStatus).toBe("failed");
    expect(store.failedCalls).toHaveLength(1);
  });

  it("activates takeover and returns the refreshed detail", async () => {
    const store = new FakeStore();
    store.detail = makeDetail({ takeoverActive: false });
    const messenger = new FakeMessenger();
    const service = new LiveTakeoverService(store, messenger, {
      channel: "whatsapp_sandbox",
    });

    const updated = await service.setTakeover(techUser, store.detail.id, true);
    expect(updated?.takeoverActive).toBe(true);
    expect(store.takeoverCalls[0]?.active).toBe(true);
    expect(store.takeoverCalls[0]?.actorUserId).toBe(techUser.id);
  });

  it("returns a not-found error when the conversation is missing", async () => {
    const store = new FakeStore();
    store.detail = null;
    const messenger = new FakeMessenger();
    const service = new LiveTakeoverService(store, messenger, {
      channel: "whatsapp_sandbox",
    });

    await expect(
      service.setTakeover(
        techUser,
        "00000000-0000-4000-8000-000000070099",
        true,
      ),
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
  });
});

function makeDetail(
  overrides: Partial<ConversationDetail> = {},
): ConversationDetail {
  const updatedAt = new Date("2026-05-26T00:00:00.000Z");
  return {
    id: "00000000-0000-4000-8000-000000070100",
    externalPhone: "+15555550100",
    takeoverActive: false,
    takeoverStartedAt: null,
    takeoverStartedByUserId: null,
    intakeState: "collecting",
    customerName: "Casey Customer",
    lastInboundAt: updatedAt,
    lastInboundPreview: "Hello",
    updatedAt,
    messages: [],
    ...overrides,
  };
}

function makeMessage(
  overrides: Partial<ConversationMessage> & { id: string },
): ConversationMessage {
  return {
    id: overrides.id,
    direction: overrides.direction ?? "outbound",
    authorRole: overrides.authorRole ?? "tech",
    body: overrides.body ?? "Hello",
    twilioMessageSid: overrides.twilioMessageSid ?? null,
    externalStatus: overrides.externalStatus ?? "draft",
    sentByUserId: overrides.sentByUserId ?? techUser.id,
    createdAt: overrides.createdAt ?? new Date("2026-05-26T00:00:00.000Z"),
  };
}
