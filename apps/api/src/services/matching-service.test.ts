import type {
  MatchCandidate,
  RepairShoprEntityType,
  RepairShoprReference,
} from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import type {
  RepairShoprAppointment,
  RepairShoprContact,
  RepairShoprCustomer,
  RepairShoprInvoice,
  RepairShoprLead,
  RepairShoprPayment,
  RepairShoprTicket,
} from "../integrations/repairshopr/repairshopr-types.js";
import type {
  MatchCandidateStore,
  StoredMatchCandidate,
} from "../repositories/matches-repository.js";
import {
  MatchCandidateNotFoundError,
  MatchingService,
  type RepairShoprMatchReader,
} from "./matching-service.js";

const jobId = "00000000-0000-4000-8000-000000009001";

describe("MatchingService", () => {
  it("display-links one high confidence customer match", async () => {
    const service = new MatchingService(
      new InMemoryMatchStore(),
      fixtureRepairShoprReader({
        customers: [
          customer({
            id: 101,
            business_then_name: "Fixture Customer",
            email: "customer@example.invalid",
            phone: "555-0101",
          }),
        ],
      }),
      fixedNow,
      createIdSequence("00000000-0000-4000-8000-000000000101"),
    );

    const response = await service.searchJobMatches(jobId, {
      phone: "555-0101",
      email: "customer@example.invalid",
    });
    const match = onlyCandidate(response.candidates);

    expect(match.confidenceBand).toBe("high");
    expect(match.reasons.map((reason) => reason.label)).toEqual([
      "Phone match",
      "Email match",
    ]);
    expect(response.displayLinkedCandidateId).toBe(match.id);
    expect(response.requiresConfirmation).toBe(false);
  });

  it("searches customer contacts and scores the contact fields", async () => {
    const reader = fixtureRepairShoprReader({
      customers: [
        customer({
          id: 101,
          business_then_name: "Fixture Account",
        }),
      ],
      contacts: [
        contact({
          id: 201,
          customer_id: 101,
          name: "Fixture Contact",
          email: "contact@example.invalid",
          phone: "555-0101",
        }),
      ],
    });
    const service = new MatchingService(
      new InMemoryMatchStore(),
      reader,
      fixedNow,
      createIdSequence(
        "00000000-0000-4000-8000-000000000201",
        "00000000-0000-4000-8000-000000000202",
      ),
    );

    const response = await service.searchJobMatches(jobId, {
      name: "Fixture Account",
      phone: "555-0101",
      email: "contact@example.invalid",
    });
    const contactMatch = candidateByEntity(response.candidates, "contact");

    expect(reader.calls.contactCustomerIds).toEqual([101]);
    expect(contactMatch.confidenceBand).toBe("high");
    expect(response.displayLinkedCandidateId).toBe(contactMatch.id);
    expect(response.requiresConfirmation).toBe(false);
  });

  it("requires confirmation when more than one candidate is high confidence", async () => {
    const service = new MatchingService(
      new InMemoryMatchStore(),
      fixtureRepairShoprReader({
        customers: [
          customer({
            id: 101,
            business_then_name: "Fixture Customer",
            email: "customer@example.invalid",
            phone: "555-0101",
          }),
          customer({
            id: 102,
            business_then_name: "Fixture Branch",
            email: "customer@example.invalid",
            phone: "555-0101",
          }),
        ],
      }),
      fixedNow,
      createIdSequence(
        "00000000-0000-4000-8000-000000000101",
        "00000000-0000-4000-8000-000000000102",
      ),
    );

    const response = await service.searchJobMatches(jobId, {
      phone: "555-0101",
      email: "customer@example.invalid",
    });

    expect(response.candidates).toHaveLength(2);
    expect(
      response.candidates.map((candidate) => candidate.confidenceBand),
    ).toEqual(["high", "high"]);
    expect(response.displayLinkedCandidateId).toBeNull();
    expect(response.requiresConfirmation).toBe(true);
  });

  it("returns low confidence candidates without display-linking them", async () => {
    const service = new MatchingService(
      new InMemoryMatchStore(),
      fixtureRepairShoprReader({
        customers: [
          customer({
            id: 101,
            business_then_name: "Fixture Customer",
          }),
        ],
      }),
      fixedNow,
      createIdSequence("00000000-0000-4000-8000-000000000101"),
    );

    const response = await service.searchJobMatches(jobId, {
      name: "Fixture",
    });
    const match = onlyCandidate(response.candidates);

    expect(match.confidenceBand).toBe("low");
    expect(response.displayLinkedCandidateId).toBeNull();
    expect(response.requiresConfirmation).toBe(true);
  });

  it("deduplicates records returned from separate RepairShopr searches", async () => {
    const service = new MatchingService(
      new InMemoryMatchStore(),
      fixtureRepairShoprReader({
        customers: [
          customer({
            id: 101,
            business_then_name: "Fixture Customer",
            email: "customer@example.invalid",
            phone: "555-0101",
          }),
        ],
      }),
      fixedNow,
      createIdSequence("00000000-0000-4000-8000-000000000101"),
    );

    const response = await service.searchJobMatches(jobId, {
      phone: "555-0101",
      email: "customer@example.invalid",
    });

    expect(response.candidates).toHaveLength(1);
  });

  it("selects and unlinks candidates through the local store", async () => {
    const store = new InMemoryMatchStore();
    const service = new MatchingService(
      store,
      fixtureRepairShoprReader({
        customers: [
          customer({
            id: 101,
            business_then_name: "Fixture Customer",
            email: "customer@example.invalid",
            phone: "555-0101",
          }),
        ],
      }),
      fixedNow,
      createIdSequence("00000000-0000-4000-8000-000000000101"),
    );

    const searchResponse = await service.searchJobMatches(jobId, {
      phone: "555-0101",
      email: "customer@example.invalid",
    });
    const match = onlyCandidate(searchResponse.candidates);

    await expect(service.selectMatch(jobId, match.id)).resolves.toEqual({
      jobId,
      selectedCandidateId: match.id,
      repairShoprReference: match.repairShoprReference,
    });
    await expect(store.getSelectedReference(jobId)).resolves.toEqual(
      match.repairShoprReference,
    );
    await expect(service.unlinkMatch(jobId)).resolves.toEqual({
      jobId,
      selectedCandidateId: null,
      repairShoprReference: null,
    });
    await expect(store.getSelectedReference(jobId)).resolves.toBeNull();
  });

  it("reports an unknown selected candidate", async () => {
    const service = new MatchingService(
      new InMemoryMatchStore(),
      fixtureRepairShoprReader(),
      fixedNow,
    );

    await expect(
      service.selectMatch(jobId, "00000000-0000-4000-8000-000000000999"),
    ).rejects.toBeInstanceOf(MatchCandidateNotFoundError);
  });
});

