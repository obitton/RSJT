import type { AppDb } from "@rsjt/db";
import { jobs } from "@rsjt/db";
import type { JobState } from "@rsjt/shared";
import { desc, inArray } from "drizzle-orm";
import { toJobSummary } from "./job-mappers.js";

const ACTIVE_UPDATE_STATES = ["accepted", "scheduled"] satisfies JobState[];
const UNRESOLVED_UPDATE_STATES = ["unmatched", "intake"] satisfies JobState[];

export class JobsRepository {
  constructor(private readonly db: AppDb) {}

  async listActiveForUpdates() {
    return this.listByStates(ACTIVE_UPDATE_STATES);
  }

  async listUnresolvedForUpdates() {
    return this.listByStates(UNRESOLVED_UPDATE_STATES);
  }

  private async listByStates(states: JobState[]) {
    const rows = await this.db
      .select()
      .from(jobs)
      .where(inArray(jobs.state, states))
      .orderBy(desc(jobs.updatedAt));

    return rows.map(toJobSummary);
  }
}
