import { isRecord } from "@/auth/session-validation";
import type {
  ExpenseCategory,
  JobExpense,
  JobMoneyResponse,
  JobMoneySummary,
  JobState,
  MoneyMissingField,
  ProfitBasis,
  SplitCategory,
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

const EXPENSE_CATEGORIES = [
  "parts",
  "materials",
  "subcontractor",
  "other",
] as const satisfies readonly ExpenseCategory[];

const SPLIT_CATEGORIES = [
  "returning_repairshopr_customer",
  "new_lead",
  "customer_service_heavy",
] as const satisfies readonly SplitCategory[];

const PROFIT_BASES = [
  "reported_profit",
  "charge_minus_reported_expenses",
] as const satisfies readonly ProfitBasis[];

const MISSING_FIELDS = [
  "completion",
  "split_category",
  "gross_charge",
  "profit_detail",
] as const satisfies readonly MoneyMissingField[];

export function toJobMoneyResponse(value: unknown): JobMoneyResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const summary = toJobMoneySummary(value.summary);
  const expenses = toJobExpenseArray(value.expenses);

  if (!summary || !expenses) {
    return null;
  }

  return { summary, expenses };
}

function toJobMoneySummary(value: unknown): JobMoneySummary | null {
  if (
    !isRecord(value) ||
    typeof value.jobId !== "string" ||
    !isJobState(value.state) ||
    typeof value.isCompleted !== "boolean" ||
    typeof value.payoutReady !== "boolean"
  ) {
    return null;
  }

  const splitCategory = toNullableSplitCategory(value.splitCategory);
  const grossChargeCents = toNullableCents(value.grossChargeCents);
  const reportedExpenseCents = toCents(value.reportedExpenseCents);
  const reportedProfitCents = toNullableCents(value.reportedProfitCents);
  const calculatedProfitCents = toNullableCents(value.calculatedProfitCents);
  const profitBasis = toNullableProfitBasis(value.profitBasis);
  const managerPercent = toNullablePercent(value.managerPercent);
  const techPercent = toNullablePercent(value.techPercent);
  const managerShareCents = toNullableCents(value.managerShareCents);
  const techShareCents = toNullableCents(value.techShareCents);
  const missingFields = toMissingFieldArray(value.missingFields);

  if (
    splitCategory === undefined ||
    grossChargeCents === undefined ||
    reportedExpenseCents === null ||
    reportedProfitCents === undefined ||
    calculatedProfitCents === undefined ||
    profitBasis === undefined ||
    managerPercent === undefined ||
    techPercent === undefined ||
    managerShareCents === undefined ||
    techShareCents === undefined ||
    !missingFields
  ) {
    return null;
  }

  return {
    jobId: value.jobId,
    state: value.state,
    isCompleted: value.isCompleted,
    splitCategory,
    grossChargeCents,
    reportedExpenseCents,
    reportedProfitCents,
    calculatedProfitCents,
    profitBasis,
    managerPercent,
    techPercent,
    managerShareCents,
    techShareCents,
    payoutReady: value.payoutReady,
    missingFields,
  };
}

function toJobExpenseArray(value: unknown): JobExpense[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const expenses = value.map(toJobExpense);
  return expenses.every((expense) => expense !== null) ? expenses : null;
}

function toJobExpense(value: unknown): JobExpense | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.jobId !== "string" ||
    !isExpenseCategory(value.category)
  ) {
    return null;
  }

  const amountCents = toCents(value.amountCents);
  const description = toNullableString(value.description);
  const enteredByUserId = toNullableString(value.enteredByUserId);
  const createdAt = toDate(value.createdAt);
  const updatedAt = toDate(value.updatedAt);

  if (
    amountCents === null ||
    description === undefined ||
    enteredByUserId === undefined ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id: value.id,
    jobId: value.jobId,
    category: value.category,
    amountCents,
    description,
    enteredByUserId,
    createdAt,
    updatedAt,
  };
}

function isJobState(value: unknown): value is JobState {
  return typeof value === "string" && JOB_STATES.includes(value as JobState);
}

function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return (
    typeof value === "string" &&
    EXPENSE_CATEGORIES.includes(value as ExpenseCategory)
  );
}

function toNullableSplitCategory(
  value: unknown,
): SplitCategory | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    typeof value === "string" &&
    SPLIT_CATEGORIES.includes(value as SplitCategory)
  ) {
    return value as SplitCategory;
  }
  return undefined;
}

function toNullableProfitBasis(value: unknown): ProfitBasis | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    typeof value === "string" &&
    PROFIT_BASES.includes(value as ProfitBasis)
  ) {
    return value as ProfitBasis;
  }
  return undefined;
}

function toMissingFieldArray(value: unknown): MoneyMissingField[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const fields = value.filter(isMissingField);
  return fields.length === value.length ? fields : null;
}

function isMissingField(value: unknown): value is MoneyMissingField {
  return (
    typeof value === "string" &&
    MISSING_FIELDS.includes(value as MoneyMissingField)
  );
}

function toCents(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function toNullableCents(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  const cents = toCents(value);
  return cents === null ? undefined : cents;
}

function toNullablePercent(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100
  ) {
    return value;
  }
  return undefined;
}

function toNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
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
