import type { RepairShoprEntityType, RepairShoprReference } from "@rsjt/shared";
import { RepairShoprRateLimiter } from "./repairshopr-rate-limiter.js";
import {
  type RepairShoprAppointment,
  type RepairShoprAppointmentQuery,
  RepairShoprAppointmentSchema,
  RepairShoprAppointmentsResponseSchema,
  type RepairShoprContact,
  type RepairShoprContactQuery,
  RepairShoprContactSchema,
  RepairShoprContactsResponseSchema,
  type RepairShoprCustomer,
  type RepairShoprCustomerQuery,
  RepairShoprCustomerSchema,
  RepairShoprCustomersResponseSchema,
  type RepairShoprInvoice,
  type RepairShoprInvoiceQuery,
  RepairShoprInvoiceSchema,
  RepairShoprInvoicesResponseSchema,
  type RepairShoprLead,
  type RepairShoprLeadQuery,
  RepairShoprLeadSchema,
  RepairShoprLeadsResponseSchema,
  type RepairShoprPayment,
  type RepairShoprPaymentQuery,
  RepairShoprPaymentSchema,
  RepairShoprPaymentsResponseSchema,
  type RepairShoprTicket,
  type RepairShoprTicketComment,
  type RepairShoprTicketCommentForTicketQuery,
  type RepairShoprTicketCommentQuery,
  RepairShoprTicketCommentsResponseSchema,
  type RepairShoprTicketQuery,
  RepairShoprTicketSchema,
  RepairShoprTicketsResponseSchema,
  unwrapAppointment,
} from "./repairshopr-types.js";

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

export type RepairShoprClientConfig = {
  subdomain: string;
  apiKey: string;
  timeoutMs: number;
};

export type RepairShoprTransport = (
  url: URL,
  init: { method: "GET"; signal: AbortSignal },
) => Promise<Response>;

type RepairShoprClientOptions = {
  transport?: RepairShoprTransport;
  rateLimiter?: RepairShoprRateLimiter;
  sleep?: (delayMs: number) => Promise<void>;
};

type QueryValue = string | number | boolean | Array<string | number | boolean>;
type QueryParams = Record<string, QueryValue | undefined>;
type ResponseParser<TResponse> = {
  parse(input: unknown): TResponse;
};

export class RepairShoprApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
    readonly responseText: string,
  ) {
    super(message);
  }
}

export class RepairShoprConfigError extends Error {}

export class RepairShoprClient {
  private readonly baseUrl: URL;
  private readonly transport: RepairShoprTransport;
  private readonly rateLimiter: RepairShoprRateLimiter;
  private readonly sleep: (delayMs: number) => Promise<void>;

