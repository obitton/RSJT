import { ContactCardParamsSchema } from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  ContactCardNotFoundError,
  type ContactCardServiceApi,
  ContactCardUnavailableError,
} from "../services/contact-card-service.js";

export async function registerContactCardRoutes(
  app: FastifyInstance,
  contactCardService?: ContactCardServiceApi,
) {
  function requireService() {
    if (!contactCardService) {
      throw app.httpErrors.serviceUnavailable(
        "Contact card service unavailable",
      );
    }
    return contactCardService;
  }

  app.get(
    "/manager/conversations/:conversationId/contact-card/preview",
    async (request) => {
      await app.requireRole(request, ["manager"]);
      const { conversationId } = ContactCardParamsSchema.parse(request.params);
      try {
        return await requireService().getPreview(conversationId);
      } catch (error) {
        throw mapContactCardError(app, error);
      }
    },
  );

  app.get(
    "/manager/conversations/:conversationId/contact-card",
    async (request, reply) => {
      await app.requireRole(request, ["manager"]);
      const { conversationId } = ContactCardParamsSchema.parse(request.params);
      try {
        const text = await requireService().getVcard(conversationId);
        return reply.type("text/vcard; charset=utf-8").send(text);
      } catch (error) {
        throw mapContactCardError(app, error);
      }
    },
  );
}

function mapContactCardError(app: FastifyInstance, error: unknown) {
  if (error instanceof ContactCardNotFoundError) {
    return app.httpErrors.notFound("Contact card conversation not found");
  }
  if (error instanceof ContactCardUnavailableError) {
    return app.httpErrors.conflict("Contact card is unavailable");
  }
  return error;
}
