import { randomUUID } from "node:crypto";
import { type AppDb, createDb, createPool, jobs } from "@rsjt/db";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { JobsRepository } from "./jobs-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("JobsRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: JobsRepository;
  const createdJobIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new JobsRepository(db);
  });

  afterEach(async () => {
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      createdJobIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("lists accepted and scheduled jobs as active update work", async () => {
    const acceptedId = await createJob({
      state: "accepted",
      customerLabel: "Active accepted job",
      updatedAt: new Date("2026-05-20T12:00:00.000Z"),
    });
    const scheduledId = await createJob({
      state: "scheduled",
      customerLabel: "Active scheduled job",
      updatedAt: new Date("2026-05-21T12:00:00.000Z"),
    });
    const completedId = await createJob({
      state: "completed",
      customerLabel: "Completed job",
      updatedAt: new Date("2026-05-22T12:00:00.000Z"),
    });

    const activeJobs = await repository.listActiveForUpdates();

    expect(activeJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: acceptedId, state: "accepted" }),
        expect.objectContaining({ id: scheduledId, state: "scheduled" }),
      ]),
    );
    expect(activeJobs.map((job) => job.id)).not.toContain(completedId);
    expect(activeJobs.findIndex((job) => job.id === scheduledId)).toBeLessThan(
      activeJobs.findIndex((job) => job.id === acceptedId),
    );
  });

  it("lists unmatched and intake jobs as unresolved update work", async () => {
    const unmatchedId = await createJob({
      state: "unmatched",
      customerLabel: "Unmatched job",
      updatedAt: new Date("2026-05-20T12:00:00.000Z"),
    });
    const intakeId = await createJob({
      state: "intake",
      customerLabel: "Intake job",
      updatedAt: new Date("2026-05-21T12:00:00.000Z"),
    });
    const closedId = await createJob({
      state: "closed",
      customerLabel: "Closed job",
      updatedAt: new Date("2026-05-22T12:00:00.000Z"),
    });

    const unresolvedJobs = await repository.listUnresolvedForUpdates();

    expect(unresolvedJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: unmatchedId, state: "unmatched" }),
        expect.objectContaining({ id: intakeId, state: "intake" }),
      ]),
    );
    expect(unresolvedJobs.map((job) => job.id)).not.toContain(closedId);
  });

  it("maps complete RepairShopr references into summaries", async () => {
    const linkedId = await createJob({
      state: "accepted",
      customerLabel: "Linked job",
      repairShoprEntityType: "ticket",
      repairShoprId: "linked-ticket",
      updatedAt: new Date("2026-05-20T12:00:00.000Z"),
    });
    const partialId = await createJob({
      state: "accepted",
      customerLabel: "Partial reference job",
      repairShoprEntityType: "ticket",
      updatedAt: new Date("2026-05-21T12:00:00.000Z"),
    });

    const activeJobs = await repository.listActiveForUpdates();
    const linkedJob = activeJobs.find((job) => job.id === linkedId);
    const partialJob = activeJobs.find((job) => job.id === partialId);

    expect(linkedJob?.repairShoprReference).toEqual({
      entityType: "ticket",
      repairShoprId: "linked-ticket",
      displayLabel: "Linked job",
    });
    expect(partialJob?.repairShoprReference).toBeUndefined();
  });

  async function createJob(input: typeof jobs.$inferInsert) {
    const id = input.id ?? randomUUID();
    createdJobIds.push(id);
    await db.insert(jobs).values({ ...input, id });
    return id;
  }
});
