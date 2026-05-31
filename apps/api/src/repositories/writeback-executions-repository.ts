import type { AppDb } from "@rsjt/db";
import { auditEvents, writebackExecutions } from "@rsjt/db";
import {
  type ApprovalKind,
  type WritebackAction,
  type WritebackApprovalPayload,
  type WritebackExecution,
  type WritebackExecutionListQuery,
  WritebackExecutionSchema,
  type WritebackExecutionState,
  type WritebackTargetKind,
} from "@rsjt/shared";
import { and, desc, eq, sql } from "drizzle-orm";

type WritebackExecutionRow = typeof writebackExecutions.$inferSelect;

export type CreateWritebackExecutionInput = {
  approvalId: string;
  jobId: string | null;
  kind: ApprovalKind;
  targetKind: WritebackTargetKind;
  action: WritebackAction;
  requestPayload: WritebackApprovalPayload;
};

export type MarkWritebackAttemptStartedInput = {
  executionId: string;
  actorUserId: string;
};

export type MarkWritebackSucceededInput = {
  executionId: string;
  actorUserId: string;
  responsePayload: Record<string, unknown>;
  repairShoprEntityType: WritebackExecution["repairShoprEntityType"];
  repairShoprId: string | null;
};

export type MarkWritebackFailedInput = {
  executionId: string;
  actorUserId: string;
  errorMessage: string;
  responsePayload?: Record<string, unknown> | null;
};

export class WritebackExecutionsRepository {
  constructor(private readonly db: AppDb) {}

  async ensureReadyForApproval(input: CreateWritebackExecutionInput) {
    return this.db.transaction(async (tx) => {
      const existing = await this.getByApprovalId(input.approvalId);
      if (existing) {
        return existing;
      }

      const [row] = await tx
        .insert(writebackExecutions)
        .values({
          approvalId: input.approvalId,
          jobId: input.jobId,
          kind: input.kind,
          state: "ready",
          targetKind: input.targetKind,
          action: input.action,
          requestPayload: input.requestPayload,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to create writeback execution");
      }

      await tx.insert(auditEvents).values({
        entityType: "writeback_execution",
        entityId: row.id,
        action: "writeback_ready",
        metadata: {
          approvalId: input.approvalId,
          kind: input.kind,
          action: input.action,
        },
      });

      return toWritebackExecution(row);
    });
  }

  async list(filters: WritebackExecutionListQuery = {}) {
    const conditions = [
      filters.state ? eq(writebackExecutions.state, filters.state) : undefined,
      filters.approvalId
        ? eq(writebackExecutions.approvalId, filters.approvalId)
        : undefined,
      filters.jobId ? eq(writebackExecutions.jobId, filters.jobId) : undefined,
    ].filter((condition) => condition !== undefined);

    const query = this.db
      .select()
      .from(writebackExecutions)
      .orderBy(desc(writebackExecutions.updatedAt));
    const rows =
      conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

    return rows.map(toWritebackExecution);
  }

  async getById(executionId: string) {
    const [row] = await this.db
      .select()
      .from(writebackExecutions)
      .where(eq(writebackExecutions.id, executionId))
      .limit(1);

    return row ? toWritebackExecution(row) : null;
  }

  async getByApprovalId(approvalId: string) {
    const [row] = await this.db
      .select()
      .from(writebackExecutions)
      .where(eq(writebackExecutions.approvalId, approvalId))
      .limit(1);

    return row ? toWritebackExecution(row) : null;
  }

  async markAttemptStarted(input: MarkWritebackAttemptStartedInput) {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .update(writebackExecutions)
        .set({
          state: "ready",
          lastAttemptedAt: now,
          executedByUserId: input.actorUserId,
          errorMessage: null,
          responsePayload: null,
          attemptCount: sql`${writebackExecutions.attemptCount} + 1`,
          updatedAt: now,
        })
        .where(eq(writebackExecutions.id, input.executionId))
        .returning();

      if (!row) {
        return null;
      }

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        entityType: "writeback_execution",
        entityId: row.id,
        action: "writeback_attempt_started",
        metadata: { attemptCount: row.attemptCount },
      });

      return toWritebackExecution(row);
    });
  }

  async markSucceeded(input: MarkWritebackSucceededInput) {
    return this.setTerminalState({
      executionId: input.executionId,
      actorUserId: input.actorUserId,
      state: "succeeded",
      responsePayload: input.responsePayload,
      errorMessage: null,
      repairShoprEntityType: input.repairShoprEntityType,
      repairShoprId: input.repairShoprId,
      action: "writeback_succeeded",
    });
  }

  async markFailed(input: MarkWritebackFailedInput) {
    return this.setTerminalState({
      executionId: input.executionId,
      actorUserId: input.actorUserId,
      state: "failed",
      responsePayload: input.responsePayload ?? null,
      errorMessage: input.errorMessage,
      repairShoprEntityType: null,
      repairShoprId: null,
      action: "writeback_failed",
    });
  }

  async markBlocked(input: MarkWritebackFailedInput) {
    return this.setTerminalState({
      executionId: input.executionId,
      actorUserId: input.actorUserId,
      state: "blocked",
      responsePayload: input.responsePayload ?? null,
      errorMessage: input.errorMessage,
      repairShoprEntityType: null,
      repairShoprId: null,
      action: "writeback_blocked",
    });
  }

  private async setTerminalState(input: {
    executionId: string;
    actorUserId: string;
    state: Extract<WritebackExecutionState, "succeeded" | "failed" | "blocked">;
    responsePayload: Record<string, unknown> | null;
    errorMessage: string | null;
    repairShoprEntityType: WritebackExecution["repairShoprEntityType"];
    repairShoprId: string | null;
    action: string;
  }) {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .update(writebackExecutions)
        .set({
          state: input.state,
          responsePayload: input.responsePayload,
          errorMessage: input.errorMessage,
          repairShoprEntityType: input.repairShoprEntityType,
          repairShoprId: input.repairShoprId,
          executedByUserId: input.actorUserId,
          succeededAt: input.state === "succeeded" ? now : null,
          updatedAt: now,
        })
        .where(eq(writebackExecutions.id, input.executionId))
        .returning();

      if (!row) {
        return null;
      }

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        entityType: "writeback_execution",
        entityId: row.id,
        action: input.action,
        metadata: {
          errorMessage: input.errorMessage,
          repairShoprEntityType: input.repairShoprEntityType,
          repairShoprId: input.repairShoprId,
        },
      });

      return toWritebackExecution(row);
    });
  }
}

function toWritebackExecution(row: WritebackExecutionRow): WritebackExecution {
  return WritebackExecutionSchema.parse({
    id: row.id,
    approvalId: row.approvalId,
    jobId: row.jobId,
    kind: row.kind,
    state: row.state,
    targetKind: row.targetKind,
    action: row.action,
    requestPayload: row.requestPayload,
    responsePayload: row.responsePayload,
    errorMessage: row.errorMessage,
    repairShoprEntityType: row.repairShoprEntityType,
    repairShoprId: row.repairShoprId,
    attemptCount: row.attemptCount,
    lastAttemptedAt: row.lastAttemptedAt,
    executedByUserId: row.executedByUserId,
    succeededAt: row.succeededAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
