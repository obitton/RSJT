import {
  type JobSummary,
  type JobUpdateFeedResponse,
  JobUpdateFeedResponseSchema,
} from "@rsjt/shared";

export interface JobUpdateFeedStore {
  listActiveForUpdates(): Promise<JobSummary[]>;
  listUnresolvedForUpdates(): Promise<JobSummary[]>;
}

export interface JobUpdateFeedServiceApi {
  listUpdateFeed(): Promise<JobUpdateFeedResponse>;
}

export class JobUpdateFeedService implements JobUpdateFeedServiceApi {
  constructor(private readonly jobs: JobUpdateFeedStore) {}

  async listUpdateFeed() {
    const [activeJobs, unresolvedJobs] = await Promise.all([
      this.jobs.listActiveForUpdates(),
      this.jobs.listUnresolvedForUpdates(),
    ]);

    return JobUpdateFeedResponseSchema.parse({
      activeJobs,
      unresolvedJobs,
    });
  }
}
