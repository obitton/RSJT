import { randomUUID } from "node:crypto";
import {
  type AppDb,
  approvals,
  auditEvents,
  createDb,
  createPool,
  jobs,
  users,
  writebackExecutions,
} from "@rsjt/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { WritebackExecutionsRepository } from "./writeback-executions-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("WritebackExecutionsRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: WritebackExecutionsRepository;
  const createdExecutionIds: string[] = [];
  const createdApprovalIds: string[] = [];
  const createdJobIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new WritebackExecutionsRepository(db);
  });

  afterEach(async () => {
    if (createdExecutionIds.length > 0) {
      await db
        .delete(auditEvents)
        .where(inArray(auditEvents.entityId, createdExecutionIds));
      await db
        .delete(writebackExecutions)
        .where(inArray(writebackExecutions.id, createdExecutionIds));
      createdExecutionIds.length = 0;
    }

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

  it("creates one ready execution per approved approval", async () => {
    const userId = await createUser();
    const jobId = await createJob();
    const approvalId = await createApproval(userId, jobId);

    const execution = await createExecution(approvalId, jobId);
    const secondExecution = await createExecution(approvalId, jobId);

    expect(execution).toMatchObject({
      approvalId,
      jobId,
      kind: "repairshopr_writeback",
      state: "ready",
      targetKind: "repairshopr",
      action: "lead_create",
      attemptCount: 0,
    });
    expect(secondExecution.id).toBe(execution.id);
    await expectAuditActions(execution.id, ["writeback_ready"]);
  });

  it("lists executions by state, approval, and job", async () => {
    const userId = await createUser();
    const firstJobId = await createJob();
    const secondJobId = await createJob();
    const firstApprovalId = await createApproval(userId, firstJobId);
    const secondApprovalId = await createApproval(userId, secondJobId);
    const firstExecution = await createExecution(firstApprovalId, firstJobId);
    await createExecution(secondApprovalId, secondJobId);

    await expect(
      repository.list({
        state: "ready",
        approvalId: firstApprovalId,
        jobId: firstJobId,
      }),
    ).resolves.toEqual([firstExecution]);
  });

  it("tracks attempts, success state, and returned RepairShopr IDs", async () => {
    const userId = await createUser();
    const jobId = await createJob();
    const approvalId = await createApproval(userId, jobId);
    const execution = await createExecution(approvalId, jobId);

    const started = await repository.markAttemptStarted({
      executionId: execution.id,
      actorUserId: userId,
    });
    const succeeded = await repository.markSucceeded({
      executionId: execution.id,
      actorUserId: userId,
      responsePayload: { id: 901 },
      repairShoprEntityType: "lead",
      repairShoprId: "901",
    });

    expect(started).toMatchObject({
      id: execution.id,
      attemptCount: 1,
      executedByUserId: userId,
    });
    expect(succeeded).toMatchObject({
      id: execution.id,
      state: "succeeded",
      responsePayload: { id: 901 },
      repairShoprEntityType: "lead",
      repairShoprId: "901",
      succeededAt: expect.any(Date),
    });
    await expectAuditActions(execution.id, [
      "writeback_ready",
      "writeback_attempt_started",
      "writeback_succeeded",
    ]);
  });

  it("tracks failed and blocked states for retries", async () => {
    const userId = await createUser();
    const jobId = await createJob();
    const approvalId = await createApproval(userId, jobId);
    const execution = await createExecution(approvalId, jobId);

    const failed = await repository.markFailed({
      executionId: execution.id,
      actorUserId: userId,
      errorMessage: "RepairShopr unavailable",
    });
    const blocked = await repository.markBlocked({
      executionId: execution.id,
      actorUserId: userId,
      errorMessage: "RepairShopr writes disabled",
    });

    expect(failed).toMatchObject({
      state: "failed",
      errorMessage: "RepairShopr unavailable",
    });
    expect(blocked).toMatchObject({
      state: "blocked",
      errorMessage: "RepairShopr writes disabled",
    });
  });

  async function createUser() {
    const id = randomUUID();
    createdUserIds.push(id);
    await db.insert(users).values({
      id,
      username: `manager-${id}`,
      displayName: "Manager",
      role: "manager",
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

  async function createApproval(userId: string, jobId: string) {
    const id = randomUUID();
    createdApprovalIds.push(id);
    await db.insert(approvals).values({
      id,
      jobId,
      kind: "repairshopr_writeback",
      state: "approved",
      risk: "crm_writeback",
      requiredRole: "manager",
      originalPayload: leadPayload(),
      payload: leadPayload(),
      evidence: [{ messageId: randomUUID(), quote: "New lead" }],
      createdByUserId: userId,
      decidedByUserId: userId,
      decidedAt: new Date(),
    });
    return id;
  }

  async function createExecution(approvalId: string, jobId: string) {
    const execution = await repository.ensureReadyForApproval({
      approvalId,
      jobId,
      kind: "repairshopr_writeback",
      targetKind: "repairshopr",
      action: "lead_create",
      requestPayload: leadPayload(),
    });
    if (!createdExecutionIds.includes(execution.id)) {
      createdExecutionIds.push(execution.id);
    }
    return execution;
  }

  function leadPayload() {
    return {
      action: "lead_create" as const,
      target: { entityType: "lead" as const, displayLabel: "New lead" },
      repairShoprPayload: { first_name: "Casey" },
    };
  }

  async function expectAuditActions(executionId: string, expected: string[]) {
    const events = await db
      .select({ action: auditEvents.action })
      .from(auditEvents)
      .where(eq(auditEvents.entityId, executionId));

    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining(expected),
    );
    expect(events).toHaveLength(expected.length);
  }
});
