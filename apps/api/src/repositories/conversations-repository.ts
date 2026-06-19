import type { AppDb } from "@rsjt/db";
import { conversations, jobs, messages } from "@rsjt/db";
import {
  type ConversationDetail,
  ConversationDetailSchema,
  type ConversationMessage,
  ConversationMessageSchema,
  type ConversationSummary,
  ConversationSummarySchema,
} from "@rsjt/shared";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

export type CreateOutboundMessageInput = {
  conversationId: string;
  body: string;
  sentByUserId: string;
  authorRole: "manager" | "tech";
};

export type MarkOutboundSentInput = {
  messageId: string;
  twilioMessageSid: string;
  status: string;
};

export type MarkOutboundFailedInput = {
  messageId: string;
  reason: string;
};

export type SetTakeoverInput = {
  conversationId: string;
  active: boolean;
  actorUserId: string;
};

export class ConversationsRepository {
  constructor(private readonly db: AppDb) {}

  async listForTech(): Promise<{
    active: ConversationSummary[];
    needsResponse: ConversationSummary[];
    recent: ConversationSummary[];
  }> {
    const rows = await this.db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));

    if (rows.length === 0) {
      return { active: [], needsResponse: [], recent: [] };
    }

    const conversationIds = rows.map((row) => row.id);
    const previewMap = await this.lastInboundPreviews(conversationIds);

    const summaries = rows.map((row) => toConversationSummary(row, previewMap));

    const active = summaries.filter((summary) => summary.takeoverActive);
    const activeIds = new Set(active.map((summary) => summary.id));
    const needsResponse = summaries.filter(
      (summary) =>
        !activeIds.has(summary.id) &&
        (summary.intakeState === "review_ready" ||
          summary.intakeState === "collecting" ||
          summary.intakeState === "identifying"),
    );
    const recent = summaries.filter(
      (summary) =>
        !activeIds.has(summary.id) && !needsResponse.includes(summary),
    );

    return { active, needsResponse, recent };
  }

  async getDetail(conversationId: string): Promise<ConversationDetail | null> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!row) {
      return null;
    }

    const messageRows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    const [job] = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.conversationId, conversationId))
      .limit(1);

    const previewMap = await this.lastInboundPreviews([conversationId]);
    const summary = toConversationSummary(row, previewMap);
    return ConversationDetailSchema.parse({
      ...summary,
      jobId: job?.id ?? null,
      messages: messageRows.map(toConversationMessage),
    });
  }

  async setTakeover(input: SetTakeoverInput) {
    await this.db
      .update(conversations)
      .set({
        takeoverActive: input.active,
        takeoverStartedAt: input.active ? new Date() : null,
        takeoverStartedByUserId: input.active ? input.actorUserId : null,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, input.conversationId));
  }

  async createOutboundMessage(
    input: CreateOutboundMessageInput,
  ): Promise<ConversationMessage> {
    const [row] = await this.db
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        direction: "outbound",
        authorRole: input.authorRole,
        body: input.body,
        externalStatus: "draft",
        sentByUserId: input.sentByUserId,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create outbound message");
    }

    return toConversationMessage(row);
  }

  async markOutboundSent(
    input: MarkOutboundSentInput,
  ): Promise<ConversationMessage | null> {
    const [row] = await this.db
      .update(messages)
      .set({
        twilioMessageSid: input.twilioMessageSid,
        externalStatus: input.status,
      })
      .where(eq(messages.id, input.messageId))
      .returning();

    return row ? toConversationMessage(row) : null;
  }

  async markOutboundBlocked(
    input: MarkOutboundFailedInput,
  ): Promise<ConversationMessage | null> {
    const [row] = await this.db
      .update(messages)
      .set({
        externalStatus: "blocked",
      })
      .where(eq(messages.id, input.messageId))
      .returning();

    return row ? toConversationMessage(row) : null;
  }

  async markOutboundFailed(
    input: MarkOutboundFailedInput,
  ): Promise<ConversationMessage | null> {
    const [row] = await this.db
      .update(messages)
      .set({
        externalStatus: "failed",
      })
      .where(eq(messages.id, input.messageId))
      .returning();

    return row ? toConversationMessage(row) : null;
  }

  private async lastInboundPreviews(conversationIds: string[]) {
    if (conversationIds.length === 0) {
      return new Map<string, string>();
    }

    const inboundRows = await this.db
      .select({
        conversationId: messages.conversationId,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          inArray(
            messages.conversationId,
            conversationIds.filter((id): id is string => id.length > 0),
          ),
          eq(messages.direction, "inbound"),
          isNotNull(messages.conversationId),
        ),
      )
      .orderBy(desc(messages.createdAt));

    const map = new Map<string, string>();
    for (const row of inboundRows) {
      if (row.conversationId && !map.has(row.conversationId)) {
        map.set(row.conversationId, row.body.slice(0, 120));
      }
    }
    return map;
  }
}

function toConversationSummary(
  row: ConversationRow,
  previews: Map<string, string>,
): ConversationSummary {
  return ConversationSummarySchema.parse({
    id: row.id,
    externalPhone: row.externalPhone,
    takeoverActive: row.takeoverActive,
    takeoverStartedAt: row.takeoverStartedAt,
    takeoverStartedByUserId: row.takeoverStartedByUserId,
    intakeState: row.intakeState,
    customerName: row.customerName,
    lastInboundAt: row.lastInboundAt,
    lastInboundPreview: previews.get(row.id) ?? null,
    updatedAt: row.updatedAt,
  });
}

function toConversationMessage(row: MessageRow): ConversationMessage {
  return ConversationMessageSchema.parse({
    id: row.id,
    direction: row.direction,
    authorRole:
      row.authorRole === "manager" || row.authorRole === "tech"
        ? row.authorRole
        : null,
    body: row.body,
    twilioMessageSid: row.twilioMessageSid,
    externalStatus: row.externalStatus,
    sentByUserId: row.sentByUserId,
    createdAt: row.createdAt,
  });
}
