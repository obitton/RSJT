import type {
  JobState,
  ManagerDashboardJob,
  MatchConfidenceBand,
  PendingApprovalSummary,
} from "@rsjt/shared";

export type DashboardGroupKey =
  | "openJobs"
  | "scheduledJobs"
  | "completedJobs"
  | "unmatchedJobs"
  | "payoutReadyJobs";

export const DASHBOARD_GROUP_ORDER = [
  "openJobs",
  "scheduledJobs",
  "completedJobs",
  "unmatchedJobs",
  "payoutReadyJobs",
] as const satisfies readonly DashboardGroupKey[];

export function formatGroupLabel(key: DashboardGroupKey) {
  switch (key) {
    case "openJobs":
      return "Open";
    case "scheduledJobs":
      return "Scheduled";
    case "completedJobs":
      return "Completed";
    case "unmatchedJobs":
      return "Unmatched";
    case "payoutReadyJobs":
      return "Payout";
  }
}

export function formatGroupEmptyCopy(key: DashboardGroupKey) {
  switch (key) {
    case "openJobs":
      return "No open jobs.";
    case "scheduledJobs":
      return "No scheduled jobs.";
    case "completedJobs":
      return "No completed jobs.";
    case "unmatchedJobs":
      return "No unmatched updates.";
    case "payoutReadyJobs":
      return "No payouts ready.";
  }
}

export function formatJobStateLabel(state: JobState) {
  switch (state) {
    case "unmatched":
      return "Unmatched";
    case "intake":
      return "Intake";
    case "accepted":
      return "Accepted";
    case "scheduled":
      return "Scheduled";
    case "completed":
      return "Completed";
    case "payout_ready":
      return "Payout ready";
    case "closed":
      return "Closed";
  }
}

export function formatMoneyCents(amountCents: number) {
  return `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
}

export function formatJobChargeLabel(job: ManagerDashboardJob) {
  if (job.reportedProfitCents !== undefined) {
    return `${formatMoneyCents(job.reportedProfitCents)} reported profit`;
  }
  if (job.calculatedProfitCents !== undefined) {
    return `${formatMoneyCents(job.calculatedProfitCents)} calculated profit`;
  }
  if (job.grossChargeCents !== undefined) {
    return formatMoneyCents(job.grossChargeCents);
  }
  return "No charge yet";
}

export function formatPendingApprovalLabel(count: number) {
  if (count === 0) {
    return "No pending approvals";
  }
  if (count === 1) {
    return "1 pending approval";
  }
  return `${count} pending approvals`;
}

export function formatConfidenceBandLabel(band: MatchConfidenceBand) {
  switch (band) {
    case "low":
      return "Low";
    case "medium_high":
      return "Medium high";
    case "high":
      return "High";
  }
}

export function formatApprovalRiskLabel(risk: PendingApprovalSummary["risk"]) {
  switch (risk) {
    case "customer_identity":
      return "Customer identity";
    case "money":
      return "Money";
    case "scheduling":
      return "Scheduling";
    case "crm_writeback":
      return "CRM writeback";
    case "low":
      return "Low";
  }
}

export function formatApprovalKindLabel(kind: PendingApprovalSummary["kind"]) {
  switch (kind) {
    case "repairshopr_writeback":
      return "RepairShopr writeback";
    case "customer_message":
      return "Customer message";
    case "appointment_creation":
      return "Appointment";
    case "manager_override":
      return "Manager override";
    case "payout_finalization":
      return "Payout finalization";
  }
}
