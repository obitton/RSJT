import { randomUUID } from "node:crypto";
import {
  type AppDb,
  conversations,
  createDb,
  createPool,
  jobs,
  messages,
  users,
} from "@rsjt/db";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ConversationsRepository } from "./conversations-repository.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev";

describe("ConversationsRepository", () => {
  let pool: ReturnType<typeof createPool>;
  let db: AppDb;
  let repository: ConversationsRepository;
  const createdConversationIds: string[] = [];
  const createdMessageIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdJobIds: string[] = [];

  beforeAll(() => {
    pool = createPool(databaseUrl);
    db = createDb(pool);
    repository = new ConversationsRepository(db);
  });

  afterEach(async () => {
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
      createdJobIds.length = 0;
    }
    if (createdMessageIds.length > 0) {
      await db.delete(messages).where(inArray(messages.id, createdMessageIds));
      createdMessageIds.length = 0;
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

  it("activates and releases takeover for a conversation", async () => {
    const userId = await createUser();
    const conversationId = await createConversation({
      externalPhone: `+15555${Date.now().toString().slice(-6)}`,
    });

    await repository.setTakeover({
      conversationId,
      active: true,
      actorUserId: userId,
    });
    const detailActive = await repository.getDetail(conversationId);
    expect(detailActive?.takeoverActive).toBe(true);
    expect(detailActive?.takeoverStartedByUserId).toBe(userId);

    await repository.setTakeover({
      conversationId,
      active: false,
      actorUserId: userId,
    });
    const detailInactive = await repository.getDetail(conversationId);
    expect(detailInactive?.takeoverActive).toBe(false);
    expect(detailInactive?.takeoverStartedAt).toBeNull();
  });

  it("creates outbound messages with draft status by default", async () => {
    const userId = await createUser();
    const conversationId = await createConversation({
      externalPhone: `+15555${Date.now().toString().slice(-6)}`,
    });

    const message = await repository.createOutboundMessage({
      conversationId,
      body: "Thanks, I will follow up shortly.",
      sentByUserId: userId,
      authorRole: "tech",
    });
    createdMessageIds.push(message.id);

    expect(message.direction).toBe("outbound");
    expect(message.externalStatus).toBe("draft");
    expect(message.authorRole).toBe("tech");
    expect(message.sentByUserId).toBe(userId);
  });

  it("marks outbound messages as sent or blocked", async () => {
    const userId = await createUser();
    const conversationId = await createConversation({
      externalPhone: `+15555${Date.now().toString().slice(-6)}`,
    });
    const message = await repository.createOutboundMessage({
      conversationId,
      body: "Sent body",
      sentByUserId: userId,
      authorRole: "tech",
    });
    createdMessageIds.push(message.id);

    const sent = await repository.markOutboundSent({
      messageId: message.id,
      twilioMessageSid: "SMtechout",
      status: "queued",
    });
    expect(sent?.twilioMessageSid).toBe("SMtechout");
    expect(sent?.externalStatus).toBe("queued");

    const blockedMessage = await repository.createOutboundMessage({
      conversationId,
      body: "Disabled body",
      sentByUserId: userId,
      authorRole: "tech",
    });
    createdMessageIds.push(blockedMessage.id);

    const blocked = await repository.markOutboundBlocked({
      messageId: blockedMessage.id,
      reason: "Outbound messaging disabled",
    });
    expect(blocked?.externalStatus).toBe("blocked");
  });

  it("returns conversation transcript with all messages in chronological order", async () => {
    const userId = await createUser();
    const conversationId = await createConversation({
      externalPhone: `+15555${Date.now().toString().slice(-6)}`,
    });

    const inboundRow = await insertInboundMessage(
      conversationId,
      "Hello inbound",
    );
    const outbound = await repository.createOutboundMessage({
      conversationId,
      body: "Hello outbound",
      sentByUserId: userId,
      authorRole: "tech",
    });
    createdMessageIds.push(outbound.id);

    const detail = await repository.getDetail(conversationId);
    expect(detail?.messages.map((m) => m.id)).toEqual([
      inboundRow.id,
      outbound.id,
    ]);
  });

  it("reports the linked job id once the lead has been converted", async () => {
    const conversationId = await createConversation({
      externalPhone: `+15555${Date.now().toString().slice(-6)}`,
    });

    const beforeConvert = await repository.getDetail(conversationId);
    expect(beforeConvert?.jobId).toBeNull();

    const jobId = randomUUID();
    createdJobIds.push(jobId);
    await db
      .insert(jobs)
      .values({ id: jobId, conversationId, state: "scheduled" });

    const afterConvert = await repository.getDetail(conversationId);
    expect(afterConvert?.jobId).toBe(jobId);
  });

  async function createUser() {
    const id = randomUUID();
    createdUserIds.push(id);
    await db.insert(users).values({
      id,
      username: `tech-${id}`,
      displayName: "Tech",
      role: "tech",
      passcodeHash: "hash",
    });
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

  async function insertInboundMessage(conversationId: string, body: string) {
    const [row] = await db
      .insert(messages)
      .values({
        conversationId,
        direction: "inbound",
        body,
        twilioMessageSid: `SMinbound${randomUUID()}`,
      })
      .returning({ id: messages.id });
    if (!row) {
      throw new Error("Failed to insert inbound message");
    }
    createdMessageIds.push(row.id);
    return row;
  }
});
