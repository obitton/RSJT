import type { AppDb } from "@rsjt/db";
import { approvals, auditEvents } from "@rsjt/db";
import {
  type ApprovalFilterQuery,
  type ApprovalPayload,
  type ApprovalRecord,
  ApprovalRecordSchema,
  type ApprovalState,
  type CreateApprovalRequest,
  type UserRole,
} from "@rsjt/shared";
import { and, eq } from "drizzle-orm";

type ApprovalRow = typeof approvals.$inferSelect;

export type CreateApprovalInput = CreateApprovalRequest & {
  createdByUserId: string;
};

export type ApprovalStateMetadata = {
  reason?: string;
};

export class ApprovalsRepository {
  constructor(private readonly db: AppDb) {}

  async create(input: CreateApprovalInput) {
    return this.db.transaction(async (tx) => {
      const [approval] = await tx
        .insert(approvals)
        .values({
          jobId: input.jobId ?? null,
          kind: input.kind,
          state: "pending",
          risk: input.risk,
          requiredRole: input.requiredRole,
          originalPayload: input.payload,
          payload: input.payload,
          evidence: input.evidence,
          createdByUserId: input.createdByUserId,
        })
        .returning();

      if (!approval) {
        throw new Error("Failed to create approval");
      }

      await tx.insert(auditEvents).values({
        actorUserId: input.createdByUserId,
        entityType: "approval",
        entityId: approval.id,
        action: "approval_created",
        metadata: {
          kind: input.kind,
          risk: input.risk,
          requiredRole: input.requiredRole,
        },
      });

      return toApprovalRecord(approval);
    });
  }

  async list(filters: ApprovalFilterQuery = {}) {
    const where = approvalFilters(filters);
    const query = this.db.select().from(approvals);
    const rows = where ? await query.where(where) : await query;

    return rows.map(toApprovalRecord);
  }

  async getById(id: string) {
    const [approval] = await this.db
      .select()
      .from(approvals)
      .where(eq(approvals.id, id))
      .limit(1);

    return approval ? toApprovalRecord(approval) : null;
  }

  async editPending(id: string, actorUserId: string, payload: ApprovalPayload) {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [approval] = await tx
        .update(approvals)
        .set({ payload, updatedAt: now })
        .where(and(eq(approvals.id, id), eq(approvals.state, "pending")))
        .returning();

      if (!approval) {
        return null;
      }

      await tx.insert(auditEvents).values({
        actorUserId,
        entityType: "approval",
        entityId: approval.id,
        action: "approval_edited",
        metadata: {},
      });

      return toApprovalRecord(approval);
    });
  }

  async setState(
    id: string,
    state: Exclude<ApprovalState, "pending" | "executed" | "failed">,
    actorUserId: string,
    metadata: ApprovalStateMetadata = {},
  ) {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [approval] = await tx
        .update(approvals)
        .set({
          state,
          decidedByUserId: actorUserId,
          decidedAt: now,
          updatedAt: now,
        })
        .where(and(eq(approvals.id, id), eq(approvals.state, "pending")))
        .returning();

      if (!approval) {
        return null;
      }

      await tx.insert(auditEvents).values({
        actorUserId,
        entityType: "approval",
        entityId: approval.id,
        action: `approval_${state}`,
        metadata,
      });

      return toApprovalRecord(approval);
    });
  }
}

function approvalFilters(filters: ApprovalFilterQuery) {
  const conditions = [
    filters.state ? eq(approvals.state, filters.state) : undefined,
    filters.risk ? eq(approvals.risk, filters.risk) : undefined,
    filters.kind ? eq(approvals.kind, filters.kind) : undefined,
    filters.jobId ? eq(approvals.jobId, filters.jobId) : undefined,
    filters.requiredRole
      ? eq(approvals.requiredRole, filters.requiredRole)
      : undefined,
  ].filter((condition) => condition !== undefined);

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function toApprovalRecord(row: ApprovalRow): ApprovalRecord {
  return ApprovalRecordSchema.parse({
    id: row.id,
    jobId: row.jobId,
    kind: row.kind,
    state: row.state,
    risk: row.risk,
    requiredRole: row.requiredRole,
    payload: row.payload,
    originalPayload: row.originalPayload,
    evidence: row.evidence,
    createdByUserId: row.createdByUserId,
    decidedByUserId: row.decidedByUserId,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
