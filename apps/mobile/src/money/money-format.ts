import type {
  ExpenseCategory,
  MoneyMissingField,
  ProfitBasis,
  SplitCategory,
} from "@rsjt/shared";

export function formatMoneyCents(amountCents: number) {
  return `$${(amountCents / 100).toFixed(2)}`;
}

export function formatNullableMoney(amountCents: number | null) {
  return amountCents === null ? "Not entered" : formatMoneyCents(amountCents);
}

export function formatMoneyInput(amountCents: number | null) {
  return amountCents === null ? "" : (amountCents / 100).toFixed(2);
}

export function parseMoneyInputToCents(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/[$,]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Math.round(Number(normalized) * 100);
}

export function formatExpenseCategory(category: ExpenseCategory) {
  switch (category) {
    case "parts":
      return "Parts";
    case "materials":
      return "Materials";
    case "subcontractor":
      return "Subcontractor";
    case "other":
      return "Other";
  }
}

export function formatSplitCategory(category: SplitCategory) {
  switch (category) {
    case "returning_repairshopr_customer":
      return "Returning RepairShopr customer";
    case "new_lead":
      return "New lead";
    case "customer_service_heavy":
      return "Customer service heavy";
  }
}

export function formatProfitBasis(basis: ProfitBasis | null) {
  switch (basis) {
    case "reported_profit":
      return "Reported profit";
    case "charge_minus_reported_expenses":
      return "Charge minus expenses";
    case null:
      return "Not ready";
  }
}

export function formatPayoutReady(ready: boolean) {
  return ready ? "Payout ready" : "Not payout ready";
}

export function formatMissingField(field: MoneyMissingField) {
  switch (field) {
    case "completion":
      return "Completion";
    case "split_category":
      return "Split category";
    case "gross_charge":
      return "Gross charge";
    case "profit_detail":
      return "Profit detail";
  }
}
