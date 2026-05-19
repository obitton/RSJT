import { type AppDb, createDb, createPool } from "@rsjt/db";
import type { FastifyInstance } from "fastify";
import type { ApiConfig } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    db: AppDb;
  }
}

export async function registerDbPlugin(
  app: FastifyInstance,
  config: ApiConfig,
) {
  const pool = createPool(config.DATABASE_URL);

  app.decorate("db", createDb(pool));
  app.addHook("onClose", async () => {
    await pool.end();
  });
}
