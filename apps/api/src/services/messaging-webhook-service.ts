import {
  type InboundMessageRecord,
  type TwilioInboundWebhook,
  TwilioInboundWebhookSchema,
  type TwilioStatusCallback,
  TwilioStatusCallbackSchema,
  extractTwilioMediaItems,
} from "@rsjt/shared";
import type { TwilioSignatureVerifier } from "../integrations/twilio/twilio-webhook-verifier.js";
import type {
  InboundTwilioMessageInput,
  StatusCallbackPersistInput,
} from "../repositories/messages-repository.js";

export interface MessagingWebhookStore {
  findOrCreateConversationByExternalPhone(input: {
    externalPhone: string;
  }): Promise<string>;
  persistInboundTwilioMessage(
    input: InboundTwilioMessageInput,
  ): Promise<InboundMessageRecord>;
  persistStatusCallback(
    input: StatusCallbackPersistInput,
  ): Promise<{ updatedMessageId: string | null }>;
}

export interface IntakeEvaluator {
  evaluateInboundMessage(input: {
    conversationId: string;
    messageId: string;
    body: string;
    hasMedia: boolean;
    intakeBotUserId: string;
  }): Promise<unknown>;
}

export type MessagingWebhookServiceOptions = {
  intakeEvaluator?: IntakeEvaluator | null;
  intakeBotUserId?: string | null;
};

export type MessagingWebhookRequestContext = {
  signature: string | undefined;
  requestUrl: string;
};

export type InboundResult = {
  conversationId: string;
  messageId: string;
};

export type StatusCallbackResult = {
  updatedMessageId: string | null;
};

export interface MessagingWebhookServiceApi {
  handleInboundMessage(
    context: MessagingWebhookRequestContext,
    payload: Record<string, unknown>,
  ): Promise<InboundResult>;
  handleStatusCallback(
    context: MessagingWebhookRequestContext,
    payload: Record<string, unknown>,
  ): Promise<StatusCallbackResult>;
}

export class TwilioWebhookSignatureError extends Error {
  constructor() {
    super("Invalid Twilio signature");
  }
}

export class MessagingWebhookService implements MessagingWebhookServiceApi {
  private readonly intakeEvaluator: IntakeEvaluator | null;
  private readonly intakeBotUserId: string | null;

  constructor(
    private readonly store: MessagingWebhookStore,
    private readonly verifier: TwilioSignatureVerifier,
    options: MessagingWebhookServiceOptions = {},
  ) {
    this.intakeEvaluator = options.intakeEvaluator ?? null;
    this.intakeBotUserId = options.intakeBotUserId ?? null;
  }

  async handleInboundMessage(
    context: MessagingWebhookRequestContext,
    payload: Record<string, unknown>,
  ): Promise<InboundResult> {
    this.verifyRequest(context, payload);
    const parsed = TwilioInboundWebhookSchema.parse(payload);
    const externalPhone = normalizeSender(parsed.From);
    const conversationId =
      await this.store.findOrCreateConversationByExternalPhone({
        externalPhone,
      });
    const media = extractTwilioMediaItems(parsed);
    const inbound = await this.store.persistInboundTwilioMessage({
      conversationId,
      twilioMessageSid: parsed.MessageSid,
      body: parsed.Body,
      media,
      rawPayload: { ...parsed },
    });

    if (this.intakeEvaluator && this.intakeBotUserId) {
      await this.intakeEvaluator.evaluateInboundMessage({
        conversationId,
        messageId: inbound.id,
        body: parsed.Body,
        hasMedia: media.length > 0,
        intakeBotUserId: this.intakeBotUserId,
      });
    }

    return {
      conversationId,
      messageId: inbound.id,
    };
  }

  async handleStatusCallback(
    context: MessagingWebhookRequestContext,
    payload: Record<string, unknown>,
  ): Promise<StatusCallbackResult> {
    this.verifyRequest(context, payload);
    const parsed = TwilioStatusCallbackSchema.parse(payload);
    const result = await this.store.persistStatusCallback({
      twilioMessageSid: parsed.MessageSid,
      status: parsed.MessageStatus,
      rawPayload: { ...parsed },
    });

    return result;
  }

  private verifyRequest(
    context: MessagingWebhookRequestContext,
    payload: Record<string, unknown>,
  ) {
    const valid = this.verifier.verify({
      signature: context.signature,
      requestUrl: context.requestUrl,
      payload,
    });

    if (!valid) {
      throw new TwilioWebhookSignatureError();
    }
  }
}

export const EMPTY_TWIML_RESPONSE = "<Response></Response>";

export type { TwilioInboundWebhook, TwilioStatusCallback };

function normalizeSender(value: string) {
  return value.trim();
}
