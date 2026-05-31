import type {
  JobExpenseInput,
  JobMoneyResponse,
  JobState,
  OverrideSplitCategoryRequest,
  ProfitBasis,
  SessionUser,
  SplitCategory,
  UpdateJobMoneyRequest,
} from "@rsjt/shared";
import { JobMoneyResponseSchema, SplitPercentByCategory } from "@rsjt/shared";
import type {
  JobMoneyRecord,
  OverrideSplitCategoryInput,
  ReplaceJobMoneyInput,
} from "../repositories/job-money-repository.js";

export interface JobMoneyStore {
  getMoney(jobId: string): Promise<JobMoneyRecord | null>;
  replaceMoney(input: ReplaceJobMoneyInput): Promise<JobMoneyRecord | null>;
  overrideSplitCategory(
    input: OverrideSplitCategoryInput,
  ): Promise<JobMoneyRecord | null>;
}

export interface JobMoneyServiceApi {
  getMoney(user: SessionUser, jobId: string): Promise<JobMoneyResponse>;
  updateMoney(
    user: SessionUser,
    jobId: string,
    input: UpdateJobMoneyRequest,
  ): Promise<JobMoneyResponse>;
  overrideSplitCategory(
    user: SessionUser,
    jobId: string,
    input: OverrideSplitCategoryRequest,
  ): Promise<JobMoneyResponse>;
}

export class JobMoneyNotFoundError extends Error {
  constructor() {
    super("Job money record not found");
  }
}

export class JobMoneyService implements JobMoneyServiceApi {
  constructor(private readonly store: JobMoneyStore) {}

  async getMoney(_user: SessionUser, jobId: string) {
    return toResponse(await this.requireMoney(jobId));
  }

  async updateMoney(
    user: SessionUser,
    jobId: string,
    input: UpdateJobMoneyRequest,
  ) {
    const current = await this.requireMoney(jobId);
    const nextGrossChargeCents =
      input.grossChargeCents !== undefined
        ? input.grossChargeCents
        : current.job.grossChargeCents;
    const nextReportedProfitCents =
      input.reportedProfitCents !== undefined
        ? input.reportedProfitCents
        : current.job.reportedProfitCents;
    const nextExpenses =
      input.expenses ??
      current.expenses.map((expense) => ({
        category: expense.category,
        amountCents: expense.amountCents,
        description: expense.description,
      }));

    const completed =
      input.completed ??
      isJobCompleted(current.job.state, current.job.completedAt);
    const calculation = calculateMoney({
      grossChargeCents: nextGrossChargeCents,
      reportedProfitCents: nextReportedProfitCents,
      expenses: nextExpenses,
      splitCategory: current.job.splitCategory,
      completed,
    });
    const completedAt = deriveCompletedAt({
      currentState: current.job.state,
      currentCompletedAt: current.job.completedAt,
      completed,
    });
    const state = deriveJobState({
      currentState: current.job.state,
      completed,
      payoutReady: calculation.payoutReady,
    });

    const updated = await this.store.replaceMoney({
      jobId,
      actorUserId: user.id,
      state,
      completedAt,
      grossChargeCents: nextGrossChargeCents,
      reportedProfitCents: nextReportedProfitCents,
      calculatedProfitCents: calculation.calculatedProfitCents,
      profitBasis: calculation.profitBasis,
      expenses: nextExpenses,
    });

    if (!updated) {
      throw new JobMoneyNotFoundError();
    }

    return toResponse(updated);
  }

  async overrideSplitCategory(
    user: SessionUser,
    jobId: string,
    input: OverrideSplitCategoryRequest,
  ) {
    const current = await this.requireMoney(jobId);
    const completed = isJobCompleted(
      current.job.state,
      current.job.completedAt,
    );
    const calculation = calculateMoney({
      grossChargeCents: current.job.grossChargeCents,
      reportedProfitCents: current.job.reportedProfitCents,
      expenses: current.expenses,
      splitCategory: input.splitCategory,
      completed,
    });
    const state = deriveJobState({
      currentState: current.job.state,
      completed,
      payoutReady: calculation.payoutReady,
    });

    const updated = await this.store.overrideSplitCategory({
      jobId,
      actorUserId: user.id,
      splitCategory: input.splitCategory,
      reason: input.reason,
      state,
      completedAt: current.job.completedAt,
      calculatedProfitCents: calculation.calculatedProfitCents,
      profitBasis: calculation.profitBasis,
    });

    if (!updated) {
      throw new JobMoneyNotFoundError();
    }

    return toResponse(updated);
  }

  private async requireMoney(jobId: string) {
    const record = await this.store.getMoney(jobId);
    if (!record) {
      throw new JobMoneyNotFoundError();
    }
    return record;
  }
}

type MoneyCalculationInput = {
  grossChargeCents: number | null;
  reportedProfitCents: number | null;
  expenses: readonly Pick<JobExpenseInput, "amountCents">[];
  splitCategory: SplitCategory | null;
  completed: boolean;
};

type MoneyCalculation = {
  reportedExpenseCents: number;
  calculatedProfitCents: number | null;
  profitBasis: ProfitBasis | null;
  managerPercent: number | null;
  techPercent: number | null;
  managerShareCents: number | null;
  techShareCents: number | null;
  payoutReady: boolean;
  missingFields: Array<
    "completion" | "split_category" | "gross_charge" | "profit_detail"
  >;
};

