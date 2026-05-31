import type { AppDb } from "@rsjt/db";
import {
  conversations,
  messageMedia,
  messages,
  messagingWebhookEvents,
} from "@rsjt/db";
import type {
  InboundMessageRecord,
  MessagingWebhookEventKind,
  TwilioMediaItem,
  UserRole,
} from "@rsjt/shared";
import { and, eq } from "drizzle-orm";

type CreateJobUpdateMessageInput = {
  jobId: string;
  authorRole: UserRole;
  body: string;
};

export type FindOrCreateConversationInput = {
  externalPhone: string;
};

export type InboundTwilioMessageInput = {
  conversationId: string;
  twilioMessageSid: string;
  body: string;
  media: TwilioMediaItem[];
  rawPayload: Record<string, unknown>;
};

export type StatusCallbackPersistInput = {
  twilioMessageSid: string;
  status: string;
  rawPayload: Record<string, unknown>;
};

export class MessagesRepository {
  constructor(private readonly db: AppDb) {}

  async createJobUpdateMessage(input: CreateJobUpdateMessageInput) {
    const [message] = await this.db
      .insert(messages)
      .values({
        jobId: input.jobId,
        direction: "internal",
        authorRole: input.authorRole,
        body: input.body,
      })
      .returning({ id: messages.id });

    if (!message) {
      throw new Error("Failed to create job update message");
    }

    return message.id;
  }

  async findOrCreateConversationByExternalPhone(
    input: FindOrCreateConversationInput,
  ): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.externalPhone, input.externalPhone))
        .limit(1);

      if (existing) {
        return existing.id;
      }

      const [created] = await tx
        .insert(conversations)
        .values({ externalPhone: input.externalPhone })
        .returning({ id: conversations.id });

      if (!created) {
        throw new Error("Failed to create conversation");
      }

      return created.id;
    });
  }

  async persistInboundTwilioMessage(
    input: InboundTwilioMessageInput,
  ): Promise<InboundMessageRecord> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          body: messages.body,
          twilioMessageSid: messages.twilioMessageSid,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.twilioMessageSid, input.twilioMessageSid))
        .limit(1);

      let messageId: string;
      let createdAt: Date;
      let body: string;

      if (existing) {
        messageId = existing.id;
        createdAt = existing.createdAt;
        body = existing.body;
      } else {
        const [created] = await tx
          .insert(messages)
          .values({
            conversationId: input.conversationId,
            direction: "inbound",
            authorRole: null,
            body: input.body,
            twilioMessageSid: input.twilioMessageSid,
          })
          .returning({
            id: messages.id,
            createdAt: messages.createdAt,
            body: messages.body,
          });

        if (!created) {
          throw new Error("Failed to persist inbound message");
        }

        messageId = created.id;
        createdAt = created.createdAt;
        body = created.body;

        if (input.media.length > 0) {
          await tx.insert(messageMedia).values(
            input.media.map((item) => ({
              messageId,
              mediaIndex: item.index,
              contentType: item.contentType,
              url: item.url,
            })),
          );
        }
      }

      await tx.insert(messagingWebhookEvents).values({
        eventType: "inbound_message" satisfies MessagingWebhookEventKind,
        twilioMessageSid: input.twilioMessageSid,
        payload: input.rawPayload,
      });

      const mediaRows = await tx
        .select({
          id: messageMedia.id,
          messageId: messageMedia.messageId,
          mediaIndex: messageMedia.mediaIndex,
          contentType: messageMedia.contentType,
          url: messageMedia.url,
          createdAt: messageMedia.createdAt,
        })
        .from(messageMedia)
        .where(eq(messageMedia.messageId, messageId));

      return {
        id: messageId,
        conversationId: input.conversationId,
        twilioMessageSid: input.twilioMessageSid,
        body,
        media: mediaRows,
        createdAt,
      };
    });
  }

  async persistStatusCallback(
    input: StatusCallbackPersistInput,
  ): Promise<{ updatedMessageId: string | null }> {
    return this.db.transaction(async (tx) => {
      await tx.insert(messagingWebhookEvents).values({
        eventType: "status_callback" satisfies MessagingWebhookEventKind,
        twilioMessageSid: input.twilioMessageSid,
        payload: input.rawPayload,
      });

      const [updated] = await tx
        .update(messages)
        .set({ externalStatus: input.status })
        .where(
          and(
            eq(messages.twilioMessageSid, input.twilioMessageSid),
            eq(messages.direction, "outbound"),
          ),
        )
        .returning({ id: messages.id });

      return { updatedMessageId: updated?.id ?? null };
    });
  }
}
