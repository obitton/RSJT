import { z } from "zod";

export const MatchConfidenceBandSchema = z.enum(["low", "medium_high", "high"]);

export const MatchConfidenceThresholds = {
  mediumHigh: 0.7,
  high: 0.85,
} as const;

export const MatchReasonSchema = z.object({
  label: z.string().min(1),
  detail: z.string().min(1),
  weight: z.number().min(0).max(1),
});

export type MatchConfidenceBand = z.infer<typeof MatchConfidenceBandSchema>;
export type MatchReason = z.infer<typeof MatchReasonSchema>;
