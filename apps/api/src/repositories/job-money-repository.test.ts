import { randomUUID } from "node:crypto";
import {
  type AppDb,
  auditEvents,
  createDb,
  createPool,
  jobs,
  users,
} from "@rsjt/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { JobMoneyRepository } from "./job-money-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("JobMoneyRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: JobMoneyRepository;
  const createdJobIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new JobMoneyRepository(db);
  });

  afterEach(async () => {
    if (createdJobIds.length > 0) {
      await db
        .delete(auditEvents)
        .where(inArray(auditEvents.entityId, createdJobIds));
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      createdJobIds.length = 0;
    }

    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("reads job money with expenses", async () => {
    const userId = await createUser("tech");
    const jobId = await createJob({
      state: "completed",
      splitCategory: "new_lead",
      grossChargeCents: 18000,
      calculatedProfitCents: 15500,
      profitBasis: "charge_minus_reported_expenses",
      completedAt: new Date("2026-05-26T12:00:00.000Z"),
    });

    await repository.replaceMoney({
      jobId,
      actorUserId: userId,
      state: "completed",
      completedAt: new Date("2026-05-26T12:00:00.000Z"),
      grossChargeCents: 18000,
      reportedProfitCents: null,
      calculatedProfitCents: 15500,
      profitBasis: "charge_minus_reported_expenses",
      expenses: [
        {
          category: "parts",
          amountCents: 2500,
          description: "Adapter",
        },
      ],
    });

    const money = await repository.getMoney(jobId);

    expect(money?.job.id).toBe(jobId);
    expect(money?.expenses).toEqual([
      expect.objectContaining({
        category: "parts",
        amountCents: 2500,
        enteredByUserId: userId,
      }),
    ]);
  });

  it("replaces job money and expense rows", async () => {
    const userId = await createUser("tech");
    const jobId = await createJob({
      state: "accepted",
      splitCategory: "new_lead",
    });

    await repository.replaceMoney({
      jobId,
      actorUserId: userId,
      state: "completed",
      completedAt: new Date("2026-05-26T12:00:00.000Z"),
      grossChargeCents: 10000,
      reportedProfitCents: null,
      calculatedProfitCents: 9000,
      profitBasis: "charge_minus_reported_expenses",
      expenses: [{ category: "parts", amountCents: 1000 }],
    });
    const updated = await repository.replaceMoney({
      jobId,
      actorUserId: userId,
      state: "payout_ready",
      completedAt: new Date("2026-05-26T13:00:00.000Z"),
      grossChargeCents: 18000,
      reportedProfitCents: null,
      calculatedProfitCents: 15500,
      profitBasis: "charge_minus_reported_expenses",
      expenses: [
        { category: "parts", amountCents: 2500 },
        { category: "materials", amountCents: 500, description: "Cable" },
      ],
    });

    expect(updated?.job.state).toBe("payout_ready");
    expect(updated?.job.grossChargeCents).toBe(18000);
    expect(updated?.expenses).toHaveLength(2);
    expect(
      updated?.expenses
        .map((expense) => expense.amountCents)
        .sort((left, right) => left - right),
    ).toEqual([500, 2500]);
  });

  it("writes split override audit event", async () => {
    const managerUserId = await createUser("manager");
    const jobId = await createJob({
      state: "completed",
      splitCategory: "new_lead",
      completedAt: new Date("2026-05-26T12:00:00.000Z"),
    });

    const updated = await repository.overrideSplitCategory({
      jobId,
      actorUserId: managerUserId,
      splitCategory: "customer_service_heavy",
      reason: "Extra customer-service effort required.",
      state: "payout_ready",
      completedAt: new Date("2026-05-26T12:00:00.000Z"),
      calculatedProfitCents: 12000,
      profitBasis: "reported_profit",
    });

    const events = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.entityId, jobId));

    expect(updated?.job.splitCategory).toBe("customer_service_heavy");
    expect(events).toEqual([
      expect.objectContaining({
        action: "split_category_override",
        actorUserId: managerUserId,
      }),
    ]);
    expect(events[0]?.metadata).toMatchObject({
      previousSplitCategory: "new_lead",
      nextSplitCategory: "customer_service_heavy",
      reason: "Extra customer-service effort required.",
    });
  });

  it("returns null for missing jobs", async () => {
    expect(await repository.getMoney(randomUUID())).toBeNull();
    expect(
      await repository.replaceMoney({
        jobId: randomUUID(),
        actorUserId: randomUUID(),
        state: "completed",
        completedAt: new Date("2026-05-26T12:00:00.000Z"),
        grossChargeCents: 18000,
        reportedProfitCents: null,
        calculatedProfitCents: 18000,
        profitBasis: "charge_minus_reported_expenses",
        expenses: [],
      }),
    ).toBeNull();
  });

  async function createUser(role: "manager" | "tech") {
    const id = randomUUID();
    createdUserIds.push(id);
    await db.insert(users).values({
      id,
      username: `${role}-${id}`,
      displayName: role === "manager" ? "Manager" : "Tech",
      role,
      passcodeHash: "hash",
    });
    return id;
  }

  async function createJob(input: Partial<typeof jobs.$inferInsert>) {
    const id = input.id ?? randomUUID();
    createdJobIds.push(id);
    await db.insert(jobs).values({
      id,
      state: input.state ?? "accepted",
      customerLabel: input.customerLabel ?? "Money job",
      splitCategory: input.splitCategory,
      grossChargeCents: input.grossChargeCents,
      reportedProfitCents: input.reportedProfitCents,
      calculatedProfitCents: input.calculatedProfitCents,
      profitBasis: input.profitBasis,
      completedAt: input.completedAt,
    });
    return id;
  }
});
