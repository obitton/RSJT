import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  EMPTY_TWIML_RESPONSE,
  type MessagingWebhookServiceApi,
  TwilioWebhookSignatureError,
} from "../services/messaging-webhook-service.js";

const TWILIO_SIGNATURE_HEADER = "x-twilio-signature";

export async function registerTwilioWebhookRoutes(
  app: FastifyInstance,
  messagingWebhookService?: MessagingWebhookServiceApi,
) {
  function requireService() {
    if (!messagingWebhookService) {
      throw app.httpErrors.serviceUnavailable(
        "Messaging webhook service unavailable",
      );
    }
    return messagingWebhookService;
  }

  app.post("/webhooks/twilio/messages", async (request, reply) => {
    const payload = ensureFormPayload(app, request);

    try {
      await requireService().handleInboundMessage(
        {
          signature: getSignature(request),
          requestUrl: request.url,
        },
        payload,
      );
    } catch (error) {
      throw mapWebhookError(app, error);
    }

    return reply
      .status(200)
      .header("Content-Type", "text/xml")
      .send(EMPTY_TWIML_RESPONSE);
  });

  app.post("/webhooks/twilio/status", async (request, reply) => {
    const payload = ensureFormPayload(app, request);

    try {
      await requireService().handleStatusCallback(
        {
          signature: getSignature(request),
          requestUrl: request.url,
        },
        payload,
      );
    } catch (error) {
      throw mapWebhookError(app, error);
    }

    return reply.status(204).send();
  });
}

function getSignature(request: FastifyRequest) {
  const value = request.headers[TWILIO_SIGNATURE_HEADER];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function ensureFormPayload(
  app: FastifyInstance,
  request: FastifyRequest,
): Record<string, unknown> {
  const body = request.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  throw app.httpErrors.unsupportedMediaType(
    "Twilio webhook payload must be form-encoded",
  );
}

function mapWebhookError(app: FastifyInstance, error: unknown) {
  if (error instanceof TwilioWebhookSignatureError) {
    return app.httpErrors.forbidden("Invalid Twilio signature");
  }
  return error;
}
