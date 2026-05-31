import type { AppDb } from "@rsjt/db";
import { approvals, conversations, messages } from "@rsjt/db";
import {
  type CustomerIntakeSnapshot,
  CustomerIntakeSnapshotSchema,
  type CustomerIntakeState,
  type RepairShoprReference,
} from "@rsjt/shared";
import { and, desc, eq } from "drizzle-orm";

type ConversationRow = typeof conversations.$inferSelect;

export type InboundMessageSummary = {
  id: string;
  body: string;
  createdAt: Date;
};

export type ConversationFieldsPatch = {
  customerName?: string | null;
  email?: string | null;
  serviceAddress?: string | null;
  problemDescription?: string | null;
  preferredTiming?: string | null;
};

export type IntakeUpdateInput = {
  conversationId: string;
  state: CustomerIntakeState;
  spamScore: number;
  blockedReason: string | null;
  fields: ConversationFieldsPatch;
  lastInboundMessageId: string;
  lastInboundAt: Date;
};

export type LinkMatchInput = {
  conversationId: string;
  reference: RepairShoprReference | null;
  confidenceBand: string | null;
};

export class IntakeRepository {
  constructor(private readonly db: AppDb) {}

  async getConversationSnapshot(
    conversationId: string,
  ): Promise<CustomerIntakeSnapshot | null> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    return row ? toIntakeSnapshot(row) : null;
  }

  async getRecentInboundMessages(
    conversationId: string,
    limit: number,
  ): Promise<InboundMessageSummary[]> {
    const rows = await this.db
      .select({
        id: messages.id,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.direction, "inbound"),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows;
  }

  async updateConversationIntake(input: IntakeUpdateInput) {
    const now = new Date();
    const patch: Partial<typeof conversations.$inferInsert> = {
      intakeState: input.state,
      spamScore: input.spamScore,
      blockedReason: input.blockedReason,
      lastInboundMessageId: input.lastInboundMessageId,
      lastInboundAt: input.lastInboundAt,
      updatedAt: now,
    };

    if (input.fields.customerName !== undefined) {
      patch.customerName = input.fields.customerName;
    }
    if (input.fields.email !== undefined) {
      patch.customerEmail = input.fields.email;
    }
    if (input.fields.serviceAddress !== undefined) {
      patch.serviceAddress = input.fields.serviceAddress;
    }
    if (input.fields.problemDescription !== undefined) {
      patch.problemDescription = input.fields.problemDescription;
    }
    if (input.fields.preferredTiming !== undefined) {
      patch.preferredTiming = input.fields.preferredTiming;
    }

    await this.db
      .update(conversations)
      .set(patch)
      .where(eq(conversations.id, input.conversationId));
  }

  async linkMatchedRepairShoprReference(input: LinkMatchInput) {
    await this.db
      .update(conversations)
      .set({
        matchedRepairShoprEntityType: input.reference?.entityType ?? null,
        matchedRepairShoprId: input.reference?.repairShoprId ?? null,
        matchedRepairShoprDisplayLabel: input.reference?.displayLabel ?? null,
        matchedConfidenceBand: input.confidenceBand,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, input.conversationId));
  }

  async listPendingIntakeApprovalIds(conversationId: string) {
    const rows = await this.db
      .select({ id: approvals.id, payload: approvals.payload })
      .from(approvals)
      .where(eq(approvals.state, "pending"));

    return rows
      .filter((row) =>
        intakePayloadMatchesConversation(row.payload, conversationId),
      )
      .map((row) => row.id);
  }
}

export function toIntakeSnapshot(row: ConversationRow): CustomerIntakeSnapshot {
  const reference =
    row.matchedRepairShoprEntityType &&
    row.matchedRepairShoprId &&
    row.matchedRepairShoprDisplayLabel
      ? {
          entityType: row.matchedRepairShoprEntityType,
          repairShoprId: row.matchedRepairShoprId,
          displayLabel: row.matchedRepairShoprDisplayLabel,
        }
      : null;

  return CustomerIntakeSnapshotSchema.parse({
    conversationId: row.id,
    state: row.intakeState,
    customerName: row.customerName,
    phone: row.externalPhone,
    email: row.customerEmail,
    serviceAddress: row.serviceAddress,
    problemDescription: row.problemDescription,
    preferredTiming: row.preferredTiming,
    blockedReason: row.blockedReason,
    spamScore: row.spamScore,
    matchedReference: reference,
    matchedConfidenceBand: row.matchedConfidenceBand,
    takeoverActive: row.takeoverActive,
    lastInboundMessageId: row.lastInboundMessageId,
    lastInboundAt: row.lastInboundAt,
    updatedAt: row.updatedAt,
  });
}

function intakePayloadMatchesConversation(
  payload: unknown,
  conversationId: string,
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return record.conversationId === conversationId;
}
