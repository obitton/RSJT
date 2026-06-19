import type {
  JobOrigin,
  JobState,
  ManagerDashboardJob,
  MatchConfidenceBand,
  PendingApprovalSummary,
} from "@rsjt/shared";

// The bottom browser sections. "leads" lists conversations not yet converted;
// the rest are job groups.
export type DashboardSectionKey =
  | "leads"
  | "jobs"
  | "payout"
  | "completed"
  | "canceled";

export const DASHBOARD_SECTION_ORDER = [
  "leads",
  "jobs",
  "payout",
  "completed",
  "canceled",
] as const satisfies readonly DashboardSectionKey[];

export function formatSectionLabel(key: DashboardSectionKey) {
  switch (key) {
    case "leads":
      return "Leads";
    case "jobs":
      return "Jobs";
    case "payout":
      return "Payout";
    case "completed":
      return "Completed";
    case "canceled":
      return "Canceled";
  }
}

export function formatSectionEmptyCopy(key: DashboardSectionKey) {
  switch (key) {
    case "leads":
      return "No leads yet.";
    case "jobs":
      return "No active jobs.";
    case "payout":
      return "No payouts ready.";
    case "completed":
      return "No completed jobs.";
    case "canceled":
      return "No canceled jobs.";
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
    case "canceled":
      return "Canceled";
  }
}

export function formatJobOriginLabel(origin: JobOrigin) {
  switch (origin) {
    case "lead":
      return "Lead-based";
    case "manual":
      return "Manual";
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
