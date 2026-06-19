import { isRecord } from "@/auth/session-validation";
import type {
  CustomerIntakeState,
  JobOrigin,
  JobState,
  LeadDetail,
  LeadSummary,
  ManagerDashboardGroups,
  ManagerDashboardJob,
  ManagerDashboardResponse,
  ManagerDashboardSummary,
  ManagerJobDetailResponse,
  ManagerLeadDetailResponse,
  MatchConfidenceBand,
  PendingApprovalSummary,
  ProfitBasis,
  RepairShoprEntityType,
  RepairShoprReference,
  SelectedMatchSummary,
  SplitCategory,
  TakeoverConversationSummary,
  UserRole,
} from "@rsjt/shared";

const JOB_STATES = [
  "unmatched",
  "intake",
  "accepted",
  "scheduled",
  "completed",
  "payout_ready",
  "closed",
] as const satisfies readonly JobState[];

const JOB_ORIGINS = ["lead", "manual"] as const satisfies readonly JobOrigin[];

const SPLIT_CATEGORIES = [
  "returning_repairshopr_customer",
  "new_lead",
  "customer_service_heavy",
] as const satisfies readonly SplitCategory[];

const PROFIT_BASES = [
  "reported_profit",
  "charge_minus_reported_expenses",
] as const satisfies readonly ProfitBasis[];

const REPAIRSHOPR_ENTITY_TYPES = [
  "customer",
  "contact",
  "lead",
  "ticket",
  "appointment",
  "invoice",
  "payment",
  "ticket_comment",
] as const satisfies readonly RepairShoprEntityType[];

const MATCH_CONFIDENCE_BANDS = [
  "low",
  "medium_high",
  "high",
] as const satisfies readonly MatchConfidenceBand[];

const APPROVAL_KINDS = [
  "repairshopr_writeback",
  "customer_message",
  "appointment_creation",
  "manager_override",
  "payout_finalization",
] as const;

const APPROVAL_RISKS = [
  "customer_identity",
  "money",
  "scheduling",
  "crm_writeback",
  "low",
] as const;

const USER_ROLES = ["manager", "tech"] as const satisfies readonly UserRole[];

const INTAKE_STATES = [
  "unknown",
  "identifying",
  "collecting",
  "matched",
  "review_ready",
  "blocked",
] as const satisfies readonly CustomerIntakeState[];

export function toManagerDashboardResponse(
  value: unknown,
): ManagerDashboardResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const summary = toSummary(value.summary);
  const groups = toGroups(value.groups);
  const leads = toLeadArray(value.leads);
  const takeoverConversations = toTakeoverArray(value.takeoverConversations);

  if (!summary || !groups || !leads || !takeoverConversations) {
    return null;
  }

  return {
    summary,
    groups,
    leads,
    takeoverConversations,
  };
}

export function toManagerLeadDetailResponse(
  value: unknown,
): ManagerLeadDetailResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const lead = toLeadDetail(value.lead);
  if (!lead) {
    return null;
  }

  return { lead };
}

export function toManagerJobDetailResponse(
  value: unknown,
): ManagerJobDetailResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const job = toDashboardJob(value.job);
  const pendingApprovals = toPendingApprovalArray(value.pendingApprovals);

  if (!job || !pendingApprovals) {
    return null;
  }

  const selectedMatch =
    value.selectedMatch === undefined
      ? undefined
      : toSelectedMatch(value.selectedMatch);

  if (selectedMatch === null) {
    return null;
  }

  return {
    job,
    pendingApprovals,
    ...(selectedMatch ? { selectedMatch } : {}),
  };
}

function toSummary(value: unknown): ManagerDashboardSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const fields = [
    "leadsCount",
    "needsTechAnswerCount",
    "workingOnCount",
    "jobsCount",
    "repairCount",
    "openCount",
    "scheduledCount",
    "completedCount",
    "unmatchedCount",
    "takeoverCount",
    "payoutReadyCount",
  ] as const;

  const summary: Partial<Record<(typeof fields)[number], number>> = {};
  for (const field of fields) {
    const candidate = value[field];
    if (
      typeof candidate !== "number" ||
      !Number.isInteger(candidate) ||
      candidate < 0
    ) {
      return null;
    }
    summary[field] = candidate;
  }

  return summary as ManagerDashboardSummary;
}

function toGroups(value: unknown): ManagerDashboardGroups | null {
  if (!isRecord(value)) {
    return null;
  }

  const openJobs = toDashboardJobArray(value.openJobs);
  const scheduledJobs = toDashboardJobArray(value.scheduledJobs);
  const completedJobs = toDashboardJobArray(value.completedJobs);
  const unmatchedJobs = toDashboardJobArray(value.unmatchedJobs);
  const payoutReadyJobs = toDashboardJobArray(value.payoutReadyJobs);

  if (
    !openJobs ||
    !scheduledJobs ||
    !completedJobs ||
    !unmatchedJobs ||
    !payoutReadyJobs
  ) {
    return null;
  }

  return {
    openJobs,
    scheduledJobs,
    completedJobs,
    unmatchedJobs,
    payoutReadyJobs,
  };
}

