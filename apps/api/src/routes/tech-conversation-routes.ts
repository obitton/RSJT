import {
  ConversationIdParamsSchema,
  SendConversationMessageRequestSchema,
  SetTakeoverRequestSchema,
} from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  ConversationNotFoundError,
  type LiveTakeoverServiceApi,
  OutboundMessagingDisabledError,
  TakeoverInactiveError,
} from "../services/live-takeover-service.js";

export async function registerTechConversationRoutes(
  app: FastifyInstance,
  liveTakeoverService?: LiveTakeoverServiceApi,
) {
  function requireService() {
    if (!liveTakeoverService) {
      throw app.httpErrors.serviceUnavailable(
        "Tech conversation service unavailable",
      );
    }
    return liveTakeoverService;
  }

  app.get("/tech/conversations", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    return requireService().listConversations(user);
  });

  app.get("/tech/conversations/:conversationId", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { conversationId } = ConversationIdParamsSchema.parse(request.params);
    const detail = await requireService().getConversation(user, conversationId);
    if (!detail) {
      throw app.httpErrors.notFound("Conversation not found");
    }
    return { conversation: detail };
  });

  app.post("/tech/conversations/:conversationId/takeover", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { conversationId } = ConversationIdParamsSchema.parse(request.params);
    const body = SetTakeoverRequestSchema.parse(request.body);

    try {
      const detail = await requireService().setTakeover(
        user,
        conversationId,
        body.active,
      );
      if (!detail) {
        throw app.httpErrors.notFound("Conversation not found");
      }
      return { conversation: detail };
    } catch (error) {
      throw mapServiceError(app, error);
    }
  });

  app.post("/tech/conversations/:conversationId/messages", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { conversationId } = ConversationIdParamsSchema.parse(request.params);
    const body = SendConversationMessageRequestSchema.parse(request.body);

    try {
      const message = await requireService().sendMessage(
        user,
        conversationId,
        body,
      );
      return { message };
    } catch (error) {
      throw mapServiceError(app, error);
    }
  });
}

function mapServiceError(app: FastifyInstance, error: unknown) {
  if (error instanceof ConversationNotFoundError) {
    return app.httpErrors.notFound("Conversation not found");
  }
  if (error instanceof TakeoverInactiveError) {
    return app.httpErrors.conflict("Takeover must be active");
  }
  if (error instanceof OutboundMessagingDisabledError) {
    return app.httpErrors.conflict("Outbound messaging is disabled");
  }
  return error;
}
