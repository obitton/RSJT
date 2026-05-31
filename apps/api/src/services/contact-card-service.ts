import type {
  ContactCardData,
  ContactCardMissingField,
  ContactCardPreviewResponse,
  CustomerIntakeSnapshot,
  CustomerIntakeState,
} from "@rsjt/shared";
import {
  ContactCardDataSchema,
  ContactCardPreviewResponseSchema,
  ContactCardVcardResponseSchema,
} from "@rsjt/shared";

export interface ContactCardStore {
  getConversationSnapshot(
    conversationId: string,
  ): Promise<CustomerIntakeSnapshot | null>;
}

export interface ContactCardServiceApi {
  getPreview(conversationId: string): Promise<ContactCardPreviewResponse>;
  getVcard(conversationId: string): Promise<string>;
}

export class ContactCardNotFoundError extends Error {
  constructor() {
    super("Contact card conversation not found");
  }
}

export class ContactCardUnavailableError extends Error {
  constructor() {
    super("Contact card is unavailable");
  }
}

const CONTACT_CARD_STATES = [
  "collecting",
  "matched",
  "review_ready",
] as const satisfies readonly CustomerIntakeState[];

export class ContactCardService implements ContactCardServiceApi {
  constructor(private readonly store: ContactCardStore) {}

  async getPreview(conversationId: string) {
    const snapshot = await this.requireSnapshot(conversationId);
    return buildPreview(snapshot);
  }

  async getVcard(conversationId: string) {
    const preview = await this.getPreview(conversationId);
    if (!preview.contact) {
      throw new ContactCardUnavailableError();
    }

    return ContactCardVcardResponseSchema.parse({
      text: buildVcard(preview.contact),
    }).text;
  }

  private async requireSnapshot(conversationId: string) {
    const snapshot = await this.store.getConversationSnapshot(conversationId);
    if (!snapshot) {
      throw new ContactCardNotFoundError();
    }
    return snapshot;
  }
}

function buildPreview(
  snapshot: CustomerIntakeSnapshot,
): ContactCardPreviewResponse {
  const missingFields = findMissingFields(snapshot);
  const contact =
    missingFields.length === 0
      ? ContactCardDataSchema.parse({
          conversationId: snapshot.conversationId,
          fullName: snapshot.customerName,
          phone: snapshot.phone,
          email: snapshot.email,
          serviceAddress: snapshot.serviceAddress,
        })
      : null;

  return ContactCardPreviewResponseSchema.parse({
    available: contact !== null,
    missingFields,
    state: snapshot.state,
    contact,
  });
}

function findMissingFields(
  snapshot: CustomerIntakeSnapshot,
): ContactCardMissingField[] {
  const missingFields: ContactCardMissingField[] = [];

  if (!snapshot.customerName) {
    missingFields.push("name");
  }

  if (!snapshot.phone) {
    missingFields.push("phone");
  }

  if (!CONTACT_CARD_STATES.some((state) => state === snapshot.state)) {
    missingFields.push("identified_state");
  }

  return missingFields;
}

function buildVcard(contact: ContactCardData) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVcardText(contact.fullName)}`,
    `N:${escapeVcardText(contact.fullName)};;;;`,
    `TEL;TYPE=CELL:${escapeVcardText(contact.phone)}`,
  ];

  if (contact.email) {
    lines.push(`EMAIL:${escapeVcardText(contact.email)}`);
  }

  if (contact.serviceAddress) {
    const address = escapeVcardText(contact.serviceAddress);
    lines.push(`ADR;TYPE=WORK:;;${address};;;;`);
    lines.push(`NOTE:Service address: ${address}`);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function escapeVcardText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