function toDashboardJobArray(value: unknown): ManagerDashboardJob[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const jobs = value.map(toDashboardJob);
  return jobs.every((job) => job !== null) ? jobs : null;
}

function toDashboardJob(value: unknown): ManagerDashboardJob | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isJobState(value.state) ||
    !isJobOrigin(value.origin) ||
    typeof value.pendingApprovalCount !== "number" ||
    !Number.isInteger(value.pendingApprovalCount) ||
    value.pendingApprovalCount < 0
  ) {
    return null;
  }

  const updatedAt = toDate(value.updatedAt);
  if (!updatedAt) {
    return null;
  }

  const conversationId = toOptionalNonEmptyString(value.conversationId);
  if (conversationId === null) {
    return null;
  }

  const originNote = toOptionalNonEmptyString(value.originNote);
  if (originNote === null) {
    return null;
  }

  const customerLabel = toOptionalNonEmptyString(value.customerLabel);
  if (customerLabel === null) {
    return null;
  }

  const repairShoprReference =
    value.repairShoprReference === undefined
      ? undefined
      : toRepairShoprReference(value.repairShoprReference);
  if (repairShoprReference === null) {
    return null;
  }

  const splitCategory = toOptionalSplitCategory(value.splitCategory);
  if (splitCategory === null) {
    return null;
  }

  const grossChargeCents = toOptionalCents(value.grossChargeCents);
  if (grossChargeCents === null) {
    return null;
  }

  const reportedProfitCents = toOptionalCents(value.reportedProfitCents);
  if (reportedProfitCents === null) {
    return null;
  }

  const calculatedProfitCents = toOptionalCents(value.calculatedProfitCents);
  if (calculatedProfitCents === null) {
    return null;
  }

  const profitBasis = toOptionalProfitBasis(value.profitBasis);
  if (profitBasis === null) {
    return null;
  }

  const selectedMatchConfidenceBand = toOptionalConfidenceBand(
    value.selectedMatchConfidenceBand,
  );
  if (selectedMatchConfidenceBand === null) {
    return null;
  }

  return {
    id: value.id,
    state: value.state,
    origin: value.origin,
    updatedAt,
    pendingApprovalCount: value.pendingApprovalCount,
    ...(conversationId ? { conversationId } : {}),
    ...(originNote ? { originNote } : {}),
    ...(customerLabel ? { customerLabel } : {}),
    ...(repairShoprReference ? { repairShoprReference } : {}),
    ...(splitCategory ? { splitCategory } : {}),
    ...(grossChargeCents !== undefined ? { grossChargeCents } : {}),
    ...(reportedProfitCents !== undefined ? { reportedProfitCents } : {}),
    ...(calculatedProfitCents !== undefined ? { calculatedProfitCents } : {}),
    ...(profitBasis ? { profitBasis } : {}),
    ...(selectedMatchConfidenceBand ? { selectedMatchConfidenceBand } : {}),
  };
}

function toTakeoverArray(value: unknown): TakeoverConversationSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.map(toTakeover);
  return items.every((item) => item !== null) ? items : null;
}

function toTakeover(value: unknown): TakeoverConversationSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.takeoverActive !== "boolean"
  ) {
    return null;
  }

  const updatedAt = toDate(value.updatedAt);
  if (!updatedAt) {
    return null;
  }

  const externalPhone =
    value.externalPhone === null
      ? null
      : typeof value.externalPhone === "string" &&
          value.externalPhone.length > 0
        ? value.externalPhone
        : undefined;
  if (externalPhone === undefined) {
    return null;
  }

  const takeoverStartedAt =
    value.takeoverStartedAt === null
      ? null
      : value.takeoverStartedAt === undefined
        ? null
        : toDate(value.takeoverStartedAt);
  if (takeoverStartedAt === undefined) {
    return null;
  }

  return {
    id: value.id,
    externalPhone,
    takeoverActive: value.takeoverActive,
    takeoverStartedAt,
    updatedAt,
  };
}

function toLeadArray(value: unknown): LeadSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.map(toLead);
  return items.every((item) => item !== null) ? items : null;
}

function toLead(value: unknown): LeadSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    value.label.length === 0 ||
    typeof value.takeoverActive !== "boolean" ||
    !isIntakeState(value.intakeState)
  ) {
    return null;
  }

  const updatedAt = toDate(value.updatedAt);
  if (!updatedAt) {
    return null;
  }

  const externalPhone = toNullableNonEmptyString(value.externalPhone);
  if (externalPhone === undefined) {
    return null;
  }

  const lastInboundPreview = toNullableNonEmptyString(value.lastInboundPreview);
  if (lastInboundPreview === undefined) {
    return null;
  }

  return {
    id: value.id,
    label: value.label,
    externalPhone,
    intakeState: value.intakeState,
    takeoverActive: value.takeoverActive,
    lastInboundPreview,
    updatedAt,
  };
}

