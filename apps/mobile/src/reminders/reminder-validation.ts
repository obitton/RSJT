import { isRecord } from "@/auth/session-validation";
import type {
  JobState,
  ReminderGenerationResponse,
  ReminderListResponse,
  ReminderReason,
  ReminderSummary,
  ResolveReminderResponse,
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

const REMINDER_REASONS = [
  "missing_completion",
  "missing_split_category",
  "missing_charge_or_profit",
  "missing_expense_detail",
  "missing_follow_up",
  "follow_up_needed",
] as const satisfies readonly ReminderReason[];

export function toReminderListResponse(
  value: unknown,
): ReminderListResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const reminders = toReminderArray(value.reminders);
  return reminders ? { reminders } : null;
}

export function toReminderGenerationResponse(
  value: unknown,
): ReminderGenerationResponse | null {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.createdCount) ||
    !isNonNegativeInteger(value.resolvedCount)
  ) {
    return null;
  }

  const reminders = toReminderArray(value.reminders);
  if (!reminders) {
    return null;
  }

  return {
    createdCount: value.createdCount,
    resolvedCount: value.resolvedCount,
    reminders,
  };
}

export function toResolveReminderResponse(
  value: unknown,
): ResolveReminderResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const reminder = toReminder(value.reminder);
  return reminder ? { reminder } : null;
}

function toReminderArray(value: unknown): ReminderSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const reminders = value.map(toReminder);
  return reminders.every((reminder) => reminder !== null) ? reminders : null;
}

function toReminder(value: unknown): ReminderSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.jobId !== "string" ||
    !isJobState(value.jobState) ||
    !isReminderReason(value.reason) ||
    typeof value.stale !== "boolean"
  ) {
    return null;
  }

  const customerLabel = toNullableString(value.customerLabel);
  const createdAt = toDate(value.createdAt);
  const resolvedAt = toNullableDate(value.resolvedAt);

  if (customerLabel === undefined || !createdAt || resolvedAt === undefined) {
    return null;
  }

  return {
    id: value.id,
    jobId: value.jobId,
    jobState: value.jobState,
    customerLabel,
    reason: value.reason,
    createdAt,
    resolvedAt,
    stale: value.stale,
  };
}

function isJobState(value: unknown): value is JobState {
  return typeof value === "string" && JOB_STATES.includes(value as JobState);
}

function isReminderReason(value: unknown): value is ReminderReason {
  return (
    typeof value === "string" &&
    REMINDER_REASONS.includes(value as ReminderReason)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function toNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNullableDate(value: unknown): Date | null | undefined {
  if (value === null) {
    return null;
  }
  return toDate(value) ?? undefined;
}
