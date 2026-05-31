import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { TwilioWebhookVerifier } from "./twilio-webhook-verifier.js";

const authToken = "test-token";
const baseUrl = "https://example.com";
const path = "/webhooks/twilio/messages";

describe("TwilioWebhookVerifier", () => {
  it("returns true for a valid Twilio signature", () => {
    const payload = {
      MessageSid: "SM1",
      From: "+15555550100",
      To: "+15555550199",
      Body: "Hello",
      NumMedia: "0",
    };
    const signature = signRequest(`${baseUrl}${path}`, payload);
    const verifier = new TwilioWebhookVerifier({ authToken, baseUrl });

    const result = verifier.verify({
      signature,
      requestUrl: path,
      payload,
    });

    expect(result).toBe(true);
  });

  it("returns false when the signature header is missing", () => {
    const verifier = new TwilioWebhookVerifier({ authToken, baseUrl });

    expect(
      verifier.verify({
        signature: undefined,
        requestUrl: path,
        payload: { MessageSid: "SM1" },
      }),
    ).toBe(false);
  });

  it("returns false when the auth token is missing", () => {
    const verifier = new TwilioWebhookVerifier({ authToken: "", baseUrl });

    expect(
      verifier.verify({
        signature: "sig",
        requestUrl: path,
        payload: { MessageSid: "SM1" },
      }),
    ).toBe(false);
  });

  it("returns false when the payload differs from the signed payload", () => {
    const payload = {
      MessageSid: "SM2",
      From: "+15555550100",
      To: "+15555550199",
      Body: "Original",
      NumMedia: "0",
    };
    const signature = signRequest(`${baseUrl}${path}`, payload);
    const verifier = new TwilioWebhookVerifier({ authToken, baseUrl });

    const result = verifier.verify({
      signature,
      requestUrl: path,
      payload: { ...payload, Body: "Tampered" },
    });

    expect(result).toBe(false);
  });
});

function signRequest(url: string, payload: Record<string, string>) {
  const sortedKeys = Object.keys(payload).sort();
  const data = sortedKeys.reduce(
    (acc, key) => `${acc}${key}${payload[key]}`,
    url,
  );

  return crypto.createHmac("sha1", authToken).update(data).digest("base64");
}
