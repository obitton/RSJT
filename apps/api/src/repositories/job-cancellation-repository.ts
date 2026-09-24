import type { AppDb } from "@rsjt/db";
import { jobs } from "@rsjt/db";
import type { JobSummary } from "@rsjt/shared";
import { eq } from "drizzle-orm";
import type {
  CancelJobInput,
  CancelableJob,
  JobCancellationStore,
} from "../services/job-cancellation-service.js";
import { toJobSummary } from "./job-mappers.js";

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
