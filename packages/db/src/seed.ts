import argon2 from "argon2";
import { createDb, createPool } from "./connection.js";
import { users } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = createPool(databaseUrl);
const db = createDb(pool);

await db
  .insert(users)
  .values([
    {
      username: "manager",
      displayName: "Manager",
      role: "manager",
      passcodeHash: await argon2.hash(
        process.env.LOCAL_MANAGER_PASSCODE ?? "manager-dev",
      ),
    },
    {
      username: "tech",
      displayName: "Tech",
      role: "tech",
      passcodeHash: await argon2.hash(
        process.env.LOCAL_TECH_PASSCODE ?? "tech-dev",
      ),
    },
  ])
  .onConflictDoNothing();

await pool.end();
