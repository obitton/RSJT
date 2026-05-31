import type { AppDb } from "@rsjt/db";
import { approvals, conversations, jobs, matchCandidates } from "@rsjt/db";
import {
  type ManagerDashboardJob,
  ManagerDashboardJobSchema,
  type ManagerDashboardResponse,
  ManagerDashboardResponseSchema,
  type ManagerJobDetailResponse,
  ManagerJobDetailResponseSchema,
  MatchConfidenceBandSchema,
  PendingApprovalSummarySchema,
  RepairShoprReferenceSchema,
  SelectedMatchSummarySchema,
  type TakeoverConversationSummary,
  TakeoverConversationSummarySchema,
} from "@rsjt/shared";
import { and, count, desc, eq, inArray, isNotNull } from "drizzle-orm";

const OPEN_STATES = ["intake", "accepted"] as const;
const SCHEDULED_STATES = ["scheduled"] as const;
const COMPLETED_STATES = ["completed"] as const;
const UNMATCHED_STATES = ["unmatched"] as const;
const PAYOUT_READY_STATES = ["payout_ready"] as const;

type JobRow = typeof jobs.$inferSelect;

export class ManagerDashboardRepository {
  constructor(private readonly db: AppDb) {}

  async getDashboard(): Promise<ManagerDashboardResponse> {
    const [
      openJobs,
      scheduledJobs,
      completedJobs,
      unmatchedJobs,
      payoutReadyJobs,
      takeoverConversations,
    ] = await Promise.all([
      this.listJobsForStates([...OPEN_STATES]),
      this.listJobsForStates([...SCHEDULED_STATES]),
      this.listJobsForStates([...COMPLETED_STATES]),
      this.listJobsForStates([...UNMATCHED_STATES]),
      this.listJobsForStates([...PAYOUT_READY_STATES]),
      this.listTakeoverConversations(),
    ]);

    return ManagerDashboardResponseSchema.parse({
      summary: {
        openCount: openJobs.length,
        scheduledCount: scheduledJobs.length,
        completedCount: completedJobs.length,
        unmatchedCount: unmatchedJobs.length,
        takeoverCount: takeoverConversations.length,
        payoutReadyCount: payoutReadyJobs.length,
      },
      groups: {
        openJobs,
        scheduledJobs,
        completedJobs,
        unmatchedJobs,
        payoutReadyJobs,
      },
      takeoverConversations,
    });
  }

  async getJobDetail(jobId: string): Promise<ManagerJobDetailResponse | null> {
    const [jobRow] = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!jobRow) {
      return null;
    }

    const [pendingApprovalRows, selectedMatchRow] = await Promise.all([
      this.db
        .select({
          id: approvals.id,
          kind: approvals.kind,
          risk: approvals.risk,
          requiredRole: approvals.requiredRole,
          updatedAt: approvals.updatedAt,
        })
        .from(approvals)
        .where(and(eq(approvals.jobId, jobId), eq(approvals.state, "pending")))
        .orderBy(desc(approvals.updatedAt)),
      this.db
        .select()
        .from(matchCandidates)
        .where(
          and(
            eq(matchCandidates.jobId, jobId),
            isNotNull(matchCandidates.selectedAt),
          ),
        )
        .limit(1),
    ]);

    const pendingApprovals = pendingApprovalRows.map((row) =>
      PendingApprovalSummarySchema.parse(row),
    );

    const job = toManagerDashboardJob(jobRow, pendingApprovals.length);
    const detail: ManagerJobDetailResponse = {
      job,
      pendingApprovals,
    };

    const matchRow = selectedMatchRow[0];
    if (matchRow) {
      detail.selectedMatch = SelectedMatchSummarySchema.parse({
        id: matchRow.id,
        confidence: matchRow.confidence / 10000,
        confidenceBand: MatchConfidenceBandSchema.parse(
          matchRow.confidenceBand,
        ),
        repairShoprReference: RepairShoprReferenceSchema.parse({
          entityType: matchRow.repairShoprEntityType,
          repairShoprId: matchRow.repairShoprId,
          displayLabel: matchRow.repairShoprDisplayLabel,
          ...(matchRow.repairShoprUrl ? { url: matchRow.repairShoprUrl } : {}),
        }),
      });
    }

