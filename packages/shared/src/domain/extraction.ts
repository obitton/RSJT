import { z } from "zod";
import { SourceEvidenceSchema } from "./jobs.js";
import { MoneyCentsSchema } from "./money.js";

const ConfidenceSchema = z.number().min(0).max(1);

export const FactConfirmationConfidenceThreshold = 0.8;

const BaseExtractedFactSchema = z.object({
  confidence: ConfidenceSchema,
  evidence: SourceEvidenceSchema,
  requiresConfirmation: z.boolean(),
});

export const CustomerHintFactSchema = BaseExtractedFactSchema.extend({
  type: z.literal("customer_hint"),
  value: z.object({
    text: z.string().trim().min(1),
  }),
});

export const WorkPerformedFactSchema = BaseExtractedFactSchema.extend({
  type: z.literal("work_performed"),
  value: z.object({
    text: z.string().trim().min(1),
  }),
});

export const DurationMinutesFactSchema = BaseExtractedFactSchema.extend({
  type: z.literal("duration_minutes"),
  value: z.object({
    minutes: z.number().int().positive(),
  }),
});

export const GrossChargeFactSchema = BaseExtractedFactSchema.extend({
  type: z.literal("gross_charge_cents"),
  value: z.object({
    amountCents: MoneyCentsSchema,
  }),
});

export const ExpenseFactSchema = BaseExtractedFactSchema.extend({
  type: z.literal("expense_cents"),
  value: z.object({
    amountCents: MoneyCentsSchema,
    description: z.string().trim().min(1).optional(),
  }),
});

export const ReportedProfitFactSchema = BaseExtractedFactSchema.extend({
  type: z.literal("reported_profit_cents"),
  value: z.object({
    amountCents: MoneyCentsSchema,
  }),
});

export const CompletionStateFactSchema = BaseExtractedFactSchema.extend({
  type: z.literal("completion_state"),
  value: z.object({
    state: z.enum([
      "completed",
      "not_completed",
      "likely_completed",
      "unknown",
    ]),
  }),
});

export const SchedulingNoteFactSchema = BaseExtractedFactSchema.extend({
  type: z.literal("scheduling_note"),
  value: z.object({
    text: z.string().trim().min(1),
  }),
});

export const FollowUpNeededFactSchema = BaseExtractedFactSchema.extend({
  type: z.literal("follow_up_needed"),
  value: z.object({
    needed: z.boolean(),
    note: z.string().trim().min(1).optional(),
  }),
});

export const ExtractedFactSchema = z.discriminatedUnion("type", [
  CustomerHintFactSchema,
  WorkPerformedFactSchema,
  DurationMinutesFactSchema,
  GrossChargeFactSchema,
  ExpenseFactSchema,
  ReportedProfitFactSchema,
  CompletionStateFactSchema,
  SchedulingNoteFactSchema,
  FollowUpNeededFactSchema,
]);

export const ExtractedFactValueSchema = z.union([
  CustomerHintFactSchema.shape.value,
  WorkPerformedFactSchema.shape.value,
  DurationMinutesFactSchema.shape.value,
  GrossChargeFactSchema.shape.value,
  ExpenseFactSchema.shape.value,
  ReportedProfitFactSchema.shape.value,
  CompletionStateFactSchema.shape.value,
  SchedulingNoteFactSchema.shape.value,
  FollowUpNeededFactSchema.shape.value,
]);

export const MissingFieldSchema = z.enum([
  "customer_hint",
  "expense_cents",
  "completion_state",
  "follow_up_needed",
]);

export const MissingFieldPromptSchema = z.object({
  field: MissingFieldSchema,
  message: z.string().trim().min(1),
});

export const UpdateExtractionRequestSchema = z.object({
  body: z.string().trim().min(1),
});

export const UpdateExtractionResponseSchema = z.object({
  jobId: z.string().uuid(),
  messageId: z.string().uuid(),
  facts: z.array(ExtractedFactSchema),
  missingFields: z.array(MissingFieldSchema),
  prompts: z.array(MissingFieldPromptSchema),
});

export type ExtractedFact = z.infer<typeof ExtractedFactSchema>;
export type ExtractedFactValue = z.infer<typeof ExtractedFactValueSchema>;
export type MissingField = z.infer<typeof MissingFieldSchema>;
export type MissingFieldPrompt = z.infer<typeof MissingFieldPromptSchema>;
export type UpdateExtractionRequest = z.infer<
  typeof UpdateExtractionRequestSchema
>;
export type UpdateExtractionResponse = z.infer<
  typeof UpdateExtractionResponseSchema
>;
