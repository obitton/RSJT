import type { AppDb } from "@rsjt/db";
import { jobs } from "@rsjt/db";
import {
  type JobState,
  type JobSummary,
  JobSummarySchema,
  type RepairShoprReference,
  RepairShoprReferenceSchema,
} from "@rsjt/shared";
import { eq } from "drizzle-orm";
import type {
  CancelJobInput,
  CancelableJob,
  JobCancellationStore,
} from "../services/job-cancellation-service.js";

type JobRow = typeof jobs.$inferSelect;

export class JobCancellationRepository implements JobCancellationStore {
  constructor(private readonly db: AppDb) {}

  async getJobForCancellation(jobId: string): Promise<CancelableJob | null> {
    const [row] = await this.db
      .select({ id: jobs.id, state: jobs.state })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    return row ?? null;
  }

  async cancelJob(input: CancelJobInput): Promise<JobSummary> {
    const now = new Date();
    const [row] = await this.db
      .update(jobs)
      .set({
        state: "canceled",
        cancelReason: input.reason,
        canceledAt: now,
        canceledByUserId: input.canceledByUserId,
        updatedAt: now,
      })
      .where(eq(jobs.id, input.jobId))
      .returning();

    if (!row) {
      throw new Error("Failed to cancel job");
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
    ...(row.cancelReason ? { cancelReason: row.cancelReason } : {}),
    ...(row.canceledAt ? { canceledAt: row.canceledAt } : {}),
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
