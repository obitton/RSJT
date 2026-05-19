import { randomUUID } from "node:crypto";
import { type AppDb, createDb, createPool, jobs } from "@rsjt/db";
import type { MatchCandidate } from "@rsjt/shared";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MatchesRepository } from "./matches-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("MatchesRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: MatchesRepository;
  const createdJobIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new MatchesRepository(db);
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

  it("replaces candidates and clears the local job link", async () => {
    const jobId = await createJob({
      customerLabel: "Existing Reference",
      repairShoprEntityType: "customer",
      repairShoprId: "100",
    });
    const firstCandidate = candidate({
      entityType: "customer",
      repairShoprId: "101",
      displayLabel: "Fixture Customer",
    });
    const secondCandidate = candidate({
      entityType: "contact",
      repairShoprId: "202",
      displayLabel: "Fixture Contact",
    });

    await repository.replaceForJob(jobId, [firstCandidate]);
    await repository.selectForJob(jobId, firstCandidate.id);
    await repository.replaceForJob(jobId, [secondCandidate]);

    expect(await repository.listForJob(jobId)).toEqual([
      { ...secondCandidate, selectedAt: null },
    ]);
    await expectJobReference(jobId, {
      customerLabel: null,
      repairShoprEntityType: null,
      repairShoprId: null,
    });
  });

  it("selects exactly one candidate and mirrors the reference onto the job", async () => {
    const jobId = await createJob();
    const firstCandidate = candidate({
      entityType: "customer",
      repairShoprId: "101",
      displayLabel: "Fixture Customer",
    });
    const secondCandidate = candidate({
      entityType: "lead",
      repairShoprId: "303",
      displayLabel: "Fixture Lead",
      url: "https://example.repairshopr.com/api/v1/leads/303",
    });

    await repository.replaceForJob(jobId, [firstCandidate, secondCandidate]);

    await expect(
      repository.selectForJob(jobId, secondCandidate.id),
    ).resolves.toEqual(secondCandidate.repairShoprReference);

    const storedCandidates = await repository.listForJob(jobId);
    expect(storedCandidates).toHaveLength(2);
    expect(
      storedCandidates.find((item) => item.id === firstCandidate.id),
    ).toMatchObject({ selectedAt: null });
    expect(
      storedCandidates.find((item) => item.id === secondCandidate.id),
    ).toMatchObject({
      repairShoprReference: secondCandidate.repairShoprReference,
    });
    expect(
      storedCandidates.find((item) => item.id === secondCandidate.id)
        ?.selectedAt,
    ).toBeInstanceOf(Date);
    await expectJobReference(jobId, {
      customerLabel: "Fixture Lead",
      repairShoprEntityType: "lead",
      repairShoprId: "303",
    });
  });

  it("does not mutate the job when the selected candidate is unknown", async () => {
    const jobId = await createJob({
      customerLabel: "Existing Reference",
      repairShoprEntityType: "customer",
      repairShoprId: "100",
    });

    await expect(
      repository.selectForJob(jobId, randomUUID()),
    ).resolves.toBeNull();
    await expectJobReference(jobId, {
      customerLabel: "Existing Reference",
      repairShoprEntityType: "customer",
      repairShoprId: "100",
    });
  });

  it("clears a selected match from candidates and the job", async () => {
    const jobId = await createJob();
    const match = candidate({
      entityType: "customer",
      repairShoprId: "101",
      displayLabel: "Fixture Customer",
    });

    await repository.replaceForJob(jobId, [match]);
    await repository.selectForJob(jobId, match.id);
    await repository.clearSelection(jobId);

    expect(await repository.getSelectedReference(jobId)).toBeNull();
    expect(await repository.listForJob(jobId)).toEqual([
      { ...match, selectedAt: null },
    ]);
    await expectJobReference(jobId, {
      customerLabel: null,
      repairShoprEntityType: null,
      repairShoprId: null,
    });
  });

  async function createJob(
    values: {
      customerLabel?: string;
      repairShoprEntityType?: string;
      repairShoprId?: string;
    } = {},
  ) {
    const id = randomUUID();
    createdJobIds.push(id);
    await db.insert(jobs).values({ id, ...values });
    return id;
  }

  async function expectJobReference(
    jobId: string,
    expected: {
      customerLabel: string | null;
      repairShoprEntityType: string | null;
      repairShoprId: string | null;
    },
  ) {
    const [job] = await db
      .select({
        customerLabel: jobs.customerLabel,
        repairShoprEntityType: jobs.repairShoprEntityType,
        repairShoprId: jobs.repairShoprId,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    expect(job).toEqual(expected);
  }
});

function candidate(input: {
  entityType: MatchCandidate["repairShoprReference"]["entityType"];
  repairShoprId: string;
  displayLabel: string;
  url?: string;
}): MatchCandidate {
  return {
    id: randomUUID(),
    confidence: 0.82,
    confidenceBand: "medium_high",
    reasons: [
      {
        label: "Phone match",
        detail: "The last 10 digits match.",
        weight: 0.55,
      },
    ],
    repairShoprReference: {
      entityType: input.entityType,
      repairShoprId: input.repairShoprId,
      displayLabel: input.displayLabel,
      ...(input.url ? { url: input.url } : {}),
    },
  };
}
