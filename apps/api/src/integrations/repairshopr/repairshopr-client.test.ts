import { describe, expect, it } from "vitest";
import appointmentsFixture from "./fixtures/appointments.json" with {
  type: "json",
};
import contactsFixture from "./fixtures/contacts.json" with { type: "json" };
import customersFixture from "./fixtures/customers.json" with { type: "json" };
import invoicesFixture from "./fixtures/invoices.json" with { type: "json" };
import leadsFixture from "./fixtures/leads.json" with { type: "json" };
import paymentsFixture from "./fixtures/payments.json" with { type: "json" };
import ticketCommentsFixture from "./fixtures/ticket-comments.json" with {
  type: "json",
};
import ticketsFixture from "./fixtures/tickets.json" with { type: "json" };
import {
  RepairShoprApiError,
  RepairShoprClient,
  RepairShoprConfigError,
  type RepairShoprTransport,
  createRepairShoprClientFromEnv,
} from "./repairshopr-client.js";
import { RepairShoprRateLimiter } from "./repairshopr-rate-limiter.js";

describe("RepairShoprClient", () => {
  it("builds read URLs with API key query auth", async () => {
    const calls: CapturedCall[] = [];
    const client = createClient(calls, customersFixture);

    await client.listCustomers({ query: "sam", page: 2 });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.toString()).toBe(
      "https://demo.repairshopr.com/api/v1/customers?query=sam&page=2&api_key=secret-key",
    );
    expect(calls[0]?.method).toBe("GET");
  });

  it("supports read-only collection methods with fixtures", async () => {
    const calls: CapturedCall[] = [];
    const client = createClient(calls, {
      customers: customersFixture,
      contacts: contactsFixture,
      leads: leadsFixture,
      tickets: ticketsFixture,
      appointments: appointmentsFixture,
      invoices: invoicesFixture,
      payments: paymentsFixture,
      ticket_comments: ticketCommentsFixture,
    });

    await expect(client.listCustomers()).resolves.toHaveLength(1);
    await expect(client.listContacts()).resolves.toHaveLength(1);
    await expect(client.listLeads()).resolves.toHaveLength(1);
    await expect(client.listTickets()).resolves.toHaveLength(1);
    await expect(client.listAppointments()).resolves.toMatchObject([
      { id: 501, summary: "Washer diagnosis" },
    ]);
    await expect(client.listInvoices()).resolves.toHaveLength(1);
    await expect(client.listPayments()).resolves.toHaveLength(1);
    await expect(client.listTicketComments()).resolves.toHaveLength(1);
    await expect(client.listTicketCommentsForTicket(401)).resolves.toHaveLength(
      1,
    );

    expect(calls.map((call) => call.method)).toEqual(Array(9).fill("GET"));
  });

  it("supports by-ID read methods", async () => {
    const calls: CapturedCall[] = [];
    const client = createClient(calls, {
      "customers/101": {
        customer: first(customersFixture.customers, "customer"),
      },
      "contacts/201": { contact: first(contactsFixture.contacts, "contact") },
      "leads/301": { lead: first(leadsFixture.leads, "lead") },
      "tickets/401": { ticket: first(ticketsFixture.tickets, "ticket") },
      "appointments/501": {
        appointment: first(appointmentsFixture.appointments, "appointment")
          .appointment,
      },
      "invoices/601": { invoice: first(invoicesFixture.invoices, "invoice") },
      "payments/701": { payment: first(paymentsFixture.payments, "payment") },
    });

    await expect(client.getCustomer(101)).resolves.toMatchObject({ id: 101 });
    await expect(client.getContact(201)).resolves.toMatchObject({ id: 201 });
    await expect(client.getLead(301)).resolves.toMatchObject({ id: 301 });
    await expect(client.getTicket(401)).resolves.toMatchObject({ id: 401 });
    await expect(client.getAppointment(501)).resolves.toMatchObject({
      id: 501,
    });
    await expect(client.getInvoice(601)).resolves.toMatchObject({ id: 601 });
    await expect(client.getPayment(701)).resolves.toMatchObject({ id: 701 });

    expect(calls.map((call) => call.method)).toEqual(Array(7).fill("GET"));
  });

  it("normalizes supported entities to RepairShopr references", () => {
    const client = createClient([], customersFixture);

    expect(
      client.toReference(
        "customer",
        first(customersFixture.customers, "customer"),
      ),
    ).toEqual({
      entityType: "customer",
      repairShoprId: "101",
      displayLabel: "Sam Rivera",
      url: "https://demo.repairshopr.com/api/v1/customers/101",
    });
    expect(
      client.toReference("ticket", first(ticketsFixture.tickets, "ticket")),
    ).toMatchObject({
      entityType: "ticket",
      repairShoprId: "401",
      displayLabel: "Washer repair",
    });
  });

  it("does not retry permanent API failures", async () => {
    const calls: CapturedCall[] = [];
    const client = createClient(calls, {}, 404, "missing");

    await expect(client.listCustomers()).rejects.toMatchObject({
      status: 404,
      endpoint: "/api/v1/customers",
      responseText: "missing",
    });

    expect(calls).toHaveLength(1);
  });

  it("retries transient API failures", async () => {
    const calls: CapturedCall[] = [];
    const client = createClient(calls, customersFixture, [503, 200]);

    await expect(client.listCustomers()).resolves.toHaveLength(1);

    expect(calls).toHaveLength(2);
  });

  it("redacts API keys from API errors", async () => {
    const client = createClient([], {}, 401, "unauthorized");

    await expect(client.listCustomers()).rejects.toSatisfy((error) => {
      expect(error).toBeInstanceOf(RepairShoprApiError);
      expect(String(error.message)).not.toContain("secret-key");
      if (!(error instanceof RepairShoprApiError)) {
        return false;
      }
      expect(error.endpoint).toBe("/api/v1/customers");
      return true;
    });
  });

  it("aborts after timeout without retrying the timeout", async () => {
    const calls: CapturedCall[] = [];
    const client = new RepairShoprClient(
      {
        subdomain: "demo",
        apiKey: "secret-key",
        timeoutMs: 1,
      },
      {
        rateLimiter: new RepairShoprRateLimiter(),
        transport: async (url, init) => {
          calls.push({ url, method: init.method });
          return new Promise<Response>((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        },
        sleep: async () => {},
      },
    );

    await expect(client.listCustomers()).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(calls).toHaveLength(1);
  });

  it("fails client creation when credentials are missing", () => {
    expect(() =>
      createRepairShoprClientFromEnv({
        REPAIRSHOPR_TIMEOUT_MS: 10000,
      }),
    ).toThrow(RepairShoprConfigError);
  });
});

type CapturedCall = {
  url: URL;
  method: "GET";
};

function createClient(
  calls: CapturedCall[],
  payloads: unknown,
  statuses: number | number[] = 200,
  responseText = JSON.stringify(payloads),
) {
  const statusQueue = Array.isArray(statuses) ? [...statuses] : [statuses];
  const transport: RepairShoprTransport = async (url, init) => {
    calls.push({ url, method: init.method });
    const status =
      statusQueue.shift() ?? statusQueue[statusQueue.length - 1] ?? 200;
    const payload = payloadForUrl(url, payloads);

    return new Response(
      status === 200 ? JSON.stringify(payload) : responseText,
      {
        status,
      },
    );
  };

  return new RepairShoprClient(
    {
      subdomain: "demo",
      apiKey: "secret-key",
      timeoutMs: 10000,
    },
    {
      rateLimiter: new RepairShoprRateLimiter(),
      transport,
      sleep: async () => {},
    },
  );
}

function payloadForUrl(url: URL, payloads: unknown) {
  if (!isPayloadMap(payloads)) {
    return payloads;
  }

  const endpoint = url.pathname.replace("/api/v1/", "");
  if (endpoint.endsWith("/comments")) {
    return payloads.ticket_comments ?? payloads;
  }

  return (
    payloads[endpoint] ?? payloads[endpoint.split("/")[0] ?? ""] ?? payloads
  );
}

function isPayloadMap(payloads: unknown): payloads is Record<string, unknown> {
  return (
    typeof payloads === "object" &&
    payloads !== null &&
    !Array.isArray(payloads) &&
    Object.keys(payloads).some(
      (key) => key.includes("/") || key === "ticket_comments",
    )
  );
}

function first<T>(items: readonly T[], fixtureName: string) {
  const item = items[0];
  if (item === undefined) {
    throw new Error(`Missing ${fixtureName} fixture`);
  }

  return item;
}
