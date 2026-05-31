import { z } from "zod";
import { SourceEvidenceSchema } from "./jobs.js";
import { UserRoleSchema } from "./users.js";

export const ApprovalStateSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
  "failed",
]);

export const ApprovalKindSchema = z.enum([
  "repairshopr_writeback",
  "customer_message",
  "appointment_creation",
  "manager_override",
  "payout_finalization",
]);

export const ApprovalRiskSchema = z.enum([
  "customer_identity",
  "money",
  "scheduling",
  "crm_writeback",
  "low",
]);

export const ApprovalIdParamsSchema = z.object({
  approvalId: z.string().uuid(),
});

export const ApprovalPayloadSchema = z.record(z.unknown());

export const CreateApprovalRequestSchema = z.object({
  jobId: z.string().uuid().optional(),
  kind: ApprovalKindSchema,
  risk: ApprovalRiskSchema,
  requiredRole: UserRoleSchema,
  payload: ApprovalPayloadSchema,
  evidence: z.array(SourceEvidenceSchema).min(1),
});

export const ApprovalFilterQuerySchema = z.object({
  state: ApprovalStateSchema.optional(),
  risk: ApprovalRiskSchema.optional(),
  kind: ApprovalKindSchema.optional(),
  jobId: z.string().uuid().optional(),
  requiredRole: UserRoleSchema.optional(),
});

export const EditApprovalRequestSchema = z.object({
  payload: ApprovalPayloadSchema,
});

export const RejectApprovalRequestSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

export const ApprovalRecordSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid().nullable(),
  kind: ApprovalKindSchema,
  state: ApprovalStateSchema,
  risk: ApprovalRiskSchema,
  requiredRole: UserRoleSchema,
  payload: ApprovalPayloadSchema,
  originalPayload: ApprovalPayloadSchema,
  evidence: z.array(SourceEvidenceSchema),
  createdByUserId: z.string().uuid().nullable(),
  decidedByUserId: z.string().uuid().nullable(),
  decidedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ApprovalListResponseSchema = z.object({
  approvals: z.array(ApprovalRecordSchema),
});

export const ApprovalDecisionResponseSchema = z.object({
  approval: ApprovalRecordSchema,
});

export type ApprovalState = z.infer<typeof ApprovalStateSchema>;
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>;
export type ApprovalRisk = z.infer<typeof ApprovalRiskSchema>;
export type ApprovalPayload = z.infer<typeof ApprovalPayloadSchema>;
export type CreateApprovalRequest = z.infer<typeof CreateApprovalRequestSchema>;
export type ApprovalFilterQuery = z.infer<typeof ApprovalFilterQuerySchema>;
export type EditApprovalRequest = z.infer<typeof EditApprovalRequestSchema>;
export type RejectApprovalRequest = z.infer<typeof RejectApprovalRequestSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type ApprovalListResponse = z.infer<typeof ApprovalListResponseSchema>;
export type ApprovalDecisionResponse = z.infer<
  typeof ApprovalDecisionResponseSchema
>;
