import { z } from "zod";

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

export type ApprovalState = z.infer<typeof ApprovalStateSchema>;
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>;
export type ApprovalRisk = z.infer<typeof ApprovalRiskSchema>;
