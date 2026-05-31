import type { CustomerIntakeSnapshot } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import {
  ContactCardNotFoundError,
  ContactCardService,
  type ContactCardStore,
  ContactCardUnavailableError,
} from "./contact-card-service.js";

describe("ContactCardService", () => {
  it("returns an available preview for an identified customer", async () => {
    const service = new ContactCardService(
      new FakeContactCardStore(snapshotFixture()),
    );

    const preview = await service.getPreview(snapshotFixture().conversationId);

    expect(preview.available).toBe(true);
    expect(preview.contact).toMatchObject({
      fullName: "Casey Customer",
      phone: "+15555550100",
    });
  });

  it("returns missing fields for incomplete contact data", async () => {
    const service = new ContactCardService(
      new FakeContactCardStore(
        snapshotFixture({
          phone: null,
        }),
      ),
    );

    const preview = await service.getPreview(snapshotFixture().conversationId);

    expect(preview.available).toBe(false);
    expect(preview.contact).toBeNull();
    expect(preview.missingFields).toEqual(["phone"]);
  });

  it("treats blocked and unknown states as unavailable", async () => {
    const blocked = new ContactCardService(
      new FakeContactCardStore(snapshotFixture({ state: "blocked" })),
    );
    const unknown = new ContactCardService(
      new FakeContactCardStore(snapshotFixture({ state: "unknown" })),
    );

    await expect(
      blocked.getVcard(snapshotFixture().conversationId),
    ).rejects.toBeInstanceOf(ContactCardUnavailableError);
    await expect(
      unknown.getVcard(snapshotFixture().conversationId),
    ).rejects.toBeInstanceOf(ContactCardUnavailableError);
  });

  it("generates vCard text with optional email and service address", async () => {
    const service = new ContactCardService(
      new FakeContactCardStore(snapshotFixture()),
    );

    const text = await service.getVcard(snapshotFixture().conversationId);

    expect(text).toContain("BEGIN:VCARD");
    expect(text).toContain("FN:Casey Customer");
    expect(text).toContain("TEL;TYPE=CELL:+15555550100");
    expect(text).toContain("EMAIL:casey@example.com");
    expect(text).toContain("ADR;TYPE=WORK:;;123 Main Street;;;;");
  });

  it("escapes vCard text values", async () => {
    const service = new ContactCardService(
      new FakeContactCardStore(
        snapshotFixture({
          customerName: "Casey; Customer, Jr",
          serviceAddress: "123 Main Street\nSuite 4",
        }),
      ),
    );

    const text = await service.getVcard(snapshotFixture().conversationId);

    expect(text).toContain("FN:Casey\\; Customer\\, Jr");
    expect(text).toContain("123 Main Street\\nSuite 4");
  });

  it("throws when the conversation is missing", async () => {
    const service = new ContactCardService(new FakeContactCardStore(null));

    await expect(
      service.getPreview(snapshotFixture().conversationId),
    ).rejects.toBeInstanceOf(ContactCardNotFoundError);
  });
});

class FakeContactCardStore implements ContactCardStore {
  constructor(private readonly snapshot: CustomerIntakeSnapshot | null) {}

  async getConversationSnapshot() {
    return this.snapshot;
  }
}

function snapshotFixture(
  overrides: Partial<CustomerIntakeSnapshot> = {},
): CustomerIntakeSnapshot {
  return {
    conversationId: "00000000-0000-4000-8000-000000060301",
    state: "review_ready",
    customerName: "Casey Customer",
    phone: "+15555550100",
    email: "casey@example.com",
    serviceAddress: "123 Main Street",
    problemDescription: "My laptop will not boot.",
    preferredTiming: null,
    blockedReason: null,
    spamScore: 0,
    matchedReference: null,
    matchedConfidenceBand: null,
    takeoverActive: false,
    lastInboundMessageId: "00000000-0000-4000-8000-000000060302",
    lastInboundAt: new Date("2026-05-26T00:00:00.000Z"),
    updatedAt: new Date("2026-05-26T00:00:00.000Z"),
    ...overrides,
  };
}
