import type { AppDb } from "@rsjt/db";
import {
  approvals,
  conversations,
  jobs,
  matchCandidates,
  messages,
} from "@rsjt/db";
import {
  type LeadDetail,
  LeadDetailSchema,
  type LeadSummary,
  LeadSummarySchema,
  type ManagerDashboardJob,
  ManagerDashboardJobSchema,
  type ManagerDashboardResponse,
  ManagerDashboardResponseSchema,
  type ManagerJobDetailResponse,
  ManagerJobDetailResponseSchema,
  type ManagerLeadDetailResponse,
  ManagerLeadDetailResponseSchema,
  MatchConfidenceBandSchema,
  PendingApprovalSummarySchema,
  RepairShoprReferenceSchema,
  SelectedMatchSummarySchema,
  type TakeoverConversationSummary,
  TakeoverConversationSummarySchema,
} from "@rsjt/shared";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  ne,
  notExists,
} from "drizzle-orm";

const OPEN_STATES = ["intake", "accepted"] as const;
const SCHEDULED_STATES = ["scheduled"] as const;
const COMPLETED_STATES = ["completed"] as const;
const UNMATCHED_STATES = ["unmatched"] as const;
const PAYOUT_READY_STATES = ["payout_ready"] as const;
// Dedicated in-repair job state is introduced in REV01 slice 7; until then this
// list is empty so the repair count reads 0 instead of a faked number.
const REPAIR_STATES = [] as const;

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
      repairJobs,
      takeoverConversations,
      leads,
    ] = await Promise.all([
      this.listJobsForStates([...OPEN_STATES]),
      this.listJobsForStates([...SCHEDULED_STATES]),
      this.listJobsForStates([...COMPLETED_STATES]),
      this.listJobsForStates([...UNMATCHED_STATES]),
      this.listJobsForStates([...PAYOUT_READY_STATES]),
      this.listJobsForStates([...REPAIR_STATES]),
      this.listTakeoverConversations(),
      this.listLeads(),
    ]);

    const workingOnCount = leads.filter((lead) => lead.takeoverActive).length;

    return ManagerDashboardResponseSchema.parse({
      summary: {
        leadsCount: leads.length,
        needsTechAnswerCount: leads.length - workingOnCount,
        workingOnCount,
        jobsCount: scheduledJobs.length + repairJobs.length,
        repairCount: repairJobs.length,
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
      leads,
      takeoverConversations,
    });
  }

  async getLeadDetail(
    conversationId: string,
  ): Promise<ManagerLeadDetailResponse | null> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!row) {
      return null;
    }

    return ManagerLeadDetailResponseSchema.parse({ lead: toLeadDetail(row) });
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

  // A conversation that has already been converted to a job is no longer a
  // lead, so it drops off the lead surfaces and lives on the jobs side instead.
  private notConvertedToJob() {
    return notExists(
      this.db
        .select({ id: jobs.id })
        .from(jobs)
        .where(eq(jobs.conversationId, conversations.id)),
    );
  }

  private async listLeads(): Promise<LeadSummary[]> {
    // A lead is any conversation that is not blocked and has not yet become a
    // job. Spam is folded into the blocked intake state, so excluding "blocked"
    // excludes spam too.
    const rows = await this.db
      .select()
      .from(conversations)
      .where(
        and(ne(conversations.intakeState, "blocked"), this.notConvertedToJob()),
      )
      .orderBy(desc(conversations.updatedAt));

    if (rows.length === 0) {
      return [];
    }

    const previewMap = await this.lastInboundPreviews(
      rows.map((row) => row.id),
    );

    return rows.map((row) =>
      LeadSummarySchema.parse({
        id: row.id,
        label: leadLabel(row),
        externalPhone: row.externalPhone,
        intakeState: row.intakeState,
        takeoverActive: row.takeoverActive,
        lastInboundPreview: previewMap.get(row.id) ?? null,
        updatedAt: row.updatedAt,
      }),
    );
  }

  private async lastInboundPreviews(conversationIds: string[]) {
    const map = new Map<string, string>();
    if (conversationIds.length === 0) {
      return map;
    }

    const inboundRows = await this.db
      .select({
        conversationId: messages.conversationId,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.conversationId, conversationIds),
          eq(messages.direction, "inbound"),
          isNotNull(messages.conversationId),
        ),
      )
      .orderBy(desc(messages.createdAt));

    for (const row of inboundRows) {
      if (row.conversationId && !map.has(row.conversationId)) {
        map.set(row.conversationId, row.body.slice(0, 120));
      }
    }
    return map;
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
      .where(
        and(eq(conversations.takeoverActive, true), this.notConvertedToJob()),
      )
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

type ConversationRow = typeof conversations.$inferSelect;

function leadLabel(row: ConversationRow): string {
  // Use the matched customer name when known, otherwise fall back to the phone
  // number, so an unmatched lead is still identifiable.
  return (
    row.customerName ??
    row.matchedRepairShoprDisplayLabel ??
    row.externalPhone ??
    "Unknown sender"
  );
}

function toLeadDetail(row: ConversationRow): LeadDetail {
  const matchedReference =
    row.matchedRepairShoprEntityType && row.matchedRepairShoprId
      ? RepairShoprReferenceSchema.parse({
          entityType: row.matchedRepairShoprEntityType,
          repairShoprId: row.matchedRepairShoprId,
          displayLabel:
            row.matchedRepairShoprDisplayLabel ??
            `${row.matchedRepairShoprEntityType} ${row.matchedRepairShoprId}`,
        })
      : null;

  return LeadDetailSchema.parse({
    id: row.id,
    label: leadLabel(row),
    externalPhone: row.externalPhone,
    intakeState: row.intakeState,
    takeoverActive: row.takeoverActive,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    serviceAddress: row.serviceAddress,
    problemDescription: row.problemDescription,
    preferredTiming: row.preferredTiming,
    matchedReference,
    lastInboundAt: row.lastInboundAt,
    updatedAt: row.updatedAt,
  });
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
    origin: row.origin,
    updatedAt: row.updatedAt,
    pendingApprovalCount,
    ...(row.conversationId ? { conversationId: row.conversationId } : {}),
    ...(row.originNote ? { originNote: row.originNote } : {}),
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
