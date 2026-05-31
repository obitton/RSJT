import type { AppDb } from "@rsjt/db";
import { schedulingProposals } from "@rsjt/db";
import {
  type RepairShoprAppointmentPayload,
  type SchedulingProposal,
  SchedulingProposalSchema,
  type SchedulingProposalState,
  type SourceEvidence,
} from "@rsjt/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

type SchedulingRow = typeof schedulingProposals.$inferSelect;

export type CreateSchedulingProposalInput = {
  conversationId: string;
  jobId: string | null;
  preferredWindowText: string;
  startAt: Date | null;
  endAt: Date | null;
  customerMessageBody: string;
  repairShoprAppointmentPayload: RepairShoprAppointmentPayload;
  sourceEvidence: SourceEvidence[];
  customerMessageApprovalId: string | null;
  appointmentApprovalId: string | null;
};

export type EditSchedulingProposalPatch = {
  preferredWindowText?: string;
  customerMessageBody?: string;
};

export type SetSchedulingStateInput = {
  proposalId: string;
  state: Exclude<SchedulingProposalState, "pending">;
  actorUserId: string;
};

export type ListSchedulingFilters = {
  state?: SchedulingProposalState;
};

export class SchedulingProposalsRepository {
  constructor(private readonly db: AppDb) {}

  async create(input: CreateSchedulingProposalInput) {
    const [row] = await this.db
      .insert(schedulingProposals)
      .values({
        conversationId: input.conversationId,
        jobId: input.jobId,
        preferredWindowText: input.preferredWindowText,
        startAt: input.startAt,
        endAt: input.endAt,
        customerMessageBody: input.customerMessageBody,
        repairShoprAppointmentPayload: input.repairShoprAppointmentPayload,
        sourceEvidence: input.sourceEvidence,
        customerMessageApprovalId: input.customerMessageApprovalId,
        appointmentApprovalId: input.appointmentApprovalId,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create scheduling proposal");
    }
    return toSchedulingProposal(row);
  }

  async list(filters: ListSchedulingFilters = {}): Promise<{
    pending: SchedulingProposal[];
    decided: SchedulingProposal[];
  }> {
    const baseQuery = this.db
      .select()
      .from(schedulingProposals)
      .orderBy(desc(schedulingProposals.updatedAt));

    const rows = filters.state
      ? await baseQuery.where(eq(schedulingProposals.state, filters.state))
      : await baseQuery;

    const proposals = rows.map(toSchedulingProposal);
    return {
      pending: proposals.filter((proposal) => proposal.state === "pending"),
      decided: proposals.filter((proposal) => proposal.state !== "pending"),
    };
  }

  async getById(proposalId: string): Promise<SchedulingProposal | null> {
    const [row] = await this.db
      .select()
      .from(schedulingProposals)
      .where(eq(schedulingProposals.id, proposalId))
      .limit(1);

    return row ? toSchedulingProposal(row) : null;
  }

  async updatePending(
    proposalId: string,
    patch: EditSchedulingProposalPatch,
  ): Promise<SchedulingProposal | null> {
    const updates: Partial<typeof schedulingProposals.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.preferredWindowText !== undefined) {
      updates.preferredWindowText = patch.preferredWindowText;
    }
    if (patch.customerMessageBody !== undefined) {
      updates.customerMessageBody = patch.customerMessageBody;
    }

    const [row] = await this.db
      .update(schedulingProposals)
      .set(updates)
      .where(
        and(
          eq(schedulingProposals.id, proposalId),
          eq(schedulingProposals.state, "pending"),
        ),
      )
      .returning();

    return row ? toSchedulingProposal(row) : null;
  }

  async setState(
    input: SetSchedulingStateInput,
  ): Promise<SchedulingProposal | null> {
    const now = new Date();
    const [row] = await this.db
      .update(schedulingProposals)
      .set({
        state: input.state,
        decidedByUserId: input.actorUserId,
        decidedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(schedulingProposals.id, input.proposalId),
          eq(schedulingProposals.state, "pending"),
        ),
      )
      .returning();

    return row ? toSchedulingProposal(row) : null;
  }

  async findCandidateSources(): Promise<SchedulingProposal[]> {
    const rows = await this.db
      .select()
      .from(schedulingProposals)
      .where(eq(schedulingProposals.state, "pending"))
      .orderBy(asc(schedulingProposals.createdAt));
    return rows.map(toSchedulingProposal);
  }

  async deleteByIds(ids: string[]) {
    if (ids.length === 0) {
      return;
    }
    await this.db
      .delete(schedulingProposals)
      .where(inArray(schedulingProposals.id, ids));
  }
}

function toSchedulingProposal(row: SchedulingRow): SchedulingProposal {
  return SchedulingProposalSchema.parse({
    id: row.id,
    conversationId: row.conversationId,
    jobId: row.jobId,
    state: row.state,
    preferredWindowText: row.preferredWindowText,
    startAt: row.startAt,
    endAt: row.endAt,
    customerMessageBody: row.customerMessageBody,
    repairShoprAppointmentPayload: row.repairShoprAppointmentPayload,
    sourceEvidence: row.sourceEvidence,
    customerMessageApprovalId: row.customerMessageApprovalId,
    appointmentApprovalId: row.appointmentApprovalId,
    decidedByUserId: row.decidedByUserId,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
