import { createApiClient } from "@/api/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const jobId = "00000000-0000-4000-8000-000000200001";
const reminderId = "00000000-0000-4000-8000-000000200002";
const conversationId = "00000000-0000-4000-8000-000000200003";
const token = "session-token-tech";

describe("mobile critical path smoke", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("walks the tech closeout path through mocked API calls", async () => {
    const calls = installFetchMock();
    const client = createApiClient("https://local.test");

    const reminders = await client.listReminders(token);
    const generated = await client.generateReminders(token);
    const money = await client.getJobMoney(token, jobId);
    const updated = await client.updateJobMoney(token, jobId, {
      completed: true,
      grossChargeCents: 18000,
      expenses: [{ category: "parts", amountCents: 2500 }],
    });

    expect(reminders.reminders[0]?.createdAt).toBeInstanceOf(Date);
    expect(generated.createdCount).toBe(0);
    expect(money.summary.payoutReady).toBe(false);
    expect(updated.summary.payoutReady).toBe(true);
    expect(calls.map((call) => `${call.method} ${call.pathname}`)).toEqual([
      "GET /reminders",
      "POST /reminders/generate",
      `GET /jobs/${jobId}/money`,
      `PATCH /jobs/${jobId}/money`,
    ]);
  });

  it("walks the manager review path through mocked API calls", async () => {
    const calls = installFetchMock();
    const client = createApiClient("https://local.test");

    const dashboard = await client.getManagerDashboard(token);
    const stale = await client.listStaleReminders(token);
    const contactCard = await client.getContactCardPreview(
      token,
      conversationId,
    );
    const split = await client.overrideJobSplitCategory(token, jobId, {
      splitCategory: "customer_service_heavy",
      reason: "Smoke review.",
    });

    expect(dashboard.summary.payoutReadyCount).toBe(1);
    expect(stale.reminders[0]?.stale).toBe(true);
    expect(contactCard.available).toBe(true);
    expect(split.summary.splitCategory).toBe("customer_service_heavy");
    expect(calls.map((call) => `${call.method} ${call.pathname}`)).toEqual([
      "GET /manager/dashboard",
      "GET /manager/reminders/stale",
      `GET /manager/conversations/${conversationId}/contact-card/preview`,
      `POST /manager/jobs/${jobId}/split-override`,
    ]);
  });
});

type FetchCall = {
  method: string;
  pathname: string;
  body: unknown;
};

function installFetchMock() {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = toUrl(input);
      const method = init?.method ?? "GET";
      const body = parseBody(init?.body);
      calls.push({ method, pathname: url.pathname, body });

      return new Response(JSON.stringify(responseFor(url.pathname, method)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );
  return calls;
}

function toUrl(input: string | URL | Request) {
  if (typeof input === "string") {
    return new URL(input);
  }
  if (input instanceof URL) {
    return input;
  }
  return new URL(input.url);
}

function parseBody(body: BodyInit | null | undefined) {
  if (typeof body !== "string") {
    return null;
  }
  return JSON.parse(body) as unknown;
}

function responseFor(pathname: string, method: string) {
  if (method === "GET" && pathname === "/reminders") {
    return {
      reminders: [
        {
          id: reminderId,
          jobId,
          jobState: "scheduled",
          customerLabel: "Fixture laptop repair",
          reason: "missing_completion",
          createdAt: "2026-05-26T12:00:00.000Z",
          resolvedAt: null,
          stale: false,
        },
      ],
    };
  }

  if (method === "POST" && pathname === "/reminders/generate") {
    return { createdCount: 0, resolvedCount: 1, reminders: [] };
  }

  if (method === "GET" && pathname === `/jobs/${jobId}/money`) {
    return moneyResponse(false, "new_lead");
  }

  if (method === "PATCH" && pathname === `/jobs/${jobId}/money`) {
    return moneyResponse(true, "new_lead");
  }

  if (method === "GET" && pathname === "/manager/dashboard") {
    return {
      summary: {
        leadsCount: 0,
        needsTechAnswerCount: 0,
        workingOnCount: 0,
        jobsCount: 0,
        repairCount: 0,
        openCount: 0,
        scheduledCount: 0,
        completedCount: 0,
        unmatchedCount: 0,
        takeoverCount: 0,
        payoutReadyCount: 1,
      },
      groups: {
        openJobs: [],
        scheduledJobs: [],
        completedJobs: [],
        unmatchedJobs: [],
        payoutReadyJobs: [
          {
            id: jobId,
            state: "payout_ready",
            customerLabel: "Fixture laptop repair",
            updatedAt: "2026-05-26T12:00:00.000Z",
            pendingApprovalCount: 0,
          },
        ],
      },
      leads: [],
      takeoverConversations: [],
    };
  }

  if (method === "GET" && pathname === "/manager/reminders/stale") {
    return {
      reminders: [
        {
          id: reminderId,
          jobId,
          jobState: "completed",
          customerLabel: "Fixture laptop repair",
          reason: "follow_up_needed",
          createdAt: "2026-05-25T12:00:00.000Z",
          resolvedAt: null,
          stale: true,
        },
      ],
    };
  }

  if (
    method === "GET" &&
    pathname === `/manager/conversations/${conversationId}/contact-card/preview`
  ) {
    return {
      available: true,
      missingFields: [],
      state: "review_ready",
      contact: {
        conversationId,
        fullName: "Casey Customer",
        phone: "+15555550200",
        email: "casey@example.com",
        serviceAddress: "123 Main Street",
      },
    };
  }

  if (
    method === "POST" &&
    pathname === `/manager/jobs/${jobId}/split-override`
  ) {
    return moneyResponse(true, "customer_service_heavy");
  }

  throw new Error(`Unexpected request ${method} ${pathname}`);
}

function moneyResponse(
  payoutReady: boolean,
  splitCategory: "new_lead" | "customer_service_heavy",
) {
  return {
    summary: {
      jobId,
      state: payoutReady ? "payout_ready" : "completed",
      isCompleted: true,
      splitCategory,
      grossChargeCents: 18000,
      reportedExpenseCents: 2500,
      reportedProfitCents: null,
      calculatedProfitCents: 15500,
      profitBasis: "charge_minus_reported_expenses",
      managerPercent: splitCategory === "customer_service_heavy" ? 50 : 20,
      techPercent: splitCategory === "customer_service_heavy" ? 50 : 80,
      managerShareCents:
        splitCategory === "customer_service_heavy" ? 7750 : 3100,
      techShareCents: splitCategory === "customer_service_heavy" ? 7750 : 12400,
      payoutReady,
      missingFields: [],
    },
    expenses: [
      {
        id: "00000000-0000-4000-8000-000000200004",
        jobId,
        category: "parts",
        amountCents: 2500,
        description: "Adapter",
        enteredByUserId: "00000000-0000-4000-8000-000000000020",
        createdAt: "2026-05-26T12:00:00.000Z",
        updatedAt: "2026-05-26T12:00:00.000Z",
      },
    ],
  };
}
