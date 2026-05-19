import { z } from "zod";

export const MoneyCentsSchema = z.number().int().min(0);

export const ExpenseCategorySchema = z.enum([
  "parts",
  "materials",
  "subcontractor",
  "other",
]);

export const SplitCategorySchema = z.enum([
  "returning_repairshopr_customer",
  "new_lead",
  "customer_service_heavy",
]);

export const SplitPercentByCategory = {
  returning_repairshopr_customer: { manager: 30, tech: 70 },
  new_lead: { manager: 20, tech: 80 },
  customer_service_heavy: { manager: 50, tech: 50 },
} as const;

export const ProfitBasisSchema = z.enum([
  "reported_profit",
  "charge_minus_reported_expenses",
]);

export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;
export type SplitCategory = z.infer<typeof SplitCategorySchema>;
export type ProfitBasis = z.infer<typeof ProfitBasisSchema>;
