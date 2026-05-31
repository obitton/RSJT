import { z } from "zod";
import { MatchConfidenceBandSchema } from "./confidence.js";
import { RepairShoprReferenceSchema } from "./repairshopr.js";

export const CustomerIntakeStateSchema = z.enum([
  "unknown",
  "identifying",
  "collecting",
  "matched",
  "review_ready",
  "blocked",
]);

export const CustomerIntakeFieldSchema = z.enum([
  "customerName",
  "phone",
  "email",
  "serviceAddress",
  "problemDescription",
  "preferredTiming",
]);

export const CustomerIntakeSnapshotSchema = z.object({
  conversationId: z.string().uuid(),
  state: CustomerIntakeStateSchema,
  customerName: z.string().min(1).nullable(),
  phone: z.string().min(1).nullable(),
  email: z.string().min(1).nullable(),
  serviceAddress: z.string().min(1).nullable(),
  problemDescription: z.string().min(1).nullable(),
  preferredTiming: z.string().min(1).nullable(),
  blockedReason: z.string().min(1).nullable(),
  spamScore: z.number().int().min(0),
  matchedReference: RepairShoprReferenceSchema.nullable(),
  matchedConfidenceBand: MatchConfidenceBandSchema.nullable(),
  takeoverActive: z.boolean().default(false),
  lastInboundMessageId: z.string().uuid().nullable(),
  lastInboundAt: z.date().nullable(),
  updatedAt: z.date(),
});

export const CustomerIntakePromptSchema = z.object({
  field: CustomerIntakeFieldSchema,
  message: z.string().min(1),
});

export const CustomerIntakeEvaluationSchema = z.object({
  conversationId: z.string().uuid(),
  state: CustomerIntakeStateSchema,
  blocked: z.boolean(),
  blockedReason: z.string().min(1).nullable(),
  spamScore: z.number().int().min(0),
  missingFields: z.array(CustomerIntakeFieldSchema),
  nextPrompt: CustomerIntakePromptSchema.nullable(),
  matchedReference: RepairShoprReferenceSchema.nullable(),
  matchedConfidenceBand: MatchConfidenceBandSchema.nullable(),
  stagedApprovalIds: z.array(z.string().uuid()),
});

export const CustomerIntakeDetailParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

export const CustomerIntakeDetailResponseSchema = z.object({
  snapshot: CustomerIntakeSnapshotSchema,
  stagedApprovalIds: z.array(z.string().uuid()),
});

export const NEW_LEAD_REQUIRED_FIELDS = [
  "phone",
  "customerName",
  "serviceAddress",
  "problemDescription",
] as const satisfies readonly z.infer<typeof CustomerIntakeFieldSchema>[];

export type CustomerIntakeState = z.infer<typeof CustomerIntakeStateSchema>;
export type CustomerIntakeField = z.infer<typeof CustomerIntakeFieldSchema>;
export type CustomerIntakeSnapshot = z.infer<
  typeof CustomerIntakeSnapshotSchema
>;
export type CustomerIntakePrompt = z.infer<typeof CustomerIntakePromptSchema>;
export type CustomerIntakeEvaluation = z.infer<
  typeof CustomerIntakeEvaluationSchema
>;
export type CustomerIntakeDetailParams = z.infer<
  typeof CustomerIntakeDetailParamsSchema
>;
export type CustomerIntakeDetailResponse = z.infer<
  typeof CustomerIntakeDetailResponseSchema
>;
