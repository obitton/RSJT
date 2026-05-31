import type { RepairShoprEntityType, RepairShoprReference } from "@rsjt/shared";
import { RepairShoprRateLimiter } from "./repairshopr-rate-limiter.js";
import {
  type RepairShoprAppointment,
  RepairShoprAppointmentSchema,
  type RepairShoprContact,
  RepairShoprContactSchema,
  type RepairShoprCustomer,
  RepairShoprCustomerSchema,
  type RepairShoprLead,
  RepairShoprLeadSchema,
  type RepairShoprTicket,
  type RepairShoprTicketComment,
  RepairShoprTicketCommentSchema,
  RepairShoprTicketSchema,
} from "./repairshopr-types.js";

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

export type RepairShoprWriteClientConfig = {
  subdomain: string;
  apiKey: string;
  timeoutMs: number;
};

export type RepairShoprWriteMethod = "POST" | "PUT";

export type RepairShoprWriteTransport = (
  url: URL,
  init: {
    method: RepairShoprWriteMethod;
    signal: AbortSignal;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<Response>;

type RepairShoprWriteClientOptions = {
  transport?: RepairShoprWriteTransport;
  rateLimiter?: RepairShoprRateLimiter;
  sleep?: (delayMs: number) => Promise<void>;
};

type ResponseParser<TResponse> = {
  parse(input: unknown): TResponse;
};

export class RepairShoprWriteApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
    readonly responseText: string,
  ) {
    super(message);
  }
}

export class RepairShoprWriteConfigError extends Error {}

export class RepairShoprWriteClient {
  private readonly baseUrl: URL;
  private readonly transport: RepairShoprWriteTransport;
  private readonly rateLimiter: RepairShoprRateLimiter;
  private readonly sleep: (delayMs: number) => Promise<void>;

