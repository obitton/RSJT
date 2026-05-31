import { randomUUID } from "node:crypto";
import {
  type AppDb,
  approvals,
  auditEvents,
  createDb,
  createPool,
  jobs,
  users,
} from "@rsjt/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApprovalsRepository } from "./approvals-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("ApprovalsRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: ApprovalsRepository;
  const createdApprovalIds: string[] = [];
  const createdJobIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new ApprovalsRepository(db);
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
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      createdJobIds.length = 0;
    }

    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a staged approval and writes an audit event", async () => {
    const userId = await createUser("manager");
    const jobId = await createJob();

    const approval = await createApproval(userId, jobId, {
      requiredRole: "manager",
      payload: { body: "Schedule tomorrow." },
    });

    expect(approval).toMatchObject({
      jobId,
      kind: "customer_message",
      state: "pending",
      risk: "scheduling",
      requiredRole: "manager",
      payload: { body: "Schedule tomorrow." },
      originalPayload: { body: "Schedule tomorrow." },
      createdByUserId: userId,
      decidedByUserId: null,
      decidedAt: null,
    });
    await expectAuditActions(approval.id, ["approval_created"]);
  });

  it("edits pending payloads without changing the original proposal", async () => {
    const userId = await createUser("manager");
    const jobId = await createJob();
    const approval = await createApproval(userId, jobId, {
      payload: { body: "Schedule tomorrow." },
    });

    const editedApproval = await repository.editPending(approval.id, userId, {
      body: "Schedule between 2 and 4.",
    });

    expect(editedApproval).toMatchObject({
      id: approval.id,
      state: "pending",
      originalPayload: { body: "Schedule tomorrow." },
      payload: { body: "Schedule between 2 and 4." },
    });
    await expectAuditActions(approval.id, [
      "approval_created",
      "approval_edited",
    ]);
  });

  it("filters approvals by state, risk, kind, job, and required role", async () => {
    const userId = await createUser("manager");
    const firstJobId = await createJob();
    const secondJobId = await createJob();
    const firstApproval = await createApproval(userId, firstJobId, {
      requiredRole: "manager",
      risk: "scheduling",
      kind: "customer_message",
    });
    await createApproval(userId, secondJobId, {
      requiredRole: "tech",
      risk: "money",
      kind: "payout_finalization",
    });

    await expect(
      repository.list({
        state: "pending",
        risk: "scheduling",
        kind: "customer_message",
        jobId: firstJobId,
        requiredRole: "manager",
      }),
    ).resolves.toEqual([firstApproval]);
  });

  it("sets decision state only while approvals are pending", async () => {
    const userId = await createUser("manager");
    const jobId = await createJob();
    const approval = await createApproval(userId, jobId);

    const approved = await repository.setState(approval.id, "approved", userId);
    const secondDecision = await repository.setState(
      approval.id,
      "rejected",
      userId,
    );

    expect(approved).toMatchObject({
      id: approval.id,
      state: "approved",
      decidedByUserId: userId,
      decidedAt: expect.any(Date),
    });
    expect(secondDecision).toBeNull();
    await expectAuditActions(approval.id, [
      "approval_created",
      "approval_approved",
    ]);
  });

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

  async function createJob() {
    const id = randomUUID();
    createdJobIds.push(id);
    await db.insert(jobs).values({ id });
    return id;
  }

  async function createApproval(
    userId: string,
    jobId: string,
    overrides: Partial<{
      kind: "customer_message" | "payout_finalization";
      risk: "scheduling" | "money";
      requiredRole: "manager" | "tech";
      payload: Record<string, unknown>;
    }> = {},
  ) {
    const approval = await repository.create({
      jobId,
      kind: overrides.kind ?? "customer_message",
      risk: overrides.risk ?? "scheduling",
      requiredRole: overrides.requiredRole ?? "manager",
      payload: overrides.payload ?? { body: "Schedule tomorrow." },
      evidence: [
        {
          messageId: randomUUID(),
          quote: "Schedule tomorrow.",
        },
      ],
      createdByUserId: userId,
    });
    createdApprovalIds.push(approval.id);
    return approval;
  }

  async function expectAuditActions(approvalId: string, expected: string[]) {
    const events = await db
      .select({ action: auditEvents.action })
      .from(auditEvents)
      .where(eq(auditEvents.entityId, approvalId));

    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining(expected),
    );
    expect(events).toHaveLength(expected.length);
  }
});
