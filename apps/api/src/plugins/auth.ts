import type { SessionUser, UserRole } from "@rsjt/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ApiConfig } from "../config.js";
import { SessionsRepository } from "../repositories/sessions-repository.js";
import { UsersRepository } from "../repositories/users-repository.js";
import {
  AuthService,
  type AuthSessionService,
} from "../services/auth-service.js";

declare module "fastify" {
  interface FastifyInstance {
    authService: AuthSessionService;
    requireUser: (request: FastifyRequest) => Promise<SessionUser>;
    requireRole: (
      request: FastifyRequest,
      roles: UserRole[],
    ) => Promise<SessionUser>;
  }
}

function getBearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}

export async function registerAuthPlugin(
  app: FastifyInstance,
  config: ApiConfig,
  authService?: AuthSessionService,
) {
  app.decorate(
    "authService",
    authService ??
      new AuthService(
        new UsersRepository(app.db),
        new SessionsRepository(app.db),
        config,
      ),
  );

  app.decorate("requireUser", async (request: FastifyRequest) => {
    const token = getBearerToken(request);
    if (!token) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const session = await app.authService.getSession(token);
    if (!session) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    return session.user;
  });

  app.decorate(
    "requireRole",
    async (request: FastifyRequest, roles: UserRole[]) => {
      const user = await app.requireUser(request);
      if (!roles.includes(user.role)) {
        throw app.httpErrors.forbidden("Insufficient role");
      }

      return user;
    },
  );
}
