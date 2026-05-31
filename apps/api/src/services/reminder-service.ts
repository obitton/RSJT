import type {
  ReminderGenerationResponse,
  ReminderListResponse,
  ReminderReason,
  ReminderSummary,
  ResolveReminderResponse,
} from "@rsjt/shared";
import {
  ReminderGenerationResponseSchema,
  ReminderListResponseSchema,
  ReminderReasonSchema,
  ReminderSummarySchema,
  ResolveReminderResponseSchema,
} from "@rsjt/shared";
import type {
  ReminderCandidateRecord,
  ReminderRecord,
  ReminderSyncResult,
} from "../repositories/reminders-repository.js";

export const REMINDER_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface ReminderStore {
  listCloseoutCandidates(): Promise<ReminderCandidateRecord[]>;
  syncRemindersForJob(
    jobId: string,
    reasons: readonly ReminderReason[],
    now: Date,
  ): Promise<ReminderSyncResult>;
  listOpenReminders(now: Date, staleAfterMs: number): Promise<ReminderRecord[]>;
  listStaleReminders(
    now: Date,
    staleAfterMs: number,
  ): Promise<ReminderRecord[]>;
  resolveReminder(
    reminderId: string,
    now: Date,
    staleAfterMs: number,
  ): Promise<ReminderRecord | null>;
}

export interface ReminderServiceApi {
  generateReminders(now?: Date): Promise<ReminderGenerationResponse>;
  listReminders(now?: Date): Promise<ReminderListResponse>;
  listStaleReminders(now?: Date): Promise<ReminderListResponse>;
  resolveReminder(
    reminderId: string,
    now?: Date,
  ): Promise<ResolveReminderResponse>;
}

export class ReminderNotFoundError extends Error {
  constructor() {
    super("Reminder not found");
  }
}

export class ReminderService implements ReminderServiceApi {
  constructor(private readonly store: ReminderStore) {}

  async generateReminders(now = new Date()) {
    const candidates = await this.store.listCloseoutCandidates();
    let createdCount = 0;
    let resolvedCount = 0;

    for (const candidate of candidates) {
      const result = await this.store.syncRemindersForJob(
        candidate.job.id,
        deriveReminderReasons(candidate),
        now,
      );
      createdCount += result.createdCount;
      resolvedCount += result.resolvedCount;
    }

    const reminders = await this.store.listOpenReminders(
      now,
      REMINDER_STALE_AFTER_MS,
    );

    return ReminderGenerationResponseSchema.parse({
      createdCount,
      resolvedCount,
      reminders: reminders.map(toReminderSummary),
    });
  }

  async listReminders(now = new Date()) {
    const reminders = await this.store.listOpenReminders(
      now,
      REMINDER_STALE_AFTER_MS,
    );

    return ReminderListResponseSchema.parse({
      reminders: reminders.map(toReminderSummary),
    });
  }

  async listStaleReminders(now = new Date()) {
    const reminders = await this.store.listStaleReminders(
      now,
      REMINDER_STALE_AFTER_MS,
    );

    return ReminderListResponseSchema.parse({
      reminders: reminders.map(toReminderSummary),
    });
  }

  async resolveReminder(reminderId: string, now = new Date()) {
    const reminder = await this.store.resolveReminder(
      reminderId,
      now,
      REMINDER_STALE_AFTER_MS,
    );

    if (!reminder) {
      throw new ReminderNotFoundError();
    }

    return ResolveReminderResponseSchema.parse({
      reminder: toReminderSummary(reminder),
    });
  }
}

function deriveReminderReasons(
  candidate: ReminderCandidateRecord,
): ReminderReason[] {
  const reasons: ReminderReason[] = [];
  const { job } = candidate;

  if (!isCompleted(job.state, job.completedAt)) {
    reasons.push("missing_completion");
  }

  if (job.splitCategory === null) {
    reasons.push("missing_split_category");
  }

  if (job.reportedProfitCents === null && job.grossChargeCents === null) {
    reasons.push("missing_charge_or_profit");
  }

  if (
    job.grossChargeCents !== null &&
    job.reportedProfitCents === null &&
    candidate.expenseCount === 0
  ) {
    reasons.push("missing_expense_detail");
  }

  if (!candidate.hasFollowUpStatus) {
    reasons.push("missing_follow_up");
  } else if (candidate.followUpNeeded) {
    reasons.push("follow_up_needed");
  }

  return reasons;
}

function toReminderSummary(record: ReminderRecord): ReminderSummary {
  return ReminderSummarySchema.parse({
    ...record,
    reason: ReminderReasonSchema.parse(record.reason),
  });
}

function isCompleted(
  state: ReminderCandidateRecord["job"]["state"],
  completedAt: Date | null,
) {
  return (
    completedAt !== null ||
    state === "completed" ||
    state === "payout_ready" ||
    state === "closed"
  );
}