type FixtureData = {
  customers?: RepairShoprCustomer[];
  contacts?: RepairShoprContact[];
  leads?: RepairShoprLead[];
  tickets?: RepairShoprTicket[];
  appointments?: RepairShoprAppointment[];
  invoices?: RepairShoprInvoice[];
  payments?: RepairShoprPayment[];
};

function fixtureRepairShoprReader(data: FixtureData = {}) {
  const calls = {
    contactCustomerIds: [] as number[],
  };
  const reader: RepairShoprMatchReader & { calls: typeof calls } = {
    calls,
    async listCustomers() {
      return data.customers ?? [];
    },
    async listContacts(query = {}) {
      if (query.customer_id) {
        calls.contactCustomerIds.push(query.customer_id);
      }

      return (data.contacts ?? []).filter(
        (item) =>
          query.customer_id === undefined ||
          item.customer_id === query.customer_id,
      );
    },
    async listLeads() {
      return data.leads ?? [];
    },
    async listTickets(query = {}) {
      return (data.tickets ?? []).filter(
        (item) =>
          (query.customer_id === undefined ||
            item.customer_id === query.customer_id) &&
          (query.contact_id === undefined ||
            item.contact_id === query.contact_id) &&
          (query.number === undefined || String(item.number) === query.number),
      );
    },
    async listAppointments() {
      return data.appointments ?? [];
    },
    async listInvoices() {
      return data.invoices ?? [];
    },
    async listPayments() {
      return data.payments ?? [];
    },
    toReference(entityType, record) {
      return {
        entityType,
        repairShoprId: String(record.id),
        displayLabel: displayLabel(entityType, record),
        url: `https://example.repairshopr.com/api/v1/${entityType}s/${record.id}`,
      };
    },
  };

  return reader;
}

class InMemoryMatchStore implements MatchCandidateStore {
  private readonly candidatesByJob = new Map<string, StoredMatchCandidate[]>();

  async replaceForJob(jobId: string, candidates: MatchCandidate[]) {
    this.candidatesByJob.set(
      jobId,
      candidates.map((candidate) => ({ ...candidate, selectedAt: null })),
    );
  }

  async listForJob(jobId: string) {
    return this.candidatesByJob.get(jobId) ?? [];
  }

  async selectForJob(jobId: string, candidateId: string) {
    const candidates = this.candidatesByJob.get(jobId) ?? [];
    const selected = candidates.find(
      (candidate) => candidate.id === candidateId,
    );

    if (!selected) {
      return null;
    }

    for (const candidate of candidates) {
      candidate.selectedAt = candidate.id === candidateId ? new Date() : null;
    }

    return selected.repairShoprReference;
  }

  async clearSelection(jobId: string) {
    for (const candidate of this.candidatesByJob.get(jobId) ?? []) {
      candidate.selectedAt = null;
    }
  }

  async getSelectedReference(jobId: string) {
    return (
      this.candidatesByJob.get(jobId)?.find((candidate) => candidate.selectedAt)
        ?.repairShoprReference ?? null
    );
  }
}

function customer(values: RepairShoprCustomer): RepairShoprCustomer {
  return values;
}

function contact(values: RepairShoprContact): RepairShoprContact {
  return values;
}

function displayLabel(entityType: RepairShoprEntityType, record: object) {
  return (
    stringField(record, "business_then_name") ??
    stringField(record, "name") ??
    stringField(record, "subject") ??
    `${entityType} ${stringField(record, "id")}`
  );
}

function stringField(record: object, key: string) {
  const value: unknown = Reflect.get(record, key);
  if (typeof value === "number") {
    return String(value);
  }

  return typeof value === "string" && value.length > 0 ? value : null;
}

function onlyCandidate(candidates: MatchCandidate[]) {
  expect(candidates).toHaveLength(1);
  const [candidate] = candidates;
  if (!candidate) {
    throw new Error("Expected one match candidate");
  }

  return candidate;
}

function candidateByEntity(
  candidates: MatchCandidate[],
  entityType: RepairShoprEntityType,
) {
  const candidate = candidates.find(
    (item) => item.repairShoprReference.entityType === entityType,
  );
  if (!candidate) {
    throw new Error(`Expected ${entityType} candidate`);
  }

  return candidate;
}

function createIdSequence(...ids: string[]) {
  let index = 0;

  return () => {
    const id = ids[index];
    index += 1;

    if (!id) {
      throw new Error("Missing deterministic candidate ID");
    }

    return id;
  };
}

function fixedNow() {
  return new Date("2026-05-19T12:00:00.000Z");
}
