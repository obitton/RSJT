import { randomUUID } from "node:crypto";
import {
  type AppDb,
  createDb,
  createPool,
  expenses,
  extractedFacts,
  jobs,
  messages,
  reminders,
} from "@rsjt/db";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { RemindersRepository } from "./reminders-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("RemindersRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: RemindersRepository;
  const createdJobIds: string[] = [];
  const createdMessageIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new RemindersRepository(db);
  });

  afterEach(async () => {
    if (createdJobIds.length > 0) {
      await db.delete(reminders).where(inArray(reminders.jobId, createdJobIds));
      await db
        .delete(extractedFacts)
        .where(inArray(extractedFacts.jobId, createdJobIds));
      await db.delete(expenses).where(inArray(expenses.jobId, createdJobIds));
    }

    if (createdMessageIds.length > 0) {
      await db.delete(messages).where(inArray(messages.id, createdMessageIds));
      createdMessageIds.length = 0;
    }

    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      createdJobIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("lists closeout candidates with expense counts and latest follow-up status", async () => {
    const jobId = await createJob({
      state: "accepted",
      grossChargeCents: 18000,
    });
    await db.insert(expenses).values({
      jobId,
      category: "parts",
      amountCents: 2500,
    });
    await createFollowUpFact(jobId, true, new Date("2026-05-25T12:00:00.000Z"));
    await createFollowUpFact(
      jobId,
      false,
      new Date("2026-05-26T12:00:00.000Z"),
    );
    await createJob({ state: "closed" });

    const candidates = await repository.listCloseoutCandidates();
    const candidate = candidates.find((item) => item.job.id === jobId);

    expect(candidate).toMatchObject({
      expenseCount: 1,
      hasFollowUpStatus: true,
      followUpNeeded: false,
    });
    expect(candidates.map((item) => item.job.state)).not.toContain("closed");
  });

  it("syncs unresolved reminders by job and reason", async () => {
    const jobId = await createJob({ state: "scheduled" });
    const now = new Date("2026-05-26T12:00:00.000Z");

    const first = await repository.syncRemindersForJob(
      jobId,
      ["missing_completion", "missing_follow_up"],
      now,
    );
    const second = await repository.syncRemindersForJob(
      jobId,
      ["missing_follow_up"],
      new Date("2026-05-26T13:00:00.000Z"),
    );
    const open = await repository.listOpenReminders(
      new Date("2026-05-26T13:00:00.000Z"),
      24 * 60 * 60 * 1000,
    );

    expect(first).toEqual({ createdCount: 2, resolvedCount: 0 });
    expect(second).toEqual({ createdCount: 0, resolvedCount: 1 });
    expect(open.filter((reminder) => reminder.jobId === jobId)).toEqual([
      expect.objectContaining({ reason: "missing_follow_up" }),
    ]);
  });

  it("lists stale reminders and resolves one reminder", async () => {
    const jobId = await createJob({ state: "completed" });
    const createdAt = new Date("2026-05-25T10:00:00.000Z");
    await repository.syncRemindersForJob(
      jobId,
      ["follow_up_needed"],
      createdAt,
    );

    const stale = await repository.listStaleReminders(
      new Date("2026-05-26T12:00:00.000Z"),
      24 * 60 * 60 * 1000,
    );
    const reminder = stale.find((item) => item.jobId === jobId);
    const resolved = await repository.resolveReminder(
      reminder?.id ?? randomUUID(),
      new Date("2026-05-26T12:30:00.000Z"),
      24 * 60 * 60 * 1000,
    );

    expect(reminder?.stale).toBe(true);
    expect(resolved?.resolvedAt).toEqual(new Date("2026-05-26T12:30:00.000Z"));
  });

  async function createJob(input: Partial<typeof jobs.$inferInsert>) {
    const id = input.id ?? randomUUID();
    createdJobIds.push(id);
    await db.insert(jobs).values({
      id,
      state: input.state ?? "accepted",
      customerLabel: input.customerLabel ?? "Reminder job",
      grossChargeCents: input.grossChargeCents,
      reportedProfitCents: input.reportedProfitCents,
      splitCategory: input.splitCategory,
      completedAt: input.completedAt,
      updatedAt: input.updatedAt ?? new Date("2026-05-26T12:00:00.000Z"),
    });
    return id;
  }

  async function createFollowUpFact(
    jobId: string,
    needed: boolean,
    createdAt: Date,
  ) {
    const messageId = randomUUID();
    createdMessageIds.push(messageId);
    await db.insert(messages).values({
      id: messageId,
      jobId,
      direction: "inbound",
      authorRole: "tech",
      body: needed ? "follow up tomorrow" : "no follow up",
      createdAt,
    });
    await db.insert(extractedFacts).values({
      jobId,
      messageId,
      factType: "follow_up_needed",
      value: { needed },
      confidence: 8500,
      evidence: { messageId, quote: needed ? "follow up" : "no follow up" },
      createdAt,
    });
  }
});
