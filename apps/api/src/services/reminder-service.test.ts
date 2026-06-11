import type { JobState, ReminderReason, ReminderSummary } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import type {
  ReminderCandidateRecord,
  ReminderRecord,
  ReminderSyncResult,
} from "../repositories/reminders-repository.js";
import {
  ReminderNotFoundError,
  ReminderService,
  type ReminderStore,
} from "./reminder-service.js";

describe("ReminderService", () => {
  it("generates missing-field reminders for closeout candidates", async () => {
    const store = new FakeReminderStore([
      candidateFixture({
        state: "scheduled",
        splitCategory: null,
        grossChargeCents: null,
        reportedProfitCents: null,
        hasFollowUpStatus: false,
      }),
    ]);
    const service = new ReminderService(store);

    const response = await service.generateReminders(
      new Date("2026-05-26T12:00:00.000Z"),
    );

    expect(response.createdCount).toBe(4);
    expect(store.syncCalls[0]?.reasons).toEqual([
      "missing_completion",
      "missing_split_category",
      "missing_charge_or_profit",
      "missing_follow_up",
    ]);
  });

  it("adds expense-detail and follow-up-needed reminders when those facts apply", async () => {
    const store = new FakeReminderStore([
      candidateFixture({
        state: "completed",
        splitCategory: "new_lead",
        grossChargeCents: 18000,
        reportedProfitCents: null,
        expenseCount: 0,
        hasFollowUpStatus: true,
        followUpNeeded: true,
      }),
    ]);
    const service = new ReminderService(store);

    await service.generateReminders(new Date("2026-05-26T12:00:00.000Z"));

    expect(store.syncCalls[0]?.reasons).toEqual([
      "missing_expense_detail",
      "follow_up_needed",
    ]);
  });

  it("lists stale reminders and resolves reminders through shared response schemas", async () => {
    const reminder = reminderFixture({
      stale: true,
      reason: "follow_up_needed",
    });
    const store = new FakeReminderStore([], [reminder]);
    const service = new ReminderService(store);

    const stale = await service.listStaleReminders(
      new Date("2026-05-26T12:00:00.000Z"),
    );
    const resolved = await service.resolveReminder(
      reminder.id,
      new Date("2026-05-26T12:30:00.000Z"),
    );

    expect(stale.reminders).toHaveLength(1);
    expect(resolved.reminder.resolvedAt).toEqual(
      new Date("2026-05-26T12:30:00.000Z"),
    );
  });

  it("throws when resolving a missing reminder", async () => {
    const service = new ReminderService(new FakeReminderStore());

    await expect(
      service.resolveReminder("00000000-0000-4000-8000-000000180999"),
    ).rejects.toBeInstanceOf(ReminderNotFoundError);
  });
});

class FakeReminderStore implements ReminderStore {
  readonly syncCalls: Array<{
    jobId: string;
    reasons: ReminderReason[];
    now: Date;
  }> = [];

  constructor(
    private readonly candidates: ReminderCandidateRecord[] = [],
    private reminders: ReminderRecord[] = [],
  ) {}

  async listCloseoutCandidates() {
    return this.candidates;
  }

  async syncRemindersForJob(
    jobId: string,
    reasons: readonly ReminderReason[],
    now: Date,
  ): Promise<ReminderSyncResult> {
    this.syncCalls.push({ jobId, reasons: [...reasons], now });
    const created = reasons.map((reason, index) =>
      reminderFixture({
        id: `00000000-0000-4000-8000-00000018000${index}`,
        jobId,
        reason,
      }),
    );
    this.reminders = created;
    return { createdCount: reasons.length, resolvedCount: 0 };
  }

  async listOpenReminders() {
    return this.reminders.filter((reminder) => reminder.resolvedAt === null);
  }

  async listStaleReminders() {
    return this.reminders.filter((reminder) => reminder.stale);
  }

  async resolveReminder(reminderId: string, now: Date) {
    const reminder = this.reminders.find((item) => item.id === reminderId);
    if (!reminder) {
      return null;
    }
    const resolved = { ...reminder, resolvedAt: now, stale: false };
    this.reminders = this.reminders.map((item) =>
      item.id === reminderId ? resolved : item,
    );
    return resolved;
  }
}

function candidateFixture(
  input: Partial<{
    state: JobState;
    splitCategory:
      | "returning_repairshopr_customer"
      | "new_lead"
      | "customer_service_heavy"
      | null;
    grossChargeCents: number | null;
    reportedProfitCents: number | null;
    expenseCount: number;
    hasFollowUpStatus: boolean;
    followUpNeeded: boolean;
  }> = {},
): ReminderCandidateRecord {
  const now = new Date("2026-05-26T12:00:00.000Z");
  return {
    job: {
      id: "00000000-0000-4000-8000-000000010102",
      conversationId: null,
      state: input.state ?? "accepted",
      customerLabel: "Reminder job",
      repairShoprEntityType: null,
      repairShoprId: null,
      splitCategory:
        "splitCategory" in input ? (input.splitCategory ?? null) : "new_lead",
      grossChargeCents:
        "grossChargeCents" in input ? (input.grossChargeCents ?? null) : 18000,
      reportedProfitCents:
        "reportedProfitCents" in input
          ? (input.reportedProfitCents ?? null)
          : null,
      calculatedProfitCents: null,
      profitBasis: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    expenseCount: input.expenseCount ?? 0,
    hasFollowUpStatus: input.hasFollowUpStatus ?? false,
    followUpNeeded: input.followUpNeeded ?? false,
  };
}

function reminderFixture(input: Partial<ReminderSummary> = {}): ReminderRecord {
  return {
    id: input.id ?? "00000000-0000-4000-8000-000000180001",
    jobId: input.jobId ?? "00000000-0000-4000-8000-000000010102",
    jobState: input.jobState ?? "scheduled",
    customerLabel: input.customerLabel ?? "Scheduled onsite setup",
    reason: input.reason ?? "missing_completion",
    createdAt: input.createdAt ?? new Date("2026-05-25T12:00:00.000Z"),
    resolvedAt: input.resolvedAt ?? null,
    stale: input.stale ?? false,
  };
}
