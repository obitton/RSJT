import { randomUUID } from "node:crypto";
import {
  type AppDb,
  approvals,
  auditEvents,
  conversations,
  createDb,
  createPool,
  jobs,
  matchCandidates,
  users,
} from "@rsjt/db";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ManagerDashboardRepository } from "./manager-dashboard-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("ManagerDashboardRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: ManagerDashboardRepository;
  const createdJobIds: string[] = [];
  const createdConversationIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdApprovalIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new ManagerDashboardRepository(db);
  });

  afterEach(async () => {
    if (createdApprovalIds.length > 0) {
      await db
        .delete(auditEvents)
        .where(inArray(auditEvents.entityId, createdApprovalIds));
      await db
        .delete(approvals)
        .where(inArray(approvals.id, createdApprovalIds));
      createdApprovalIds.length = 0;
    }

    if (createdJobIds.length > 0) {
      await db
        .delete(matchCandidates)
        .where(inArray(matchCandidates.jobId, createdJobIds));
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      createdJobIds.length = 0;
    }

    if (createdConversationIds.length > 0) {
      await db
        .delete(conversations)
        .where(inArray(conversations.id, createdConversationIds));
      createdConversationIds.length = 0;
    }

    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("groups jobs by state and orders each group by updatedAt desc", async () => {
    const earlierAccepted = await createJob({
      state: "accepted",
      customerLabel: "Earlier accepted",
      updatedAt: new Date("2026-05-20T10:00:00.000Z"),
    });
    const laterAccepted = await createJob({
      state: "accepted",
      customerLabel: "Later accepted",
      updatedAt: new Date("2026-05-22T10:00:00.000Z"),
    });
    const scheduled = await createJob({
      state: "scheduled",
      customerLabel: "Scheduled work",
      updatedAt: new Date("2026-05-21T10:00:00.000Z"),
    });
    const unmatched = await createJob({
      state: "unmatched",
      customerLabel: "Unmatched walk-in",
      updatedAt: new Date("2026-05-22T11:00:00.000Z"),
    });
    const payoutReady = await createJob({
      state: "payout_ready",
      customerLabel: "Payout ready",
      updatedAt: new Date("2026-05-22T12:00:00.000Z"),
    });
    const closedJob = await createJob({
      state: "closed",
      customerLabel: "Closed job",
      updatedAt: new Date("2026-05-22T12:00:00.000Z"),
    });

    const dashboard = await repository.getDashboard();

    const openIds = dashboard.groups.openJobs.map((job) => job.id);
    expect(openIds).toEqual(
      expect.arrayContaining([earlierAccepted, laterAccepted]),
    );
    expect(openIds.indexOf(laterAccepted)).toBeLessThan(
      openIds.indexOf(earlierAccepted),
    );
    expect(dashboard.groups.scheduledJobs.map((job) => job.id)).toContain(
      scheduled,
    );
    expect(dashboard.groups.unmatchedJobs.map((job) => job.id)).toContain(
      unmatched,
    );
    expect(dashboard.groups.payoutReadyJobs.map((job) => job.id)).toContain(
      payoutReady,
    );
    expect(
      [
        ...dashboard.groups.openJobs,
        ...dashboard.groups.scheduledJobs,
        ...dashboard.groups.unmatchedJobs,
        ...dashboard.groups.completedJobs,
        ...dashboard.groups.payoutReadyJobs,
      ].map((job) => job.id),
    ).not.toContain(closedJob);
    expect(dashboard.summary.openCount).toBeGreaterThanOrEqual(2);
  });

  it("counts pending approvals per job and ignores decided approvals", async () => {
    const userId = await createUser("manager");
    const jobId = await createJob({
      state: "accepted",
      customerLabel: "Pending approvals job",
      updatedAt: new Date("2026-05-22T10:00:00.000Z"),
    });
    await createApproval(userId, jobId, "pending");
    await createApproval(userId, jobId, "pending");
    await createApproval(userId, jobId, "approved");

    const dashboard = await repository.getDashboard();
    const job = dashboard.groups.openJobs.find(
      (candidate) => candidate.id === jobId,
    );

    expect(job?.pendingApprovalCount).toBe(2);
  });

  it("surfaces takeover conversations only when active", async () => {
    const activeConversationId = await createConversation({
      takeoverActive: true,
      externalPhone: "+15555550100",
    });
    const inactiveConversationId = await createConversation({
      takeoverActive: false,
      externalPhone: "+15555550101",
    });

    const dashboard = await repository.getDashboard();
    const ids = dashboard.takeoverConversations.map((conv) => conv.id);

    expect(ids).toContain(activeConversationId);
    expect(ids).not.toContain(inactiveConversationId);
  });

  it("returns job detail with selected match and pending approvals", async () => {
    const userId = await createUser("manager");
    const jobId = await createJob({
      state: "accepted",
      customerLabel: "Detailed job",
      repairShoprEntityType: "ticket",
      repairShoprId: "local-ticket-301",
      grossChargeCents: 18000,
      updatedAt: new Date("2026-05-22T10:00:00.000Z"),
    });
    await createApproval(userId, jobId, "pending");

    const matchId = randomUUID();
    await db.insert(matchCandidates).values({
      id: matchId,
      jobId,
      repairShoprEntityType: "ticket",
      repairShoprId: "local-ticket-301",
      repairShoprDisplayLabel: "Detailed job",
      repairShoprUrl: null,
      confidence: 9000,
      confidenceBand: "high",
      reasons: [
        { label: "Phone match", detail: "Phone matches.", weight: 0.45 },
      ],
      selectedAt: new Date("2026-05-22T10:30:00.000Z"),
    });

    const detail = await repository.getJobDetail(jobId);
    expect(detail).not.toBeNull();
    expect(detail?.job.id).toBe(jobId);
    expect(detail?.job.pendingApprovalCount).toBe(1);
    expect(detail?.job.repairShoprReference?.repairShoprId).toBe(
      "local-ticket-301",
    );
    expect(detail?.pendingApprovals).toHaveLength(1);
    expect(detail?.selectedMatch?.confidenceBand).toBe("high");
    expect(detail?.selectedMatch?.confidence).toBeCloseTo(0.9, 5);
  });

  it("returns null when the job does not exist", async () => {
    const detail = await repository.getJobDetail(randomUUID());
    expect(detail).toBeNull();
  });

  async function createJob(input: typeof jobs.$inferInsert) {
    const id = input.id ?? randomUUID();
    createdJobIds.push(id);
    await db.insert(jobs).values({ ...input, id });
    return id;
  }

  async function createConversation(
    input: Partial<typeof conversations.$inferInsert>,
  ) {
    const id = input.id ?? randomUUID();
    createdConversationIds.push(id);
    await db.insert(conversations).values({ ...input, id });
    return id;
  }

  async function createUser(role: "manager" | "tech") {
    const id = randomUUID();
    createdUserIds.push(id);
    await db.insert(users).values({
      id,
      username: `${role}-${id}`,
      displayName: role === "manager" ? "Manager" : "Tech",
      role,
      passcodeHash: "hash",
    });
    return id;
  }

  async function createApproval(
    userId: string,
    jobId: string,
    state: "pending" | "approved" | "rejected" | "expired",
  ) {
    const id = randomUUID();
    createdApprovalIds.push(id);
    const evidence = [
      {
        messageId: randomUUID(),
        quote: "Stage approval",
      },
    ];
    await db.insert(approvals).values({
      id,
      jobId,
      kind: "customer_message",
      state,
      risk: "scheduling",
      requiredRole: "manager",
      originalPayload: { body: "Schedule tomorrow." },
      payload: { body: "Schedule tomorrow." },
      evidence,
      createdByUserId: userId,
    });
    return id;
  }
});
