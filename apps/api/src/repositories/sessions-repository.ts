import type { AppDb } from "@rsjt/db";
import { sessions, users } from "@rsjt/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { ActiveSession } from "../services/auth-service.js";

type CreateSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export class SessionsRepository {
  constructor(private readonly db: AppDb) {}

  async create(input: CreateSessionInput) {
    await this.db.insert(sessions).values(input);
  }

  async findActiveByTokenHash(
    tokenHash: string,
  ): Promise<ActiveSession | null> {
    const [session] = await this.db
      .select({
        user: {
          id: users.id,
          role: users.role,
          displayName: users.displayName,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  async revokeByTokenHash(tokenHash: string) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, tokenHash));
  }
}
