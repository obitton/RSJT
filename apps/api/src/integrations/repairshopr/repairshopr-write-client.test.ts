import { describe, expect, it } from "vitest";
import appointmentsFixture from "./fixtures/appointments.json" with {
  type: "json",
};
import contactsFixture from "./fixtures/contacts.json" with { type: "json" };
import customersFixture from "./fixtures/customers.json" with { type: "json" };
import leadsFixture from "./fixtures/leads.json" with { type: "json" };
import ticketCommentsFixture from "./fixtures/ticket-comments.json" with {
  type: "json",
};
import ticketsFixture from "./fixtures/tickets.json" with { type: "json" };
import { RepairShoprRateLimiter } from "./repairshopr-rate-limiter.js";
import {
  RepairShoprWriteApiError,
  RepairShoprWriteClient,
  RepairShoprWriteConfigError,
  type RepairShoprWriteMethod,
  type RepairShoprWriteTransport,
  createRepairShoprWriteClientFromEnv,
} from "./repairshopr-write-client.js";

describe("RepairShoprWriteClient", () => {
  it("builds write URLs with API key query auth", async () => {
    const calls: CapturedWriteCall[] = [];
    const client = createClient(calls, {
      lead: first(leadsFixture.leads, "lead"),
    });

    await client.createLead({ first_name: "Sam" });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.toString()).toBe(
      "https://demo.repairshopr.com/api/v1/leads?api_key=secret-key",
    );
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toBe(JSON.stringify({ first_name: "Sam" }));
  });

  it("supports configured write methods with fixture responses", async () => {
    const calls: CapturedWriteCall[] = [];
    const client = createClient(calls, {
      customer: first(customersFixture.customers, "customer"),
      contact: first(contactsFixture.contacts, "contact"),
      lead: first(leadsFixture.leads, "lead"),
      ticket: first(ticketsFixture.tickets, "ticket"),
      comment: first(ticketCommentsFixture.comments, "comment"),
      appointment: first(appointmentsFixture.appointments, "appointment")
        .appointment,
    });

    await expect(
      client.updateCustomer(101, { firstname: "Sam" }),
    ).resolves.toMatchObject({ id: 101 });
    await expect(
      client.updateContact(201, { name: "Sam" }),
    ).resolves.toMatchObject({ id: 201 });
    await expect(
      client.createLead({ first_name: "Sam" }),
    ).resolves.toMatchObject({ id: 301 });
    await expect(
      client.createTicket({ subject: "Repair" }),
    ).resolves.toMatchObject({ id: 401 });
    await expect(
      client.createTicketComment(401, { body: "Note" }),
    ).resolves.toMatchObject({ id: 801 });
    await expect(
      client.createAppointment({ summary: "Visit" }),
    ).resolves.toMatchObject({ id: 501 });

    expect(calls.map((call) => call.method)).toEqual([
      "PUT",
      "PUT",
      "POST",
      "POST",
      "POST",
      "POST",
    ]);
    expect(calls.map((call) => call.url.pathname)).toEqual([
      "/api/v1/customers/101",
      "/api/v1/contacts/201",
      "/api/v1/leads",
      "/api/v1/tickets",
      "/api/v1/tickets/401/comments",
      "/api/v1/appointments",
    ]);
  });

  it("normalizes written records to RepairShopr references", () => {
    const client = createClient([], {
      lead: first(leadsFixture.leads, "lead"),
    });

    expect(
      client.toReference("lead", first(leadsFixture.leads, "lead")),
    ).toEqual({
      entityType: "lead",
      repairShoprId: "301",
      displayLabel: "Sam Rivera",
      url: "https://demo.repairshopr.com/api/v1/leads/301",
    });
  });

  it("does not retry permanent write failures", async () => {
    const calls: CapturedWriteCall[] = [];
    const client = createClient(calls, {}, 422, "invalid");

    await expect(client.createLead({})).rejects.toMatchObject({
      status: 422,
      endpoint: "/api/v1/leads",
      responseText: "invalid",
    });
    expect(calls).toHaveLength(1);
  });

  it("retries transient write failures", async () => {
    const calls: CapturedWriteCall[] = [];
    const client = createClient(
      calls,
      { lead: first(leadsFixture.leads, "lead") },
      [503, 200],
    );

    await expect(
      client.createLead({ first_name: "Sam" }),
    ).resolves.toMatchObject({ id: 301 });
    expect(calls).toHaveLength(2);
  });

  it("redacts API keys from write errors", async () => {
    const client = createClient([], {}, 401, "unauthorized");

    await expect(client.createLead({})).rejects.toSatisfy((error) => {
      expect(error).toBeInstanceOf(RepairShoprWriteApiError);
      expect(String(error.message)).not.toContain("secret-key");
      if (!(error instanceof RepairShoprWriteApiError)) {
        return false;
      }
      expect(error.endpoint).toBe("/api/v1/leads");
      return true;
    });
  });

  it("fails client creation when credentials are missing", () => {
    expect(() =>
      createRepairShoprWriteClientFromEnv({
        REPAIRSHOPR_TIMEOUT_MS: 10000,
      }),
    ).toThrow(RepairShoprWriteConfigError);
  });
});

type CapturedWriteCall = {
  url: URL;
  method: RepairShoprWriteMethod;
  body: string;
};

function createClient(
  calls: CapturedWriteCall[],
  payload: unknown,
  statuses: number | number[] = 200,
  responseText = JSON.stringify(payload),
) {
  const statusQueue = Array.isArray(statuses) ? [...statuses] : [statuses];
  const transport: RepairShoprWriteTransport = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body });
    const status =
      statusQueue.shift() ?? statusQueue[statusQueue.length - 1] ?? 200;

    return new Response(
      status === 200 ? JSON.stringify(payload) : responseText,
      {
        status,
      },
    );
  };

  return new RepairShoprWriteClient(
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

function first<T>(items: readonly T[], fixtureName: string) {
  const item = items[0];
  if (item === undefined) {
    throw new Error(`Missing ${fixtureName} fixture`);
  }

  return item;
}
