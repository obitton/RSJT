import type {
  ConversationDetail,
  ConversationMessage,
  SendConversationMessageRequest,
  SessionUser,
} from "@rsjt/shared";
import type {
  OutboundChannel,
  OutboundMessenger,
} from "../integrations/twilio/twilio-outbound-messenger.js";
import type {
  CreateOutboundMessageInput,
  MarkOutboundFailedInput,
  MarkOutboundSentInput,
  SetTakeoverInput,
} from "../repositories/conversations-repository.js";

export interface LiveTakeoverStore {
  listForTech(): Promise<{
    active: import("@rsjt/shared").ConversationSummary[];
    needsResponse: import("@rsjt/shared").ConversationSummary[];
    recent: import("@rsjt/shared").ConversationSummary[];
  }>;
  getDetail(conversationId: string): Promise<ConversationDetail | null>;
  setTakeover(input: SetTakeoverInput): Promise<void>;
  createOutboundMessage(
    input: CreateOutboundMessageInput,
  ): Promise<ConversationMessage>;
  markOutboundSent(
    input: MarkOutboundSentInput,
  ): Promise<ConversationMessage | null>;
  markOutboundBlocked(
    input: MarkOutboundFailedInput,
  ): Promise<ConversationMessage | null>;
  markOutboundFailed(
    input: MarkOutboundFailedInput,
  ): Promise<ConversationMessage | null>;
}

export interface LiveTakeoverServiceApi {
  listConversations(user: SessionUser): Promise<{
    active: import("@rsjt/shared").ConversationSummary[];
    needsResponse: import("@rsjt/shared").ConversationSummary[];
    recent: import("@rsjt/shared").ConversationSummary[];
  }>;
  getConversation(
    user: SessionUser,
    conversationId: string,
  ): Promise<ConversationDetail | null>;
  setTakeover(
    user: SessionUser,
    conversationId: string,
    active: boolean,
  ): Promise<ConversationDetail | null>;
  sendMessage(
    user: SessionUser,
    conversationId: string,
    input: SendConversationMessageRequest,
  ): Promise<ConversationMessage>;
}

export class TakeoverInactiveError extends Error {
  constructor() {
    super("Takeover must be active before sending");
  }
}

export class OutboundMessagingDisabledError extends Error {
  constructor() {
    super("Outbound messaging is disabled");
  }
}

export class ConversationNotFoundError extends Error {
  constructor() {
    super("Conversation not found");
  }
}

export type LiveTakeoverServiceOptions = {
  channel: OutboundChannel;
};

export class LiveTakeoverService implements LiveTakeoverServiceApi {
  constructor(
    private readonly store: LiveTakeoverStore,
    private readonly outbound: OutboundMessenger,
    private readonly options: LiveTakeoverServiceOptions,
  ) {}

  async listConversations(_user: SessionUser) {
    return this.store.listForTech();
  }

  async getConversation(_user: SessionUser, conversationId: string) {
    return this.store.getDetail(conversationId);
  }

  async setTakeover(
    user: SessionUser,
    conversationId: string,
    active: boolean,
  ) {
    const detail = await this.store.getDetail(conversationId);
    if (!detail) {
      throw new ConversationNotFoundError();
    }
    await this.store.setTakeover({
      conversationId,
      active,
      actorUserId: user.id,
    });
    return this.store.getDetail(conversationId);
  }

  async sendMessage(
    user: SessionUser,
    conversationId: string,
    input: SendConversationMessageRequest,
  ) {
    const detail = await this.store.getDetail(conversationId);
    if (!detail) {
      throw new ConversationNotFoundError();
    }
    if (!detail.takeoverActive) {
      throw new TakeoverInactiveError();
    }

    if (!detail.externalPhone) {
      throw new ConversationNotFoundError();
    }

    const draft = await this.store.createOutboundMessage({
      conversationId,
      body: input.body,
      sentByUserId: user.id,
      authorRole: user.role,
    });

    if (!this.outbound.isEnabled()) {
      const blocked = await this.store.markOutboundBlocked({
        messageId: draft.id,
        reason: "Outbound messaging disabled",
      });
      if (blocked) {
        throw new OutboundMessagingDisabledError();
      }
      throw new OutboundMessagingDisabledError();
    }

    const result = await this.outbound.send({
      toExternalPhone: detail.externalPhone,
      body: input.body,
      channel: this.options.channel,
    });

    if (result.kind === "disabled") {
      await this.store.markOutboundBlocked({
        messageId: draft.id,
        reason: result.reason,
      });
      throw new OutboundMessagingDisabledError();
    }
    if (result.kind === "failed") {
      const failed = await this.store.markOutboundFailed({
        messageId: draft.id,
        reason: result.reason,
      });
      if (failed) {
        return failed;
      }
      throw new Error(result.reason);
    }

    const sent = await this.store.markOutboundSent({
      messageId: draft.id,
      twilioMessageSid: result.twilioMessageSid,
      status: result.status,
    });
    return sent ?? draft;
  }
}
