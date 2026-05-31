import { randomUUID } from "node:crypto";
import { type AppDb, createDb, createPool, jobs, messages } from "@rsjt/db";
import { type ExtractedFact, ExtractedFactSchema } from "@rsjt/shared";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ExtractedFactsRepository } from "./extracted-facts-repository.js";
import { MessagesRepository } from "./messages-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("ExtractedFactsRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let factsRepository: ExtractedFactsRepository;
  let messagesRepository: MessagesRepository;
  const createdJobIds: string[] = [];
  const createdMessageIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    factsRepository = new ExtractedFactsRepository(db);
    messagesRepository = new MessagesRepository(db);
  });

  afterEach(async () => {
    if (createdMessageIds.length > 0) {
      await db.delete(messages).where(inArray(messages.id, createdMessageIds));
      createdMessageIds.length = 0;
    }

    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      createdJobIds.length = 0;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("stores extracted facts with values and source evidence", async () => {
    const jobId = await createJob();
    const messageId = await createMessage(jobId, "went to Michele, 1 hr 200");
    const facts = [
      fact({
        messageId,
        type: "customer_hint",
        value: { text: "Michele" },
        confidence: 0.7,
        quote: "Michele",
      }),
      fact({
        messageId,
        type: "duration_minutes",
        value: { minutes: 60 },
        confidence: 0.95,
        quote: "1 hr",
      }),
    ];

    await factsRepository.replaceForMessage(jobId, messageId, facts);

    await expect(factsRepository.listForMessage(messageId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining(facts[0]),
        expect.objectContaining(facts[1]),
      ]),
    );
  });

  it("replaces prior facts for the same source message", async () => {
    const jobId = await createJob();
    const messageId = await createMessage(jobId, "charged 200 no parts");

    await factsRepository.replaceForMessage(jobId, messageId, [
      fact({
        messageId,
        type: "customer_hint",
        value: { text: "Michele" },
        confidence: 0.7,
        quote: "Michele",
      }),
    ]);
    await factsRepository.replaceForMessage(jobId, messageId, [
      fact({
        messageId,
        type: "gross_charge_cents",
        value: { amountCents: 20000 },
        confidence: 0.9,
        quote: "200",
      }),
    ]);

    const storedFacts = await factsRepository.listForMessage(messageId);
    expect(storedFacts).toHaveLength(1);
    expect(storedFacts[0]).toEqual(
      expect.objectContaining({
        type: "gross_charge_cents",
        value: { amountCents: 20000 },
        confidence: 0.9,
        requiresConfirmation: false,
      }),
    );
  });

  async function createJob() {
    const id = randomUUID();
    createdJobIds.push(id);
    await db.insert(jobs).values({ id });
    return id;
  }

  async function createMessage(jobId: string, body: string) {
    const id = await messagesRepository.createJobUpdateMessage({
      jobId,
      authorRole: "tech",
      body,
    });
    createdMessageIds.push(id);
    return id;
  }
});

function fact(input: {
  messageId: string;
  type: ExtractedFact["type"];
  value: unknown;
  confidence: number;
  quote: string;
}): ExtractedFact {
  return ExtractedFactSchema.parse({
    type: input.type,
    value: input.value,
    confidence: input.confidence,
    evidence: {
      messageId: input.messageId,
      quote: input.quote,
    },
    requiresConfirmation: input.confidence < 0.8,
  });
}
