import type { JobState, JobSummary, SessionUser } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import {
  type CancelJobInput,
  type CancelableJob,
  JobCancellationService,
  type JobCancellationStore,
  JobNotCancelableError,
  JobNotFoundError,
} from "./job-cancellation-service.js";

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};

const jobId = "00000000-0000-4000-8000-0000000b0001";

describe("JobCancellationService", () => {
  it("cancels an active job with the reason and the acting user", async () => {
    const store = new FakeStore({ job: { id: jobId, state: "scheduled" } });

    const job = await new JobCancellationService(store).cancelJob(
      managerUser,
      jobId,
      "Customer changed their mind",
    );

    expect(job.state).toBe("canceled");
    expect(store.cancelInput).toEqual({
      jobId,
      reason: "Customer changed their mind",
      canceledByUserId: managerUser.id,
    });
  });

  it("throws when the job does not exist", async () => {
    const store = new FakeStore({ job: null });

    await expect(
      new JobCancellationService(store).cancelJob(managerUser, jobId, "reason"),
    ).rejects.toBeInstanceOf(JobNotFoundError);
    expect(store.cancelInput).toBeNull();
  });

  it("rejects cancelling a job that is already in a terminal state", async () => {
    const terminalStates: JobState[] = [
      "completed",
      "payout_ready",
      "closed",
      "canceled",
    ];

    for (const state of terminalStates) {
      const store = new FakeStore({ job: { id: jobId, state } });

      await expect(
        new JobCancellationService(store).cancelJob(
          managerUser,
          jobId,
          "reason",
        ),
      ).rejects.toBeInstanceOf(JobNotCancelableError);
      expect(store.cancelInput).toBeNull();
    }
  });
});

class FakeStore implements JobCancellationStore {
  cancelInput: CancelJobInput | null = null;
  private readonly job: CancelableJob | null;

  constructor(input: { job: CancelableJob | null }) {
    this.job = input.job;
  }

  async getJobForCancellation() {
    return this.job;
  }

  async cancelJob(input: CancelJobInput): Promise<JobSummary> {
    this.cancelInput = input;
    return {
      id: input.jobId,
      state: "canceled",
      cancelReason: input.reason,
    } satisfies JobSummary;
  }
}
