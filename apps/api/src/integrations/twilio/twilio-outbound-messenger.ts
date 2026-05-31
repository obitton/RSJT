import twilio from "twilio";
import type { ApiConfig } from "../../config.js";

export type OutboundChannel = "sms" | "whatsapp_sandbox";

export type OutboundMessageInput = {
  toExternalPhone: string;
  body: string;
  channel: OutboundChannel;
};

export type OutboundMessageResult =
  | {
      kind: "sent";
      twilioMessageSid: string;
      status: string;
    }
  | {
      kind: "disabled";
      reason: string;
    }
  | {
      kind: "failed";
      reason: string;
    };

export interface OutboundMessenger {
  isEnabled(): boolean;
  send(input: OutboundMessageInput): Promise<OutboundMessageResult>;
}

export type TwilioMinimalClient = {
  messages: {
    create: (
      params: Record<string, unknown>,
    ) => Promise<{ sid: string; status?: string | null }>;
  };
};

export type TwilioClientFactory = (
  accountSid: string,
  authToken: string,
) => TwilioMinimalClient;

export type TwilioOutboundConfig = Pick<
  ApiConfig,
  | "MESSAGING_OUTBOUND_ENABLED"
  | "MESSAGING_CHANNEL"
  | "TWILIO_ACCOUNT_SID"
  | "TWILIO_AUTH_TOKEN"
  | "TWILIO_MESSAGING_SERVICE_SID"
  | "TWILIO_FROM_PHONE_NUMBER"
  | "TWILIO_WHATSAPP_FROM"
  | "APP_BASE_URL"
>;

export class TwilioOutboundMessenger implements OutboundMessenger {
  constructor(
    private readonly config: TwilioOutboundConfig,
    private readonly clientFactory: TwilioClientFactory = (sid, token) =>
      twilio(sid, token) as unknown as TwilioMinimalClient,
  ) {}

  isEnabled() {
    return Boolean(
      this.config.MESSAGING_OUTBOUND_ENABLED &&
        this.config.TWILIO_ACCOUNT_SID &&
        this.config.TWILIO_AUTH_TOKEN,
    );
  }

  async send(input: OutboundMessageInput): Promise<OutboundMessageResult> {
    if (!this.isEnabled()) {
      return {
        kind: "disabled",
        reason: "Outbound messaging disabled",
      };
    }

    const sender = chooseSender(this.config, input.channel);
    if (!sender) {
      return {
        kind: "failed",
        reason: "No Twilio sender configured for channel",
      };
    }

    const recipient = formatRecipient(input.toExternalPhone, input.channel);

    try {
      const client = this.clientFactory(
        this.config.TWILIO_ACCOUNT_SID ?? "",
        this.config.TWILIO_AUTH_TOKEN ?? "",
      );
      const message = await client.messages.create({
        ...sender,
        to: recipient,
        body: input.body,
        ...(this.config.APP_BASE_URL
          ? {
              statusCallback: `${trimTrailingSlash(this.config.APP_BASE_URL)}/webhooks/twilio/status`,
            }
          : {}),
      });

      return {
        kind: "sent",
        twilioMessageSid: message.sid,
        status: message.status ?? "queued",
      };
    } catch (error) {
      return {
        kind: "failed",
        reason: error instanceof Error ? error.message : "Twilio send failed",
      };
    }
  }
}

function chooseSender(
  config: TwilioOutboundConfig,
  channel: OutboundChannel,
): { messagingServiceSid: string } | { from: string } | null {
  if (config.TWILIO_MESSAGING_SERVICE_SID) {
    return { messagingServiceSid: config.TWILIO_MESSAGING_SERVICE_SID };
  }
  if (channel === "whatsapp_sandbox" && config.TWILIO_WHATSAPP_FROM) {
    return { from: config.TWILIO_WHATSAPP_FROM };
  }
  if (channel === "sms" && config.TWILIO_FROM_PHONE_NUMBER) {
    return { from: config.TWILIO_FROM_PHONE_NUMBER };
  }
  return null;
}

function formatRecipient(toExternalPhone: string, channel: OutboundChannel) {
  if (
    channel === "whatsapp_sandbox" &&
    !toExternalPhone.startsWith("whatsapp:")
  ) {
    return `whatsapp:${toExternalPhone}`;
  }
  return toExternalPhone;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
