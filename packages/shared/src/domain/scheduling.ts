import { z } from "zod";
import { SourceEvidenceSchema } from "./jobs.js";

export const SchedulingProposalStateSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired",
]);

export const SchedulingWindowSchema = z
  .object({
    startAt: z.date().nullable(),
    endAt: z.date().nullable(),
  })
  .refine(
    (value) => {
      if (!value.startAt || !value.endAt) {
        return true;
      }
      return value.endAt.getTime() >= value.startAt.getTime();
    },
    { message: "endAt must be greater than or equal to startAt" },
  );

const RepairShoprAppointmentPayloadSchema = z.object({
  customerLabel: z.string().min(1).optional(),
  proposedAt: z.string().min(1).optional(),
  durationMinutes: z.number().int().positive().optional(),
  notes: z.string().min(1).optional(),
  status: z.literal("staged"),
});

export const SchedulingProposalSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  jobId: z.string().uuid().nullable(),
  state: SchedulingProposalStateSchema,
  preferredWindowText: z.string().min(1),
  startAt: z.date().nullable(),
  endAt: z.date().nullable(),
  customerMessageBody: z.string().trim().min(1),
  repairShoprAppointmentPayload: RepairShoprAppointmentPayloadSchema,
  sourceEvidence: z.array(SourceEvidenceSchema).min(1),
  customerMessageApprovalId: z.string().uuid().nullable(),
  appointmentApprovalId: z.string().uuid().nullable(),
  decidedByUserId: z.string().uuid().nullable(),
  decidedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SchedulingProposalListResponseSchema = z.object({
  pending: z.array(SchedulingProposalSchema),
  decided: z.array(SchedulingProposalSchema),
});

export const SchedulingProposalDetailResponseSchema = z.object({
  proposal: SchedulingProposalSchema,
});

export const SchedulingProposalIdParamsSchema = z.object({
  proposalId: z.string().uuid(),
});

export const EditSchedulingProposalRequestSchema = z.object({
  preferredWindowText: z.string().trim().min(1).optional(),
  customerMessageBody: z.string().trim().min(1).optional(),
});

export const RejectSchedulingProposalRequestSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

export const SchedulingDecisionResponseSchema = z.object({
  proposal: SchedulingProposalSchema,
});

export const UNSAFE_COMMITMENT_PATTERNS: readonly RegExp[] = [
  /\bconfirmed\b/i,
  /\bbooked\b/i,
  /\bwe will be there\b/i,
  /\bwe'll be there\b/i,
  /\bsee you at\b/i,
  /\barriving at\b/i,
  /\bguarantee\b/i,
];

export function containsUnsafeCommitment(text: string) {
  return UNSAFE_COMMITMENT_PATTERNS.some((pattern) => pattern.test(text));
}

export type SchedulingProposalState = z.infer<
  typeof SchedulingProposalStateSchema
>;
export type SchedulingWindow = z.infer<typeof SchedulingWindowSchema>;
export type SchedulingProposal = z.infer<typeof SchedulingProposalSchema>;
export type SchedulingProposalListResponse = z.infer<
  typeof SchedulingProposalListResponseSchema
>;
export type SchedulingProposalDetailResponse = z.infer<
  typeof SchedulingProposalDetailResponseSchema
>;
export type SchedulingProposalIdParams = z.infer<
  typeof SchedulingProposalIdParamsSchema
>;
export type EditSchedulingProposalRequest = z.infer<
  typeof EditSchedulingProposalRequestSchema
>;
export type RejectSchedulingProposalRequest = z.infer<
  typeof RejectSchedulingProposalRequestSchema
>;
export type SchedulingDecisionResponse = z.infer<
  typeof SchedulingDecisionResponseSchema
>;
export type RepairShoprAppointmentPayload = z.infer<
  typeof RepairShoprAppointmentPayloadSchema
>;
