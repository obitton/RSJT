import { z } from "zod";
import { ApprovalKindSchema, ApprovalRiskSchema } from "./approvals.js";
import { MatchConfidenceBandSchema } from "./confidence.js";
import { JobStateSchema } from "./jobs.js";
import {
  MoneyCentsSchema,
  ProfitBasisSchema,
  SplitCategorySchema,
} from "./money.js";
import { RepairShoprReferenceSchema } from "./repairshopr.js";
import { UserRoleSchema } from "./users.js";

export const ManagerDashboardSummarySchema = z.object({
  openCount: z.number().int().min(0),
  scheduledCount: z.number().int().min(0),
  completedCount: z.number().int().min(0),
  unmatchedCount: z.number().int().min(0),
  takeoverCount: z.number().int().min(0),
  payoutReadyCount: z.number().int().min(0),
});

export const ManagerDashboardJobSchema = z.object({
  id: z.string().uuid(),
  state: JobStateSchema,
  customerLabel: z.string().min(1).optional(),
  updatedAt: z.date(),
  repairShoprReference: RepairShoprReferenceSchema.optional(),
  splitCategory: SplitCategorySchema.optional(),
  grossChargeCents: MoneyCentsSchema.optional(),
  reportedProfitCents: MoneyCentsSchema.optional(),
  calculatedProfitCents: MoneyCentsSchema.optional(),
  profitBasis: ProfitBasisSchema.optional(),
  pendingApprovalCount: z.number().int().min(0),
  selectedMatchConfidenceBand: MatchConfidenceBandSchema.optional(),
});

export const TakeoverConversationSummarySchema = z.object({
  id: z.string().uuid(),
  externalPhone: z.string().min(1).nullable(),
  takeoverActive: z.boolean(),
  takeoverStartedAt: z.date().nullable(),
  updatedAt: z.date(),
});

export const ManagerDashboardGroupsSchema = z.object({
  openJobs: z.array(ManagerDashboardJobSchema),
  scheduledJobs: z.array(ManagerDashboardJobSchema),
  completedJobs: z.array(ManagerDashboardJobSchema),
  unmatchedJobs: z.array(ManagerDashboardJobSchema),
  payoutReadyJobs: z.array(ManagerDashboardJobSchema),
});

export const ManagerDashboardResponseSchema = z.object({
  summary: ManagerDashboardSummarySchema,
  groups: ManagerDashboardGroupsSchema,
  takeoverConversations: z.array(TakeoverConversationSummarySchema),
});

export const ManagerJobDetailParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const PendingApprovalSummarySchema = z.object({
  id: z.string().uuid(),
  kind: ApprovalKindSchema,
  risk: ApprovalRiskSchema,
  requiredRole: UserRoleSchema,
  updatedAt: z.date(),
});

export const SelectedMatchSummarySchema = z.object({
  id: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  confidenceBand: MatchConfidenceBandSchema,
  repairShoprReference: RepairShoprReferenceSchema,
});

export const ManagerJobDetailResponseSchema = z.object({
  job: ManagerDashboardJobSchema,
  pendingApprovals: z.array(PendingApprovalSummarySchema),
  selectedMatch: SelectedMatchSummarySchema.optional(),
});

export type ManagerDashboardSummary = z.infer<
  typeof ManagerDashboardSummarySchema
>;
export type ManagerDashboardJob = z.infer<typeof ManagerDashboardJobSchema>;
export type TakeoverConversationSummary = z.infer<
  typeof TakeoverConversationSummarySchema
>;
export type ManagerDashboardGroups = z.infer<
  typeof ManagerDashboardGroupsSchema
>;
export type ManagerDashboardResponse = z.infer<
  typeof ManagerDashboardResponseSchema
>;
export type ManagerJobDetailParams = z.infer<
  typeof ManagerJobDetailParamsSchema
>;
export type PendingApprovalSummary = z.infer<
  typeof PendingApprovalSummarySchema
>;
export type SelectedMatchSummary = z.infer<typeof SelectedMatchSummarySchema>;
export type ManagerJobDetailResponse = z.infer<
  typeof ManagerJobDetailResponseSchema
>;
