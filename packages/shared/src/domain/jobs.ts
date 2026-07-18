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

// A job can be canceled only while it is still active work. Once it has been
// completed, made payout-ready, closed, or already canceled, cancelling no
// longer makes sense and is rejected.
export const CANCELABLE_JOB_STATES = [
  "unmatched",
  "intake",
  "accepted",
  "scheduled",
] as const;

export function isCancelableJobState(
  state: z.infer<typeof JobStateSchema>,
): boolean {
  return (CANCELABLE_JOB_STATES as readonly string[]).includes(state);
}

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
  // Present only on a canceled job: the reason a tech or manager gave, and when
  // it was canceled.
  cancelReason: z.string().min(1).optional(),
  canceledAt: z.date().optional(),
});

// Cancelling a job requires a short reason. Both techs and managers can cancel.
export const CancelJobRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const CancelJobResponseSchema = z.object({
  job: JobSummarySchema,
});

export const JobUpdateFeedResponseSchema = z.object({
  activeJobs: z.array(JobSummarySchema),
  unresolvedJobs: z.array(JobSummarySchema),
});

export type JobState = z.infer<typeof JobStateSchema>;
export type JobOrigin = z.infer<typeof JobOriginSchema>;
export type CancelJobRequest = z.infer<typeof CancelJobRequestSchema>;
export type CancelJobResponse = z.infer<typeof CancelJobResponseSchema>;
export type ExtractedFactType = z.infer<typeof ExtractedFactTypeSchema>;
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;
export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;
export type JobSummary = z.infer<typeof JobSummarySchema>;
export type JobUpdateFeedResponse = z.infer<typeof JobUpdateFeedResponseSchema>;