    return ManagerJobDetailResponseSchema.parse(detail);
  }

  private async listJobsForStates(
    states: Array<JobRow["state"]>,
  ): Promise<ManagerDashboardJob[]> {
    if (states.length === 0) {
      return [];
    }

    const jobRows = await this.db
      .select()
      .from(jobs)
      .where(inArray(jobs.state, states))
      .orderBy(desc(jobs.updatedAt));

    if (jobRows.length === 0) {
      return [];
    }

    const jobIds = jobRows.map((row) => row.id);
    const [approvalCountRows, selectedMatchRows] = await Promise.all([
      this.db
        .select({
          jobId: approvals.jobId,
          count: count(approvals.id),
        })
        .from(approvals)
        .where(
          and(inArray(approvals.jobId, jobIds), eq(approvals.state, "pending")),
        )
        .groupBy(approvals.jobId),
      this.db
        .select({
          jobId: matchCandidates.jobId,
          confidenceBand: matchCandidates.confidenceBand,
        })
        .from(matchCandidates)
        .where(
          and(
            inArray(matchCandidates.jobId, jobIds),
            isNotNull(matchCandidates.selectedAt),
          ),
        ),
    ]);

    const approvalCountByJobId = new Map<string, number>();
    for (const row of approvalCountRows) {
      if (row.jobId) {
        approvalCountByJobId.set(row.jobId, Number(row.count));
      }
    }

    const matchBandByJobId = new Map<string, string>();
    for (const row of selectedMatchRows) {
      matchBandByJobId.set(row.jobId, row.confidenceBand);
    }

    return jobRows.map((row) => {
      const pendingApprovalCount = approvalCountByJobId.get(row.id) ?? 0;
      const matchBand = matchBandByJobId.get(row.id);
      const job = toManagerDashboardJob(row, pendingApprovalCount);

      if (matchBand) {
        return ManagerDashboardJobSchema.parse({
          ...job,
          selectedMatchConfidenceBand:
            MatchConfidenceBandSchema.parse(matchBand),
        });
      }

      return job;
    });
  }

  private async listTakeoverConversations(): Promise<
    TakeoverConversationSummary[]
  > {
    const rows = await this.db
      .select({
        id: conversations.id,
        externalPhone: conversations.externalPhone,
        takeoverActive: conversations.takeoverActive,
        takeoverStartedAt: conversations.takeoverStartedAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(eq(conversations.takeoverActive, true))
      .orderBy(desc(conversations.updatedAt));

    return rows.map((row) =>
      TakeoverConversationSummarySchema.parse({
        id: row.id,
        externalPhone: row.externalPhone,
        takeoverActive: row.takeoverActive,
        takeoverStartedAt: row.takeoverStartedAt,
        updatedAt: row.updatedAt,
      }),
    );
  }
}

function toManagerDashboardJob(
  row: JobRow,
  pendingApprovalCount: number,
): ManagerDashboardJob {
  const repairShoprReference =
    row.repairShoprEntityType && row.repairShoprId
      ? RepairShoprReferenceSchema.parse({
          entityType: row.repairShoprEntityType,
          repairShoprId: row.repairShoprId,
          displayLabel:
            row.customerLabel ??
            `${row.repairShoprEntityType} ${row.repairShoprId}`,
        })
      : undefined;

  return ManagerDashboardJobSchema.parse({
    id: row.id,
    state: row.state,
    updatedAt: row.updatedAt,
    pendingApprovalCount,
    ...(row.customerLabel ? { customerLabel: row.customerLabel } : {}),
    ...(repairShoprReference ? { repairShoprReference } : {}),
    ...(row.splitCategory ? { splitCategory: row.splitCategory } : {}),
    ...(row.grossChargeCents !== null
      ? { grossChargeCents: row.grossChargeCents }
      : {}),
    ...(row.reportedProfitCents !== null
      ? { reportedProfitCents: row.reportedProfitCents }
      : {}),
    ...(row.calculatedProfitCents !== null
      ? { calculatedProfitCents: row.calculatedProfitCents }
      : {}),
    ...(row.profitBasis ? { profitBasis: row.profitBasis } : {}),
  });
}
