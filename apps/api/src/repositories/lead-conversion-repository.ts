import type { AppDb } from "@rsjt/db";
import { conversations, jobs, schedulingProposals } from "@rsjt/db";
import {
  type JobState,
  type JobSummary,
  JobSummarySchema,
  type RepairShoprReference,
  RepairShoprReferenceSchema,
} from "@rsjt/shared";
import { and, eq } from "drizzle-orm";
import type {
  ConversionConversation,
  CreateJobFromConversationInput,
  LeadConversionStore,
} from "../services/lead-conversion-service.js";

type JobRow = typeof jobs.$inferSelect;

export class LeadConversionRepository implements LeadConversionStore {
  constructor(private readonly db: AppDb) {}

  async getConversationForConversion(
    conversationId: string,
  ): Promise<ConversionConversation | null> {
    const [row] = await this.db
      .select({
        id: conversations.id,
        intakeState: conversations.intakeState,
        customerName: conversations.customerName,
        matchedRepairShoprEntityType:
          conversations.matchedRepairShoprEntityType,
        matchedRepairShoprId: conversations.matchedRepairShoprId,
        matchedRepairShoprDisplayLabel:
          conversations.matchedRepairShoprDisplayLabel,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    return row ?? null;
  }

  async hasApprovedSchedulingProposal(
    conversationId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schedulingProposals.id })
      .from(schedulingProposals)
      .where(
        and(
          eq(schedulingProposals.conversationId, conversationId),
          eq(schedulingProposals.state, "approved"),
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  async getJobByConversationId(
    conversationId: string,
  ): Promise<JobSummary | null> {
    const [row] = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.conversationId, conversationId))
      .limit(1);

    return row ? toJobSummary(row) : null;
  }

  async createJobFromConversation(
    input: CreateJobFromConversationInput,
  ): Promise<JobSummary> {
    const [row] = await this.db
      .insert(jobs)
      .values({
        conversationId: input.conversationId,
        state: input.state,
        customerLabel: input.customerLabel,
        repairShoprEntityType: input.repairShoprEntityType,
        repairShoprId: input.repairShoprId,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create job from conversation");
    }

    return toJobSummary(row);
  }
}

function toJobSummary(row: JobRow): JobSummary {
  const repairShoprReference = toRepairShoprReference(row);

  return JobSummarySchema.parse({
    id: row.id,
    state: row.state satisfies JobState,
    ...(row.customerLabel ? { customerLabel: row.customerLabel } : {}),
    ...(row.splitCategory ? { splitCategory: row.splitCategory } : {}),
    ...(row.grossChargeCents !== null
      ? { grossChargeCents: row.grossChargeCents }
      : {}),
    ...(row.reportedProfitCents !== null
      ? { reportedProfitCents: row.reportedProfitCents }
      : {}),
    ...(row.profitBasis ? { profitBasis: row.profitBasis } : {}),
    ...(repairShoprReference ? { repairShoprReference } : {}),
  });
}

function toRepairShoprReference(row: JobRow): RepairShoprReference | null {
  if (!row.repairShoprEntityType || !row.repairShoprId) {
    return null;
  }

  return RepairShoprReferenceSchema.parse({
    entityType: row.repairShoprEntityType,
    repairShoprId: row.repairShoprId,
    displayLabel:
      row.customerLabel ?? `${row.repairShoprEntityType} ${row.repairShoprId}`,
  });
}