function toResponse(record: JobMoneyRecord): JobMoneyResponse {
  const completed = isJobCompleted(record.job.state, record.job.completedAt);
  const calculation = calculateMoney({
    grossChargeCents: record.job.grossChargeCents,
    reportedProfitCents: record.job.reportedProfitCents,
    expenses: record.expenses,
    splitCategory: record.job.splitCategory,
    completed,
  });

  return JobMoneyResponseSchema.parse({
    summary: {
      jobId: record.job.id,
      state: record.job.state,
      isCompleted: completed,
      splitCategory: record.job.splitCategory,
      grossChargeCents: record.job.grossChargeCents,
      reportedExpenseCents: calculation.reportedExpenseCents,
      reportedProfitCents: record.job.reportedProfitCents,
      calculatedProfitCents: calculation.calculatedProfitCents,
      profitBasis: calculation.profitBasis,
      managerPercent: calculation.managerPercent,
      techPercent: calculation.techPercent,
      managerShareCents: calculation.managerShareCents,
      techShareCents: calculation.techShareCents,
      payoutReady: calculation.payoutReady,
      missingFields: calculation.missingFields,
    },
    expenses: record.expenses,
  });
}

function calculateMoney(input: MoneyCalculationInput): MoneyCalculation {
  const reportedExpenseCents = input.expenses.reduce(
    (total, expense) => total + expense.amountCents,
    0,
  );
  const profit = deriveProfit({
    grossChargeCents: input.grossChargeCents,
    reportedExpenseCents,
    reportedProfitCents: input.reportedProfitCents,
  });
  const split = input.splitCategory
    ? SplitPercentByCategory[input.splitCategory]
    : null;
  const managerShareCents =
    split && profit.calculatedProfitCents !== null
      ? Math.round((profit.calculatedProfitCents * split.manager) / 100)
      : null;
  const techShareCents =
    split && profit.calculatedProfitCents !== null && managerShareCents !== null
      ? profit.calculatedProfitCents - managerShareCents
      : null;
  const payoutReady =
    input.completed &&
    input.splitCategory !== null &&
    profit.profitBasis !== null;

  return {
    reportedExpenseCents,
    calculatedProfitCents: profit.calculatedProfitCents,
    profitBasis: profit.profitBasis,
    managerPercent: split?.manager ?? null,
    techPercent: split?.tech ?? null,
    managerShareCents,
    techShareCents,
    payoutReady,
    missingFields: findMissingFields({
      completed: input.completed,
      splitCategory: input.splitCategory,
      grossChargeCents: input.grossChargeCents,
      reportedProfitCents: input.reportedProfitCents,
      profitBasis: profit.profitBasis,
    }),
  };
}

function deriveProfit(input: {
  grossChargeCents: number | null;
  reportedExpenseCents: number;
  reportedProfitCents: number | null;
}): {
  calculatedProfitCents: number | null;
  profitBasis: ProfitBasis | null;
} {
  if (input.reportedProfitCents !== null) {
    return {
      calculatedProfitCents: input.reportedProfitCents,
      profitBasis: "reported_profit",
    };
  }

  if (input.grossChargeCents !== null) {
    return {
      calculatedProfitCents: Math.max(
        0,
        input.grossChargeCents - input.reportedExpenseCents,
      ),
      profitBasis: "charge_minus_reported_expenses",
    };
  }

  return {
    calculatedProfitCents: null,
    profitBasis: null,
  };
}

function findMissingFields(input: {
  completed: boolean;
  splitCategory: SplitCategory | null;
  grossChargeCents: number | null;
  reportedProfitCents: number | null;
  profitBasis: ProfitBasis | null;
}): MoneyCalculation["missingFields"] {
  const missing: MoneyCalculation["missingFields"] = [];
  if (!input.completed) {
    missing.push("completion");
  }
  if (input.splitCategory === null) {
    missing.push("split_category");
  }
  if (input.profitBasis === null) {
    missing.push(
      input.reportedProfitCents === null && input.grossChargeCents === null
        ? "gross_charge"
        : "profit_detail",
    );
  }
  return missing;
}

function deriveCompletedAt(input: {
  currentState: JobState;
  currentCompletedAt: Date | null;
  completed: boolean;
}) {
  if (input.currentState === "closed") {
    return input.currentCompletedAt;
  }
  if (input.completed) {
    return input.currentCompletedAt ?? new Date();
  }
  return null;
}

function deriveJobState(input: {
  currentState: JobState;
  completed: boolean;
  payoutReady: boolean;
}): JobState {
  if (input.currentState === "closed") {
    return "closed";
  }
  if (input.payoutReady) {
    return "payout_ready";
  }
  if (input.completed) {
    return "completed";
  }
  if (
    input.currentState === "completed" ||
    input.currentState === "payout_ready"
  ) {
    return "accepted";
  }
  return input.currentState;
}

function isJobCompleted(state: JobState, completedAt: Date | null) {
  return (
    completedAt !== null ||
    state === "completed" ||
    state === "payout_ready" ||
    state === "closed"
  );
}
