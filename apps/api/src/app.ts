import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import type { AppDb } from "@rsjt/db";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { ApiConfig } from "./config.js";
import { createRepairShoprClientFromEnv } from "./integrations/repairshopr/repairshopr-client.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerDbPlugin } from "./plugins/db.js";
import { MatchesRepository } from "./repositories/matches-repository.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerHealthRoutes } from "./routes/health-routes.js";
import { registerMatchRoutes } from "./routes/matches-routes.js";
import type { AuthSessionService } from "./services/auth-service.js";
import {
  MatchingService,
  type MatchingServiceApi,
} from "./services/matching-service.js";

type AppOptions = {
  authService?: AuthSessionService;
  db?: AppDb;
  matchingService?: MatchingServiceApi;
};

export async function buildApp(config: ApiConfig, options: AppOptions = {}) {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });

  await app.register(cors, { origin: true });
  await app.register(sensible);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Invalid request",
        issues: error.issues,
      });
    }

    if (isHttpError(error)) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    app.log.error(error);
    return reply.status(500).send({ error: "Internal server error" });
  });

  if (options.db) {
    app.decorate("db", options.db);
  } else if (!options.authService) {
    await registerDbPlugin(app, config);
  }

  await registerAuthPlugin(app, config, options.authService);
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerMatchRoutes(
    app,
    options.matchingService ?? createDefaultMatchingService(app, config),
  );

  return app;
}

function isHttpError(error: unknown): error is Error & { statusCode: number } {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  );
}

function createDefaultMatchingService(app: FastifyInstance, config: ApiConfig) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  if (!config.REPAIRSHOPR_SUBDOMAIN || !config.REPAIRSHOPR_API_KEY) {
    return undefined;
  }

  return new MatchingService(
    new MatchesRepository(app.db),
    createRepairShoprClientFromEnv({
      REPAIRSHOPR_SUBDOMAIN: config.REPAIRSHOPR_SUBDOMAIN,
      REPAIRSHOPR_API_KEY: config.REPAIRSHOPR_API_KEY,
      REPAIRSHOPR_TIMEOUT_MS: config.REPAIRSHOPR_TIMEOUT_MS,
    }),
  );
}
