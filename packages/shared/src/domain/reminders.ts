import { z } from "zod";
import { JobStateSchema } from "./jobs.js";

export const ReminderReasonSchema = z.enum([
  "missing_completion",
  "missing_split_category",
  "missing_charge_or_profit",
  "missing_expense_detail",
  "missing_follow_up",
  "follow_up_needed",
]);

export const ReminderIdParamsSchema = z.object({
  reminderId: z.string().uuid(),
});

export const ReminderSummarySchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  jobState: JobStateSchema,
  customerLabel: z.string().min(1).nullable(),
  reason: ReminderReasonSchema,
  createdAt: z.date(),
  resolvedAt: z.date().nullable(),
  stale: z.boolean(),
});

export const ReminderListResponseSchema = z.object({
  reminders: z.array(ReminderSummarySchema),
});

export const ReminderGenerationResponseSchema = z.object({
  createdCount: z.number().int().min(0),
  resolvedCount: z.number().int().min(0),
  reminders: z.array(ReminderSummarySchema),
});

export const ResolveReminderResponseSchema = z.object({
  reminder: ReminderSummarySchema,
});

export type ReminderReason = z.infer<typeof ReminderReasonSchema>;
export type ReminderIdParams = z.infer<typeof ReminderIdParamsSchema>;
export type ReminderSummary = z.infer<typeof ReminderSummarySchema>;
export type ReminderListResponse = z.infer<typeof ReminderListResponseSchema>;
export type ReminderGenerationResponse = z.infer<
  typeof ReminderGenerationResponseSchema
>;
export type ResolveReminderResponse = z.infer<
  typeof ResolveReminderResponseSchema
>;
