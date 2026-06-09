import { z } from "zod";
import { ApprovalKindSchema, ApprovalRiskSchema } from "./approvals.js";
import { MatchConfidenceBandSchema } from "./confidence.js";
import { CustomerIntakeStateSchema } from "./intake.js";
import { JobStateSchema } from "./jobs.js";
import {
  MoneyCentsSchema,
  ProfitBasisSchema,
  SplitCategorySchema,
} from "./money.js";
import { RepairShoprReferenceSchema } from "./repairshopr.js";
import { UserRoleSchema } from "./users.js";

export const ManagerDashboardSummarySchema = z.object({
  // LEADS field (conversations that are not blocked/spam).
  leadsCount: z.number().int().min(0),
  needsTechAnswerCount: z.number().int().min(0),
  workingOnCount: z.number().int().min(0),
  // JOBS field (leads confirmed and scheduled).
  jobsCount: z.number().int().min(0),
  repairCount: z.number().int().min(0),
  // Existing job-state counts, still used by the group browser below the strip.
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

// A Lead is a conversation that has not been blocked as spam. It may or may not
// have been turned into a Job yet.
export const LeadSummarySchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  externalPhone: z.string().min(1).nullable(),
  intakeState: CustomerIntakeStateSchema,
  takeoverActive: z.boolean(),
  lastInboundPreview: z.string().min(1).nullable(),
  updatedAt: z.date(),
});

export const LeadDetailSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  externalPhone: z.string().min(1).nullable(),
  intakeState: CustomerIntakeStateSchema,
  takeoverActive: z.boolean(),
  customerName: z.string().min(1).nullable(),
  customerEmail: z.string().min(1).nullable(),
  serviceAddress: z.string().min(1).nullable(),
  problemDescription: z.string().min(1).nullable(),
  preferredTiming: z.string().min(1).nullable(),
  matchedReference: RepairShoprReferenceSchema.nullable(),
  lastInboundAt: z.date().nullable(),
  updatedAt: z.date(),
});

export const ManagerLeadDetailParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

export const ManagerLeadDetailResponseSchema = z.object({
  lead: LeadDetailSchema,
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
  leads: z.array(LeadSummarySchema),
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
export type LeadSummary = z.infer<typeof LeadSummarySchema>;
export type LeadDetail = z.infer<typeof LeadDetailSchema>;
export type ManagerLeadDetailParams = z.infer<
  typeof ManagerLeadDetailParamsSchema
>;
export type ManagerLeadDetailResponse = z.infer<
  typeof ManagerLeadDetailResponseSchema
>;
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
