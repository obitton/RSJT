import type { AppDb } from "@rsjt/db";
import { jobs } from "@rsjt/db";
import {
  type JobState,
  type JobSummary,
  JobSummarySchema,
  type RepairShoprReference,
  RepairShoprReferenceSchema,
} from "@rsjt/shared";
import { desc, inArray } from "drizzle-orm";

type JobRow = typeof jobs.$inferSelect;

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

function toJobSummary(row: JobRow): JobSummary {
  const repairShoprReference = toRepairShoprReference(row);

  return JobSummarySchema.parse({
    id: row.id,
    state: row.state,
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
