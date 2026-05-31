import twilio from "twilio";

export type TwilioWebhookVerificationInput = {
  signature: string | undefined;
  requestUrl: string;
  payload: Record<string, unknown>;
};

export interface TwilioSignatureVerifier {
  verify(input: TwilioWebhookVerificationInput): boolean;
}

export type TwilioWebhookVerifierConfig = {
  authToken: string;
  baseUrl: string;
};

export class TwilioWebhookVerifier implements TwilioSignatureVerifier {
  constructor(private readonly config: TwilioWebhookVerifierConfig) {}

  verify(input: TwilioWebhookVerificationInput): boolean {
    if (!input.signature || !this.config.authToken) {
      return false;
    }

    const url = buildAbsoluteUrl(this.config.baseUrl, input.requestUrl);
    const params = toStringRecord(input.payload);

    return twilio.validateRequest(
      this.config.authToken,
      input.signature,
      url,
      params,
    );
  }
}

function buildAbsoluteUrl(baseUrl: string, requestUrl: string) {
  if (/^https?:\/\//i.test(requestUrl)) {
    return requestUrl;
  }

  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const path = requestUrl.startsWith("/") ? requestUrl : `/${requestUrl}`;

  return `${trimmedBase}${path}`;
}

function toStringRecord(
  payload: Record<string, unknown>,
): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      params[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      params[key] = String(value);
    }
  }

  return params;
}
