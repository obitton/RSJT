import { z } from "zod";
import { MatchConfidenceBandSchema, MatchReasonSchema } from "./confidence.js";
import {
  MoneyCentsSchema,
  ProfitBasisSchema,
  SplitCategorySchema,
} from "./money.js";
import { RepairShoprReferenceSchema } from "./repairshopr.js";

export const JobStateSchema = z.enum([
  "unmatched",
  "intake",
  "accepted",
  "scheduled",
  "completed",
  "payout_ready",
  "closed",
  "canceled",
]);

// Whether a job was converted from a lead conversation or created directly
// (walk-in, phone-in, import).
export const JobOriginSchema = z.enum(["lead", "manual"]);

export const ExtractedFactTypeSchema = z.enum([
  "customer_hint",
  "work_performed",
  "duration_minutes",
  "gross_charge_cents",
  "expense_cents",
  "reported_profit_cents",
  "completion_state",
  "scheduling_note",
  "follow_up_needed",
]);

export const SourceEvidenceSchema = z.object({
  messageId: z.string().uuid(),
  quote: z.string().min(1),
  startOffset: z.number().int().min(0).optional(),
  endOffset: z.number().int().min(0).optional(),
});

export const MatchCandidateSchema = z.object({
  id: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  confidenceBand: MatchConfidenceBandSchema,
  reasons: z.array(MatchReasonSchema),
  repairShoprReference: RepairShoprReferenceSchema,
});

export const JobSummarySchema = z.object({
  id: z.string().uuid(),
  state: JobStateSchema,
  customerLabel: z.string().min(1).optional(),
  splitCategory: SplitCategorySchema.optional(),
  grossChargeCents: MoneyCentsSchema.optional(),
  reportedProfitCents: MoneyCentsSchema.optional(),
  profitBasis: ProfitBasisSchema.optional(),
  repairShoprReference: RepairShoprReferenceSchema.optional(),
});

export const JobUpdateFeedResponseSchema = z.object({
  activeJobs: z.array(JobSummarySchema),
  unresolvedJobs: z.array(JobSummarySchema),
});

export type JobState = z.infer<typeof JobStateSchema>;
export type JobOrigin = z.infer<typeof JobOriginSchema>;
export type ExtractedFactType = z.infer<typeof ExtractedFactTypeSchema>;
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;
export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;
export type JobSummary = z.infer<typeof JobSummarySchema>;
export type JobUpdateFeedResponse = z.infer<typeof JobUpdateFeedResponseSchema>;