  constructor(
    private readonly config: RepairShoprClientConfig,
    options: RepairShoprClientOptions = {},
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

  async listCustomers(query: RepairShoprCustomerQuery = {}) {
    return this.getCollection(
      "customers",
      query,
      RepairShoprCustomersResponseSchema,
      (response) => response.customers,
    );
  }

  async getCustomer(id: number) {
    return this.getRecord(
      "customers",
      id,
      RepairShoprCustomerSchema,
      "customer",
    );
  }

  async listContacts(query: RepairShoprContactQuery = {}) {
    return this.getCollection(
      "contacts",
      query,
      RepairShoprContactsResponseSchema,
      (response) => response.contacts,
    );
  }

  async getContact(id: number) {
    return this.getRecord("contacts", id, RepairShoprContactSchema, "contact");
  }

  async listLeads(query: RepairShoprLeadQuery = {}) {
    return this.getCollection(
      "leads",
      query,
      RepairShoprLeadsResponseSchema,
      (response) => response.leads,
    );
  }

  async getLead(id: number) {
    return this.getRecord("leads", id, RepairShoprLeadSchema, "lead");
  }

  async listTickets(query: RepairShoprTicketQuery = {}) {
    return this.getCollection(
      "tickets",
      query,
      RepairShoprTicketsResponseSchema,
      (response) => response.tickets,
    );
  }

  async getTicket(id: number) {
    return this.getRecord("tickets", id, RepairShoprTicketSchema, "ticket");
  }

  async listAppointments(query: RepairShoprAppointmentQuery = {}) {
    const response = await this.getCollection(
      "appointments",
      query,
      RepairShoprAppointmentsResponseSchema,
      (payload) => payload.appointments,
    );

    return response.map(unwrapAppointment);
  }

  async getAppointment(id: number) {
    return this.getRecord(
      "appointments",
      id,
      RepairShoprAppointmentSchema,
      "appointment",
    );
  }

  async listInvoices(query: RepairShoprInvoiceQuery = {}) {
    return this.getCollection(
      "invoices",
      query,
      RepairShoprInvoicesResponseSchema,
      (response) => response.invoices,
    );
  }

  async getInvoice(id: number) {
    return this.getRecord("invoices", id, RepairShoprInvoiceSchema, "invoice");
  }

  async listPayments(query: RepairShoprPaymentQuery = {}) {
    return this.getCollection(
      "payments",
      query,
      RepairShoprPaymentsResponseSchema,
      (response) => response.payments,
    );
  }

  async getPayment(id: number) {
    return this.getRecord("payments", id, RepairShoprPaymentSchema, "payment");
  }

  async listTicketComments(query: RepairShoprTicketCommentQuery = {}) {
    return this.getCollection(
      "ticket_comments",
      query,
      RepairShoprTicketCommentsResponseSchema,
      (response) => response.comments,
    );
  }

  async listTicketCommentsForTicket(
    ticketId: number,
    query: RepairShoprTicketCommentForTicketQuery = {},
  ) {
    return this.getCollection(
      `tickets/${ticketId}/comments`,
      query,
      RepairShoprTicketCommentsResponseSchema,
      (response) => response.comments,
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
      | RepairShoprInvoice
      | RepairShoprPayment
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

  private async getCollection<TResponse, TItem>(
    endpoint: string,
    query: QueryParams,
    schema: ResponseParser<TResponse>,
    select: (response: TResponse) => TItem[],
  ): Promise<TItem[]> {
    const response = schema.parse(await this.request(endpoint, query));
    return select(response);
  }

  private async getRecord<TItem>(
    endpoint: string,
    id: number,
    schema: ResponseParser<TItem>,
    key: string,
  ): Promise<TItem> {
    const response = await this.request(`${endpoint}/${id}`);
    return schema.parse(recordPayload(response, key));
  }

  private async request(endpoint: string, query: QueryParams = {}) {
    const url = this.buildUrl(endpoint, query);
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
          method: "GET",
          signal: controller.signal,
        });

        if (response.ok) {
          return response.json();
        }

        const responseText = await response.text();

        if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
          await this.sleep(100 * attempt);
          continue;
        }

        throw new RepairShoprApiError(
          `RepairShopr request failed with status ${response.status}`,
          response.status,
          endpointForErrors,
          responseText,
        );
      } catch (error) {
        if (error instanceof RepairShoprApiError || isAbortError(error)) {
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

  private buildUrl(endpoint: string, query: QueryParams = {}) {
    const url = new URL(endpoint, this.baseUrl);

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    url.searchParams.set("api_key", this.config.apiKey);
    return url;
  }
}

export function createRepairShoprClientFromEnv(env: {
  REPAIRSHOPR_SUBDOMAIN?: string;
  REPAIRSHOPR_API_KEY?: string;
  REPAIRSHOPR_TIMEOUT_MS: number;
}) {
  if (!env.REPAIRSHOPR_SUBDOMAIN || !env.REPAIRSHOPR_API_KEY) {
    throw new RepairShoprConfigError("RepairShopr credentials are required");
  }

  return new RepairShoprClient({
    subdomain: env.REPAIRSHOPR_SUBDOMAIN,
    apiKey: env.REPAIRSHOPR_API_KEY,
    timeoutMs: env.REPAIRSHOPR_TIMEOUT_MS,
  });
}

async function defaultTransport(
  url: URL,
  init: { method: "GET"; signal: AbortSignal },
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
    | RepairShoprInvoice
    | RepairShoprPayment
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

  if (entityType === "invoice") {
    const invoiceNumber = labelField(record, "number");
    return invoiceNumber ? `Invoice ${invoiceNumber}` : `Invoice ${record.id}`;
  }

  if (entityType === "payment") {
    const referenceNumber = labelField(record, "ref_num");
    return referenceNumber
      ? `Payment ${referenceNumber}`
      : `Payment ${record.id}`;
  }

  return `${entityType} ${record.id}`;
}

function stringField(record: object, key: string) {
  const value: unknown = Reflect.get(record, key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function labelField(record: object, key: string) {
  const value: unknown = Reflect.get(record, key);
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return typeof value === "number" ? String(value) : null;
}
