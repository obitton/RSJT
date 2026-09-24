import type { jobs } from "@rsjt/db";
import {
  type JobState,
  type JobSummary,
  JobSummarySchema,
  type RepairShoprReference,
  RepairShoprReferenceSchema,
} from "@rsjt/shared";

export type JobRow = typeof jobs.$inferSelect;

export function toJobSummary(row: JobRow): JobSummary {
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

export function toRepairShoprReference(
  row: JobRow,
): RepairShoprReference | null {
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
