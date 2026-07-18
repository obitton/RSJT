import { randomUUID } from "node:crypto";
import { type AppDb, createDb, createPool, jobs, users } from "@rsjt/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { JobCancellationRepository } from "./job-cancellation-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("JobCancellationRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: JobCancellationRepository;
  const createdJobIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new JobCancellationRepository(db);
  });

  afterEach(async () => {
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

  it("returns null when the job does not exist", async () => {
    expect(await repository.getJobForCancellation(randomUUID())).toBeNull();
  });

  it("cancels an active job and records the reason, time, and user", async () => {
    const userId = await createUser();
    const jobId = await createScheduledJob();

    const cancelable = await repository.getJobForCancellation(jobId);
    expect(cancelable).toEqual({ id: jobId, state: "scheduled" });

    const job = await repository.cancelJob({
      jobId,
      reason: "Customer replaced the device",
      canceledByUserId: userId,
    });

    expect(job.state).toBe("canceled");
    expect(job.cancelReason).toBe("Customer replaced the device");
    expect(job.canceledAt).toBeInstanceOf(Date);

    const [row] = await db
      .select({
        state: jobs.state,
        cancelReason: jobs.cancelReason,
        canceledAt: jobs.canceledAt,
        canceledByUserId: jobs.canceledByUserId,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    expect(row?.state).toBe("canceled");
    expect(row?.cancelReason).toBe("Customer replaced the device");
    expect(row?.canceledAt).toBeInstanceOf(Date);
    expect(row?.canceledByUserId).toBe(userId);
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

  async function createScheduledJob() {
    const id = randomUUID();
    createdJobIds.push(id);
    await db.insert(jobs).values({
      id,
      origin: "manual",
      state: "scheduled",
      customerLabel: "Cancelable job",
    });
    return id;
  }
});
