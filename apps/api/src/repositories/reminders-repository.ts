import type { AppDb } from "@rsjt/db";
import { expenses, extractedFacts, jobs, reminders } from "@rsjt/db";
import type { JobState, ReminderReason } from "@rsjt/shared";
import { type SQL, and, desc, eq, inArray, isNull } from "drizzle-orm";

const CLOSEOUT_CANDIDATE_STATES = [
  "accepted",
  "scheduled",
  "completed",
] as const satisfies readonly JobState[];

type JobRow = typeof jobs.$inferSelect;
type ReminderRow = typeof reminders.$inferSelect;

export type ReminderCandidateRecord = {
  job: JobRow;
  expenseCount: number;
  hasFollowUpStatus: boolean;
  followUpNeeded: boolean;
};

export type ReminderRecord = {
  id: string;
  jobId: string;
  jobState: JobState;
  customerLabel: string | null;
  reason: string;
  createdAt: Date;
  resolvedAt: Date | null;
  stale: boolean;
};

export type ReminderSyncResult = {
  createdCount: number;
  resolvedCount: number;
};

type JoinedReminderRow = Pick<
  ReminderRow,
  "id" | "jobId" | "reason" | "createdAt" | "resolvedAt"
> & {
  jobState: JobState;
  customerLabel: string | null;
};

export class RemindersRepository {
  constructor(private readonly db: AppDb) {}

  async listCloseoutCandidates(): Promise<ReminderCandidateRecord[]> {
    const jobRows = await this.db
      .select()
      .from(jobs)
      .where(inArray(jobs.state, [...CLOSEOUT_CANDIDATE_STATES]))
      .orderBy(desc(jobs.updatedAt));

    if (jobRows.length === 0) {
      return [];
    }

    const jobIds = jobRows.map((job) => job.id);
    const [expenseRows, followUpRows] = await Promise.all([
      this.db
        .select({ jobId: expenses.jobId })
        .from(expenses)
        .where(inArray(expenses.jobId, jobIds)),
      this.db
        .select({
          jobId: extractedFacts.jobId,
          value: extractedFacts.value,
          createdAt: extractedFacts.createdAt,
          id: extractedFacts.id,
        })
        .from(extractedFacts)
        .where(
          and(
            inArray(extractedFacts.jobId, jobIds),
            eq(extractedFacts.factType, "follow_up_needed"),
          ),
        )
        .orderBy(desc(extractedFacts.createdAt), desc(extractedFacts.id)),
    ]);

    const expenseCountByJobId = new Map<string, number>();
    for (const row of expenseRows) {
      expenseCountByJobId.set(
        row.jobId,
        (expenseCountByJobId.get(row.jobId) ?? 0) + 1,
      );
    }

    const followUpByJobId = new Map<
      string,
      { hasFollowUpStatus: boolean; followUpNeeded: boolean }
    >();
    for (const row of followUpRows) {
      if (!row.jobId || followUpByJobId.has(row.jobId)) {
        continue;
      }
      const needed = toFollowUpNeeded(row.value);
      followUpByJobId.set(row.jobId, {
        hasFollowUpStatus: needed !== null,
        followUpNeeded: needed ?? false,
      });
    }

    return jobRows.map((job) => {
      const followUp = followUpByJobId.get(job.id);
      return {
        job,
        expenseCount: expenseCountByJobId.get(job.id) ?? 0,
        hasFollowUpStatus: followUp?.hasFollowUpStatus ?? false,
        followUpNeeded: followUp?.followUpNeeded ?? false,
      };
    });
  }

  async syncRemindersForJob(
    jobId: string,
    reasons: readonly ReminderReason[],
    now: Date,
  ): Promise<ReminderSyncResult> {
    return this.db.transaction(async (tx) => {
      const openRows = await tx
        .select()
        .from(reminders)
        .where(and(eq(reminders.jobId, jobId), isNull(reminders.resolvedAt)))
        .orderBy(reminders.createdAt, reminders.id);

      const desiredReasons = new Set<string>(reasons);
      const keptReasons = new Set<string>();
      let createdCount = 0;
      let resolvedCount = 0;

      for (const row of openRows) {
        if (!desiredReasons.has(row.reason) || keptReasons.has(row.reason)) {
          await tx
            .update(reminders)
            .set({ resolvedAt: now })
            .where(eq(reminders.id, row.id));
          resolvedCount += 1;
          continue;
        }

        keptReasons.add(row.reason);
      }

      for (const reason of reasons) {
        if (keptReasons.has(reason)) {
          continue;
        }

        await tx.insert(reminders).values({
          jobId,
          reason,
          createdAt: now,
        });
        createdCount += 1;
      }

      return { createdCount, resolvedCount };
    });
  }

  async listOpenReminders(
    now: Date,
    staleAfterMs: number,
  ): Promise<ReminderRecord[]> {
    const rows = await this.listJoinedReminders(isNull(reminders.resolvedAt));
    return rows.map((row) => toReminderRecord(row, now, staleAfterMs));
  }

  async listStaleReminders(
    now: Date,
    staleAfterMs: number,
  ): Promise<ReminderRecord[]> {
    const openReminders = await this.listOpenReminders(now, staleAfterMs);
    return openReminders.filter((reminder) => reminder.stale);
  }

  async resolveReminder(
    reminderId: string,
    now: Date,
    staleAfterMs: number,
  ): Promise<ReminderRecord | null> {
    const [row] = await this.listJoinedReminders(
      and(eq(reminders.id, reminderId), isNull(reminders.resolvedAt)),
    );

    if (!row) {
      return null;
    }

    await this.db
      .update(reminders)
      .set({ resolvedAt: now })
      .where(eq(reminders.id, reminderId));

    return toReminderRecord({ ...row, resolvedAt: now }, now, staleAfterMs);
  }

  private async listJoinedReminders(whereClause: SQL | undefined) {
    return this.db
      .select({
        id: reminders.id,
        jobId: reminders.jobId,
        reason: reminders.reason,
        createdAt: reminders.createdAt,
        resolvedAt: reminders.resolvedAt,
        jobState: jobs.state,
        customerLabel: jobs.customerLabel,
      })
      .from(reminders)
      .innerJoin(jobs, eq(reminders.jobId, jobs.id))
      .where(whereClause)
      .orderBy(desc(reminders.createdAt), desc(reminders.id));
  }
}

function toReminderRecord(
  row: JoinedReminderRow,
  now: Date,
  staleAfterMs: number,
): ReminderRecord {
  return {
    id: row.id,
    jobId: row.jobId,
    jobState: row.jobState,
    customerLabel: row.customerLabel,
    reason: row.reason,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    stale:
      row.resolvedAt === null &&
      now.getTime() - row.createdAt.getTime() >= staleAfterMs,
  };
}

function toFollowUpNeeded(value: unknown) {
  if (!isRecord(value) || typeof value.needed !== "boolean") {
    return null;
  }
  return value.needed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
