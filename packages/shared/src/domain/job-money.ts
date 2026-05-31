import { z } from "zod";
import { JobStateSchema } from "./jobs.js";
import {
  ExpenseCategorySchema,
  MoneyCentsSchema,
  ProfitBasisSchema,
  SplitCategorySchema,
} from "./money.js";

const NullableMoneyCentsSchema = MoneyCentsSchema.nullable();

export const MoneyMissingFieldSchema = z.enum([
  "completion",
  "split_category",
  "gross_charge",
  "profit_detail",
]);

export const JobMoneyIdParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const JobExpenseInputSchema = z.object({
  category: ExpenseCategorySchema,
  amountCents: MoneyCentsSchema,
  description: z.string().trim().min(1).nullable().optional(),
});

export const JobExpenseSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  category: ExpenseCategorySchema,
  amountCents: MoneyCentsSchema,
  description: z.string().nullable(),
  enteredByUserId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const JobMoneySummarySchema = z.object({
  jobId: z.string().uuid(),
  state: JobStateSchema,
  isCompleted: z.boolean(),
  splitCategory: SplitCategorySchema.nullable(),
  grossChargeCents: NullableMoneyCentsSchema,
  reportedExpenseCents: MoneyCentsSchema,
  reportedProfitCents: NullableMoneyCentsSchema,
  calculatedProfitCents: NullableMoneyCentsSchema,
  profitBasis: ProfitBasisSchema.nullable(),
  managerPercent: z.number().int().min(0).max(100).nullable(),
  techPercent: z.number().int().min(0).max(100).nullable(),
  managerShareCents: NullableMoneyCentsSchema,
  techShareCents: NullableMoneyCentsSchema,
  payoutReady: z.boolean(),
  missingFields: z.array(MoneyMissingFieldSchema),
});

export const JobMoneyResponseSchema = z.object({
  summary: JobMoneySummarySchema,
  expenses: z.array(JobExpenseSchema),
});

export const UpdateJobMoneyRequestSchema = z.object({
  grossChargeCents: NullableMoneyCentsSchema.optional(),
  reportedProfitCents: NullableMoneyCentsSchema.optional(),
  completed: z.boolean().optional(),
  expenses: z.array(JobExpenseInputSchema).optional(),
});

export const OverrideSplitCategoryRequestSchema = z.object({
  splitCategory: SplitCategorySchema,
  reason: z.string().trim().min(1),
});

export type MoneyMissingField = z.infer<typeof MoneyMissingFieldSchema>;
export type JobMoneyIdParams = z.infer<typeof JobMoneyIdParamsSchema>;
export type JobExpenseInput = z.infer<typeof JobExpenseInputSchema>;
export type JobExpense = z.infer<typeof JobExpenseSchema>;
export type JobMoneySummary = z.infer<typeof JobMoneySummarySchema>;
export type JobMoneyResponse = z.infer<typeof JobMoneyResponseSchema>;
export type UpdateJobMoneyRequest = z.infer<typeof UpdateJobMoneyRequestSchema>;
export type OverrideSplitCategoryRequest = z.infer<
  typeof OverrideSplitCategoryRequestSchema
>;
