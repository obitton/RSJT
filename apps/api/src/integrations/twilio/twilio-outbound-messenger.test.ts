import { describe, expect, it } from "vitest";
import {
  type TwilioOutboundConfig,
  TwilioOutboundMessenger,
} from "./twilio-outbound-messenger.js";

const baseConfig: TwilioOutboundConfig = {
  MESSAGING_OUTBOUND_ENABLED: false,
  MESSAGING_CHANNEL: "whatsapp_sandbox",
};

describe("TwilioOutboundMessenger", () => {
  it("returns a disabled result without calling Twilio when outbound is disabled", async () => {
    let invoked = false;
    const messenger = new TwilioOutboundMessenger(baseConfig, () => {
      invoked = true;
      return {
        messages: { create: async () => ({ sid: "x", status: "queued" }) },
      };
    });

    const result = await messenger.send({
      toExternalPhone: "+15555550100",
      body: "Hello",
      channel: "whatsapp_sandbox",
    });

    expect(result).toEqual({
      kind: "disabled",
      reason: "Outbound messaging disabled",
    });
    expect(invoked).toBe(false);
  });

  it("uses the messaging service SID and reports the Twilio sid when enabled", async () => {
    const config: TwilioOutboundConfig = {
      MESSAGING_OUTBOUND_ENABLED: true,
      MESSAGING_CHANNEL: "whatsapp_sandbox",
      TWILIO_ACCOUNT_SID: "AC1",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_MESSAGING_SERVICE_SID: "MG1",
      APP_BASE_URL: "https://example.com",
    };
    const fakeClient = {
      messages: {
        create: async (input: Record<string, unknown>) => ({
          sid: "SMfake",
          status: "queued",
          input,
        }),
      },
    };
    const messenger = new TwilioOutboundMessenger(config, () => fakeClient);

    const result = await messenger.send({
      toExternalPhone: "+15555550100",
      body: "Hello",
      channel: "whatsapp_sandbox",
    });

    expect(result).toEqual({
      kind: "sent",
      twilioMessageSid: "SMfake",
      status: "queued",
    });
  });

  it("returns a failed result with the underlying error message", async () => {
    const config: TwilioOutboundConfig = {
      MESSAGING_OUTBOUND_ENABLED: true,
      MESSAGING_CHANNEL: "sms",
      TWILIO_ACCOUNT_SID: "AC1",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_FROM_PHONE_NUMBER: "+15555550199",
    };
    const messenger = new TwilioOutboundMessenger(config, () => ({
      messages: {
        create: async () => {
          throw new Error("Twilio error");
        },
      },
    }));

    const result = await messenger.send({
      toExternalPhone: "+15555550100",
      body: "Hello",
      channel: "sms",
    });

    expect(result).toEqual({ kind: "failed", reason: "Twilio error" });
  });

  it("fails when no sender is configured for the channel", async () => {
    const config: TwilioOutboundConfig = {
      MESSAGING_OUTBOUND_ENABLED: true,
      MESSAGING_CHANNEL: "sms",
      TWILIO_ACCOUNT_SID: "AC1",
      TWILIO_AUTH_TOKEN: "token",
    };
    const messenger = new TwilioOutboundMessenger(config, () => ({
      messages: { create: async () => ({ sid: "x", status: "queued" }) },
    }));

    const result = await messenger.send({
      toExternalPhone: "+15555550100",
      body: "Hello",
      channel: "sms",
    });

    expect(result).toEqual({
      kind: "failed",
      reason: "No Twilio sender configured for channel",
    });
  });
});
