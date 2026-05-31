import type {
  JobExpenseInput,
  JobMoneyResponse,
  JobState,
  OverrideSplitCategoryRequest,
  SessionUser,
  SplitCategory,
  UpdateJobMoneyRequest,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import type {
  JobMoneyRecord,
  OverrideSplitCategoryInput,
  ReplaceJobMoneyInput,
} from "../repositories/job-money-repository.js";
import {
  JobMoneyNotFoundError,
  JobMoneyService,
  type JobMoneyStore,
} from "./job-money-service.js";

const techUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000020",
  role: "tech",
  displayName: "Tech",
};

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};

describe("JobMoneyService", () => {
  it("prefers reported profit when present", async () => {
    const service = new JobMoneyService(
      new FakeJobMoneyStore(
        recordFixture({
          state: "completed",
          splitCategory: "new_lead",
          reportedProfitCents: 10001,
          grossChargeCents: 18000,
          expenses: [{ category: "parts", amountCents: 4000 }],
          completedAt: new Date("2026-05-26T12:00:00.000Z"),
        }),
      ),
    );

    const response = await service.getMoney(techUser, jobId);

    expect(response.summary.profitBasis).toBe("reported_profit");
    expect(response.summary.calculatedProfitCents).toBe(10001);
    expect(response.summary.managerShareCents).toBe(2000);
    expect(response.summary.techShareCents).toBe(8001);
  });

  it("calculates profit from charge minus expenses", async () => {
    const store = new FakeJobMoneyStore(
      recordFixture({ state: "accepted", splitCategory: "new_lead" }),
    );
    const service = new JobMoneyService(store);

    const response = await service.updateMoney(techUser, jobId, {
      completed: true,
      grossChargeCents: 18000,
      expenses: [{ category: "parts", amountCents: 2500 }],
    });

    expect(store.lastReplace).toMatchObject({
      state: "payout_ready",
      grossChargeCents: 18000,
      calculatedProfitCents: 15500,
      profitBasis: "charge_minus_reported_expenses",
    });
    expect(response.summary.payoutReady).toBe(true);
    expect(response.summary.managerShareCents).toBe(3100);
    expect(response.summary.techShareCents).toBe(12400);
  });

  it("keeps incomplete jobs out of payout-ready state", async () => {
    const store = new FakeJobMoneyStore(
      recordFixture({ state: "accepted", splitCategory: "new_lead" }),
    );
    const service = new JobMoneyService(store);

    const response = await service.updateMoney(techUser, jobId, {
      completed: false,
      grossChargeCents: 18000,
      expenses: [],
    });

    expect(store.lastReplace?.state).toBe("accepted");
    expect(response.summary.payoutReady).toBe(false);
    expect(response.summary.missingFields).toContain("completion");
  });

  it("keeps closed jobs closed when money is edited", async () => {
    const store = new FakeJobMoneyStore(
      recordFixture({
        state: "closed",
        splitCategory: "new_lead",
        completedAt: new Date("2026-05-26T12:00:00.000Z"),
      }),
    );
    const service = new JobMoneyService(store);

    await service.updateMoney(techUser, jobId, {
      completed: true,
      grossChargeCents: 18000,
    });

    expect(store.lastReplace?.state).toBe("closed");
  });

  it("recalculates payout readiness on split override", async () => {
    const store = new FakeJobMoneyStore(
      recordFixture({
        state: "completed",
        splitCategory: null,
        grossChargeCents: 18000,
        completedAt: new Date("2026-05-26T12:00:00.000Z"),
      }),
    );
    const service = new JobMoneyService(store);

    const response = await service.overrideSplitCategory(managerUser, jobId, {
      splitCategory: "customer_service_heavy",
      reason: "Extra customer-service effort required.",
    });

    expect(store.lastOverride).toMatchObject({
      state: "payout_ready",
      splitCategory: "customer_service_heavy",
      reason: "Extra customer-service effort required.",
    });
    expect(response.summary.payoutReady).toBe(true);
    expect(response.summary.managerPercent).toBe(50);
  });

  it("throws when the job is missing", async () => {
    const service = new JobMoneyService(new FakeJobMoneyStore(null));

    await expect(service.getMoney(techUser, jobId)).rejects.toBeInstanceOf(
      JobMoneyNotFoundError,
    );
  });
});

class FakeJobMoneyStore implements JobMoneyStore {
  lastReplace: ReplaceJobMoneyInput | null = null;
  lastOverride: OverrideSplitCategoryInput | null = null;

  constructor(private record: JobMoneyRecord | null) {}

  async getMoney() {
    return this.record;
  }

  async replaceMoney(input: ReplaceJobMoneyInput) {
    this.lastReplace = input;
    if (!this.record) {
      return null;
    }

    this.record = {
      job: {
        ...this.record.job,
        state: input.state,
        completedAt: input.completedAt,
        grossChargeCents: input.grossChargeCents,
        reportedProfitCents: input.reportedProfitCents,
        calculatedProfitCents: input.calculatedProfitCents,
        profitBasis: input.profitBasis,
      },
      expenses: input.expenses.map((expense, index) =>
        expenseFixture(expense, index),
      ),
    };
    return this.record;
  }

  async overrideSplitCategory(input: OverrideSplitCategoryInput) {
    this.lastOverride = input;
    if (!this.record) {
      return null;
    }

    this.record = {
      job: {
        ...this.record.job,
        splitCategory: input.splitCategory,
        state: input.state,
        completedAt: input.completedAt,
        calculatedProfitCents: input.calculatedProfitCents,
        profitBasis: input.profitBasis,
      },
      expenses: this.record.expenses,
    };
    return this.record;
  }
}

const jobId = "00000000-0000-4000-8000-000000090001";

function recordFixture(input: {
  state?: JobState;
  splitCategory?: SplitCategory | null;
  grossChargeCents?: number | null;
  reportedProfitCents?: number | null;
  expenses?: JobExpenseInput[];
  completedAt?: Date | null;
}): JobMoneyRecord {
  const now = new Date("2026-05-26T12:00:00.000Z");
  return {
    job: {
      id: jobId,
      state: input.state ?? "accepted",
      customerLabel: "Money job",
      repairShoprEntityType: null,
      repairShoprId: null,
      splitCategory: input.splitCategory ?? null,
      grossChargeCents: input.grossChargeCents ?? null,
      reportedProfitCents: input.reportedProfitCents ?? null,
      calculatedProfitCents: null,
      profitBasis: null,
      completedAt: input.completedAt ?? null,
      createdAt: now,
      updatedAt: now,
    },
    expenses: (input.expenses ?? []).map((expense, index) =>
      expenseFixture(expense, index),
    ),
  };
}

function expenseFixture(input: JobExpenseInput, index: number) {
  const now = new Date("2026-05-26T12:00:00.000Z");
  return {
    id: `00000000-0000-4000-8000-00000009001${index}`,
    jobId,
    category: input.category,
    amountCents: input.amountCents,
    description: input.description ?? null,
    enteredByUserId: techUser.id,
    createdAt: now,
    updatedAt: now,
  };
}
