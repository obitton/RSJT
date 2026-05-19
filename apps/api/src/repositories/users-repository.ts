import type { AppDb } from "@rsjt/db";
import { users } from "@rsjt/db";
import type { UserRole } from "@rsjt/shared";
import { and, eq } from "drizzle-orm";

export type ActiveUserRecord = {
  id: string;
  role: UserRole;
  displayName: string;
  passcodeHash: string;
};

export class UsersRepository {
  constructor(private readonly db: AppDb) {}

  async findActiveByUsername(
    username: string,
  ): Promise<ActiveUserRecord | null> {
    const [user] = await this.db
      .select({
        id: users.id,
        role: users.role,
        displayName: users.displayName,
        passcodeHash: users.passcodeHash,
      })
      .from(users)
      .where(and(eq(users.username, username), eq(users.isActive, true)))
      .limit(1);

    return user ?? null;
  }
}
