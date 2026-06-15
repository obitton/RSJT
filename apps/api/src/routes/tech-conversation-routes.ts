import {
  ConversationIdParamsSchema,
  SendConversationMessageRequestSchema,
  SetTakeoverRequestSchema,
} from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  ConversationNotFoundError as ConversionConversationNotFoundError,
  LeadAlreadyConvertedError,
  LeadBlockedError,
  type LeadConversionServiceApi,
  LeadNotScheduledError,
} from "../services/lead-conversion-service.js";
import {
  ConversationNotFoundError,
  type LiveTakeoverServiceApi,
  OutboundMessagingDisabledError,
  TakeoverInactiveError,
} from "../services/live-takeover-service.js";

export async function registerTechConversationRoutes(
  app: FastifyInstance,
  liveTakeoverService?: LiveTakeoverServiceApi,
  leadConversionService?: LeadConversionServiceApi,
) {
  function requireService() {
    if (!liveTakeoverService) {
      throw app.httpErrors.serviceUnavailable(
        "Tech conversation service unavailable",
      );
    }
    return liveTakeoverService;
  }

  function requireConversionService() {
    if (!leadConversionService) {
      throw app.httpErrors.serviceUnavailable(
        "Lead conversion service unavailable",
      );
    }
    return leadConversionService;
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

  app.post(
    "/tech/conversations/:conversationId/convert-to-job",
    async (request) => {
      // Both techs and managers can convert a scheduled lead into a job; a tech
      // does not need a manager's approval.
      const user = await app.requireRole(request, ["tech", "manager"]);
      const { conversationId } = ConversationIdParamsSchema.parse(
        request.params,
      );

      try {
        const job = await requireConversionService().convertToJob(
          user,
          conversationId,
        );
        return { job };
      } catch (error) {
        throw mapConversionError(app, error);
      }
    },
  );
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

function mapConversionError(app: FastifyInstance, error: unknown) {
  if (error instanceof ConversionConversationNotFoundError) {
    return app.httpErrors.notFound("Conversation not found");
  }
  if (error instanceof LeadBlockedError) {
    return app.httpErrors.conflict("A blocked lead cannot become a job");
  }
  if (error instanceof LeadAlreadyConvertedError) {
    return app.httpErrors.conflict("Lead has already been converted to a job");
  }
  if (error instanceof LeadNotScheduledError) {
    return app.httpErrors.conflict(
      "Lead must be scheduled before it can become a job",
    );
  }
  return error;
}