  constructor(
    private readonly config: RepairShoprWriteClientConfig,
    options: RepairShoprWriteClientOptions = {},
  ) {
    this.baseUrl = new URL(
      `https://${config.subdomain}.repairshopr.com/api/v1/`,
    );
    this.transport = options.transport ?? defaultTransport;
    this.rateLimiter = options.rateLimiter ?? new RepairShoprRateLimiter();
    this.sleep =
      options.sleep ??
      ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  async updateCustomer(id: number, payload: Record<string, unknown>) {
    return this.requestRecord(
      "PUT",
      `customers/${id}`,
      payload,
      RepairShoprCustomerSchema,
      "customer",
    );
  }

  async updateContact(id: number, payload: Record<string, unknown>) {
    return this.requestRecord(
      "PUT",
      `contacts/${id}`,
      payload,
      RepairShoprContactSchema,
      "contact",
    );
  }

  async createLead(payload: Record<string, unknown>) {
    return this.requestRecord(
      "POST",
      "leads",
      payload,
      RepairShoprLeadSchema,
      "lead",
    );
  }

  async createTicket(payload: Record<string, unknown>) {
    return this.requestRecord(
      "POST",
      "tickets",
      payload,
      RepairShoprTicketSchema,
      "ticket",
    );
  }

  async createTicketComment(
    ticketId: number,
    payload: Record<string, unknown>,
  ) {
    return this.requestRecord(
      "POST",
      `tickets/${ticketId}/comments`,
      payload,
      RepairShoprTicketCommentSchema,
      "comment",
    );
  }

  async createAppointment(payload: Record<string, unknown>) {
    return this.requestRecord(
      "POST",
      "appointments",
      payload,
      RepairShoprAppointmentSchema,
      "appointment",
    );
  }

  toReference(
    entityType: RepairShoprEntityType,
    record:
      | RepairShoprCustomer
      | RepairShoprContact
      | RepairShoprLead
      | RepairShoprTicket
      | RepairShoprAppointment
      | RepairShoprTicketComment,
  ): RepairShoprReference {
    return {
      entityType,
      repairShoprId: String(record.id),
      displayLabel: getDisplayLabel(entityType, record),
      url: new URL(
        `${entityTypePath(entityType)}/${record.id}`,
        this.baseUrl,
      ).toString(),
    };
  }

  private async requestRecord<TItem>(
    method: RepairShoprWriteMethod,
    endpoint: string,
    payload: Record<string, unknown>,
    schema: ResponseParser<TItem>,
    key: string,
  ) {
    const response = await this.request(method, endpoint, payload);
    return schema.parse(recordPayload(response, key));
  }

  private async request(
    method: RepairShoprWriteMethod,
    endpoint: string,
    payload: Record<string, unknown>,
  ) {
    const url = this.buildUrl(endpoint);
    const endpointForErrors = stripCredential(url);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      );

      try {
        await this.rateLimiter.waitForSlot();
        const response = await this.transport(url, {
          method,
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return response.json();
        }

        const responseText = await response.text();

        if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
          await this.sleep(100 * attempt);
          continue;
        }

        throw new RepairShoprWriteApiError(
          `RepairShopr write failed with status ${response.status}`,
          response.status,
          endpointForErrors,
          responseText,
        );
      } catch (error) {
        if (error instanceof RepairShoprWriteApiError || isAbortError(error)) {
          throw error;
        }

        if (attempt < MAX_ATTEMPTS) {
          await this.sleep(100 * attempt);
          continue;
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  private buildUrl(endpoint: string) {
    const url = new URL(endpoint, this.baseUrl);
    url.searchParams.set("api_key", this.config.apiKey);
    return url;
  }
}

export function createRepairShoprWriteClientFromEnv(env: {
  REPAIRSHOPR_SUBDOMAIN?: string;
  REPAIRSHOPR_API_KEY?: string;
  REPAIRSHOPR_TIMEOUT_MS: number;
}) {
  if (!env.REPAIRSHOPR_SUBDOMAIN || !env.REPAIRSHOPR_API_KEY) {
    throw new RepairShoprWriteConfigError(
      "RepairShopr credentials are required",
    );
  }

  return new RepairShoprWriteClient({
    subdomain: env.REPAIRSHOPR_SUBDOMAIN,
    apiKey: env.REPAIRSHOPR_API_KEY,
    timeoutMs: env.REPAIRSHOPR_TIMEOUT_MS,
  });
}

async function defaultTransport(
  url: URL,
  init: {
    method: RepairShoprWriteMethod;
    signal: AbortSignal;
    headers: Record<string, string>;
    body: string;
  },
) {
  return fetch(url, init);
}

function stripCredential(url: URL) {
  const redactedUrl = new URL(url);
  redactedUrl.searchParams.delete("api_key");
  return `${redactedUrl.pathname}${redactedUrl.search}`;
}

function recordPayload(response: unknown, key: string) {
  if (typeof response !== "object" || response === null) {
    return response;
  }

  const value: unknown = Reflect.get(response, key);
  return value ?? response;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function entityTypePath(entityType: RepairShoprEntityType) {
  if (entityType === "ticket_comment") {
    return "ticket_comments";
  }

  return `${entityType}s`;
}

function getDisplayLabel(
  entityType: RepairShoprEntityType,
  record:
    | RepairShoprCustomer
    | RepairShoprContact
    | RepairShoprLead
    | RepairShoprTicket
    | RepairShoprAppointment
    | RepairShoprTicketComment,
) {
  if (entityType === "customer") {
    return stringField(record, "business_then_name") ?? `Customer ${record.id}`;
  }

  if (entityType === "contact") {
    return stringField(record, "name") ?? `Contact ${record.id}`;
  }

  if (entityType === "lead") {
    return stringField(record, "business_then_name") ?? `Lead ${record.id}`;
  }

  if (entityType === "ticket") {
    return stringField(record, "subject") ?? `Ticket ${record.id}`;
  }

  if (entityType === "appointment") {
    return stringField(record, "summary") ?? `Appointment ${record.id}`;
  }

  return `${entityType} ${record.id}`;
}

function stringField(record: object, key: string) {
  const value: unknown = Reflect.get(record, key);
  return typeof value === "string" && value.length > 0 ? value : null;
}
