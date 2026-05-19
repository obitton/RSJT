import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb, createPool } from "./connection.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = createPool(databaseUrl);
const db = createDb(pool);

await migrate(db, { migrationsFolder: "src/migrations" });
await pool.end();
