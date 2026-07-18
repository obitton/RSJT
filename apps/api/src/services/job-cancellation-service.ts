import type { JobState, JobSummary, SessionUser } from "@rsjt/shared";
import { isCancelableJobState } from "@rsjt/shared";

// The minimal job facts the service needs to decide whether a cancel is
// allowed.
export type CancelableJob = {
  id: string;
  state: JobState;
};

export type CancelJobInput = {
  jobId: string;
  reason: string;
  canceledByUserId: string;
};

export interface JobCancellationStore {
  getJobForCancellation(jobId: string): Promise<CancelableJob | null>;
  cancelJob(input: CancelJobInput): Promise<JobSummary>;
}

export interface JobCancellationServiceApi {
  cancelJob(
    user: SessionUser,
    jobId: string,
    reason: string,
  ): Promise<JobSummary>;
}

export class JobNotFoundError extends Error {
  constructor() {
    super("Job not found");
  }
}

export class JobNotCancelableError extends Error {
  constructor() {
    super("This job can no longer be canceled");
  }
}

export class JobCancellationService implements JobCancellationServiceApi {
  constructor(private readonly store: JobCancellationStore) {}

  async cancelJob(user: SessionUser, jobId: string, reason: string) {
    const job = await this.store.getJobForCancellation(jobId);
    if (!job) {
      throw new JobNotFoundError();
    }

    // Only an active job can be canceled. A completed, payout-ready, closed, or
    // already-canceled job is terminal and cannot be canceled again.
    if (!isCancelableJobState(job.state)) {
      throw new JobNotCancelableError();
    }

    return this.store.cancelJob({
      jobId,
      reason,
      canceledByUserId: user.id,
    });
  }
}
