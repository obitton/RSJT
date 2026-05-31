import { randomUUID } from "node:crypto";
import {
  type AppDb,
  conversations,
  createDb,
  createPool,
  messageMedia,
  messages,
  messagingWebhookEvents,
} from "@rsjt/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MessagesRepository } from "./messages-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("MessagesRepository (inbound webhook persistence)", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: MessagesRepository;
  const createdConversationIds: string[] = [];
  const createdMessageSids: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new MessagesRepository(db);
  });

  afterEach(async () => {
    if (createdMessageSids.length > 0) {
      await db
        .delete(messagingWebhookEvents)
        .where(
          inArray(messagingWebhookEvents.twilioMessageSid, createdMessageSids),
        );

      const messageRows = await db
        .select({ id: messages.id })
        .from(messages)
        .where(inArray(messages.twilioMessageSid, createdMessageSids));
      const messageIds = messageRows.map((row) => row.id);

      if (messageIds.length > 0) {
        await db
          .delete(messageMedia)
          .where(inArray(messageMedia.messageId, messageIds));
        await db.delete(messages).where(inArray(messages.id, messageIds));
      }
      createdMessageSids.length = 0;
    }

    if (createdConversationIds.length > 0) {
      await db
        .delete(conversations)
        .where(inArray(conversations.id, createdConversationIds));
      createdConversationIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a conversation and reuses it for the same external phone", async () => {
    const phone = `+1555000${Date.now().toString().slice(-4)}`;
    const firstId = await repository.findOrCreateConversationByExternalPhone({
      externalPhone: phone,
    });
    const secondId = await repository.findOrCreateConversationByExternalPhone({
      externalPhone: phone,
    });

    createdConversationIds.push(firstId);
    expect(secondId).toBe(firstId);
  });

  it("persists an inbound message with media and an audit webhook event", async () => {
    const phone = `+1555100${Date.now().toString().slice(-4)}`;
    const conversationId =
      await repository.findOrCreateConversationByExternalPhone({
        externalPhone: phone,
      });
    createdConversationIds.push(conversationId);

    const twilioSid = `SMtest${randomUUID()}`;
    createdMessageSids.push(twilioSid);
    const inbound = await repository.persistInboundTwilioMessage({
      conversationId,
      twilioMessageSid: twilioSid,
      body: "Photo attached",
      media: [
        {
          index: 0,
          contentType: "image/jpeg",
          url: "https://api.twilio.com/media/abc",
        },
      ],
      rawPayload: { MessageSid: twilioSid, Body: "Photo attached" },
    });

    expect(inbound.conversationId).toBe(conversationId);
    expect(inbound.media).toHaveLength(1);
    expect(inbound.media[0]?.contentType).toBe("image/jpeg");

    const eventRows = await db
      .select()
      .from(messagingWebhookEvents)
      .where(eq(messagingWebhookEvents.twilioMessageSid, twilioSid));
    expect(eventRows).toHaveLength(1);
    expect(eventRows[0]?.eventType).toBe("inbound_message");
  });

  it("treats duplicate Twilio SIDs as idempotent and records a second event", async () => {
    const phone = `+1555200${Date.now().toString().slice(-4)}`;
    const conversationId =
      await repository.findOrCreateConversationByExternalPhone({
        externalPhone: phone,
      });
    createdConversationIds.push(conversationId);

    const twilioSid = `SMdup${randomUUID()}`;
    createdMessageSids.push(twilioSid);
    const first = await repository.persistInboundTwilioMessage({
      conversationId,
      twilioMessageSid: twilioSid,
      body: "Original body",
      media: [],
      rawPayload: { MessageSid: twilioSid, Body: "Original body" },
    });

    const second = await repository.persistInboundTwilioMessage({
      conversationId,
      twilioMessageSid: twilioSid,
      body: "Retry body",
      media: [],
      rawPayload: { MessageSid: twilioSid, Body: "Retry body" },
    });

    expect(second.id).toBe(first.id);
    expect(second.body).toBe("Original body");

    const eventRows = await db
      .select()
      .from(messagingWebhookEvents)
      .where(eq(messagingWebhookEvents.twilioMessageSid, twilioSid));
    expect(eventRows).toHaveLength(2);
  });

  it("persists a status callback and updates outbound message status", async () => {
    const twilioSid = `SMstatus${randomUUID()}`;
    createdMessageSids.push(twilioSid);
    const [outbound] = await db
      .insert(messages)
      .values({
        direction: "outbound",
        body: "Outbound test",
        twilioMessageSid: twilioSid,
      })
      .returning({ id: messages.id });

    expect(outbound).toBeDefined();

    const result = await repository.persistStatusCallback({
      twilioMessageSid: twilioSid,
      status: "delivered",
      rawPayload: { MessageSid: twilioSid, MessageStatus: "delivered" },
    });

    expect(result.updatedMessageId).toBe(outbound?.id);

    const [updated] = await db
      .select({ externalStatus: messages.externalStatus })
      .from(messages)
      .where(eq(messages.id, outbound?.id ?? ""));

    expect(updated?.externalStatus).toBe("delivered");

    const events = await db
      .select()
      .from(messagingWebhookEvents)
      .where(eq(messagingWebhookEvents.twilioMessageSid, twilioSid));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("status_callback");
  });

  it("records a status event for an unknown outbound message without failing", async () => {
    const twilioSid = `SMghost${randomUUID()}`;
    createdMessageSids.push(twilioSid);

    const result = await repository.persistStatusCallback({
      twilioMessageSid: twilioSid,
      status: "failed",
      rawPayload: { MessageSid: twilioSid, MessageStatus: "failed" },
    });

    expect(result.updatedMessageId).toBeNull();

    const events = await db
      .select()
      .from(messagingWebhookEvents)
      .where(eq(messagingWebhookEvents.twilioMessageSid, twilioSid));
    expect(events).toHaveLength(1);
  });
});