function toLeadDetail(value: unknown): LeadDetail | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    value.label.length === 0 ||
    typeof value.takeoverActive !== "boolean" ||
    !isIntakeState(value.intakeState)
  ) {
    return null;
  }

  const updatedAt = toDate(value.updatedAt);
  if (!updatedAt) {
    return null;
  }

  const externalPhone = toNullableNonEmptyString(value.externalPhone);
  const customerName = toNullableNonEmptyString(value.customerName);
  const customerEmail = toNullableNonEmptyString(value.customerEmail);
  const serviceAddress = toNullableNonEmptyString(value.serviceAddress);
  const problemDescription = toNullableNonEmptyString(value.problemDescription);
  const preferredTiming = toNullableNonEmptyString(value.preferredTiming);
  if (
    externalPhone === undefined ||
    customerName === undefined ||
    customerEmail === undefined ||
    serviceAddress === undefined ||
    problemDescription === undefined ||
    preferredTiming === undefined
  ) {
    return null;
  }

  const lastInboundAt = toNullableDate(value.lastInboundAt);
  if (lastInboundAt === undefined) {
    return null;
  }

  let matchedReference: RepairShoprReference | null;
  if (value.matchedReference === null) {
    matchedReference = null;
  } else {
    const reference = toRepairShoprReference(value.matchedReference);
    if (!reference) {
      return null;
    }
    matchedReference = reference;
  }

  return {
    id: value.id,
    label: value.label,
    externalPhone,
    intakeState: value.intakeState,
    takeoverActive: value.takeoverActive,
    customerName,
    customerEmail,
    serviceAddress,
    problemDescription,
    preferredTiming,
    matchedReference,
    lastInboundAt,
    updatedAt,
  };
}

function toPendingApprovalArray(
  value: unknown,
): PendingApprovalSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.map(toPendingApproval);
  return items.every((item) => item !== null) ? items : null;
}

function toPendingApproval(value: unknown): PendingApprovalSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isApprovalKind(value.kind) ||
    !isApprovalRisk(value.risk) ||
    !isUserRole(value.requiredRole)
  ) {
    return null;
  }

  const updatedAt = toDate(value.updatedAt);
  if (!updatedAt) {
    return null;
  }

  return {
    id: value.id,
    kind: value.kind,
    risk: value.risk,
    requiredRole: value.requiredRole,
    updatedAt,
  };
}

function toSelectedMatch(value: unknown): SelectedMatchSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.confidence !== "number" ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    !isConfidenceBand(value.confidenceBand)
  ) {
    return null;
  }

  const repairShoprReference = toRepairShoprReference(
    value.repairShoprReference,
  );
  if (!repairShoprReference) {
    return null;
  }

  return {
    id: value.id,
    confidence: value.confidence,
    confidenceBand: value.confidenceBand,
    repairShoprReference,
  };
}

function toRepairShoprReference(value: unknown): RepairShoprReference | null {
  if (
    !isRecord(value) ||
    !isRepairShoprEntityType(value.entityType) ||
    typeof value.repairShoprId !== "string" ||
    typeof value.displayLabel !== "string"
  ) {
    return null;
  }

  if (value.url !== undefined && typeof value.url !== "string") {
    return null;
  }

  return {
    entityType: value.entityType,
    repairShoprId: value.repairShoprId,
    displayLabel: value.displayLabel,
    ...(value.url ? { url: value.url } : {}),
  };
}

function toNullableNonEmptyString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}

function toNullableDate(value: unknown): Date | null | undefined {
  if (value === null) {
    return null;
  }
  return toDate(value) ?? undefined;
}

function toOptionalNonEmptyString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return value;
}

function toOptionalCents(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function toOptionalSplitCategory(
  value: unknown,
): SplitCategory | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return isSplitCategory(value) ? value : null;
}

function toOptionalProfitBasis(value: unknown): ProfitBasis | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return isProfitBasis(value) ? value : null;
}

function toOptionalConfidenceBand(
  value: unknown,
): MatchConfidenceBand | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return isConfidenceBand(value) ? value : null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function isJobState(value: unknown): value is JobState {
  return JOB_STATES.some((state) => state === value);
}

function isJobOrigin(value: unknown): value is JobOrigin {
  return JOB_ORIGINS.some((origin) => origin === value);
}

function isSplitCategory(value: unknown): value is SplitCategory {
  return SPLIT_CATEGORIES.some((category) => category === value);
}

function isProfitBasis(value: unknown): value is ProfitBasis {
  return PROFIT_BASES.some((basis) => basis === value);
}

function isRepairShoprEntityType(
  value: unknown,
): value is RepairShoprEntityType {
  return REPAIRSHOPR_ENTITY_TYPES.some((entityType) => entityType === value);
}

function isConfidenceBand(value: unknown): value is MatchConfidenceBand {
  return MATCH_CONFIDENCE_BANDS.some((band) => band === value);
}

function isApprovalKind(
  value: unknown,
): value is PendingApprovalSummary["kind"] {
  return APPROVAL_KINDS.some((kind) => kind === value);
}

function isApprovalRisk(
  value: unknown,
): value is PendingApprovalSummary["risk"] {
  return APPROVAL_RISKS.some((risk) => risk === value);
}

function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}

function isIntakeState(value: unknown): value is CustomerIntakeState {
  return INTAKE_STATES.some((state) => state === value);
}
