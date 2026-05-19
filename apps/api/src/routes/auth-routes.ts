import { LoginRequestSchema } from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import { InvalidLoginError } from "../services/auth-service.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const input = LoginRequestSchema.parse(request.body);

    try {
      const result = await app.authService.login(
        input.username,
        input.passcode,
      );
      return reply.send(result);
    } catch (error) {
      if (error instanceof InvalidLoginError) {
        throw app.httpErrors.unauthorized("Invalid login");
      }

      throw error;
    }
  });

  app.get("/auth/session", async (request) => {
    const user = await app.requireUser(request);
    return { user };
  });

  app.post("/auth/logout", async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : null;

    if (token) {
      await app.authService.logout(token);
    }

    return reply.status(204).send();
  });
}
