import { isRecord } from "@/auth/session-validation";
import type {
  ContactCardData,
  ContactCardMissingField,
  ContactCardPreviewResponse,
  ContactCardVcardResponse,
  CustomerIntakeState,
} from "@rsjt/shared";

const CONTACT_CARD_MISSING_FIELDS = [
  "name",
  "phone",
  "identified_state",
] as const satisfies readonly ContactCardMissingField[];

const CUSTOMER_INTAKE_STATES = [
  "unknown",
  "identifying",
  "collecting",
  "matched",
  "review_ready",
  "blocked",
] as const satisfies readonly CustomerIntakeState[];

export function toContactCardPreviewResponse(
  value: unknown,
): ContactCardPreviewResponse | null {
  if (
    !isRecord(value) ||
    typeof value.available !== "boolean" ||
    !isCustomerIntakeState(value.state)
  ) {
    return null;
  }

  const missingFields = toMissingFieldArray(value.missingFields);
  const contact =
    value.contact === null ? null : toContactCardData(value.contact);

  if (!missingFields || contact === undefined) {
    return null;
  }

  return {
    available: value.available,
    missingFields,
    state: value.state,
    contact,
  };
}

export function toContactCardVcardResponse(
  value: unknown,
): ContactCardVcardResponse | null {
  if (!isRecord(value) || typeof value.text !== "string" || !value.text) {
    return null;
  }

  return { text: value.text };
}

function toContactCardData(value: unknown): ContactCardData | undefined {
  if (
    !isRecord(value) ||
    typeof value.conversationId !== "string" ||
    typeof value.fullName !== "string" ||
    value.fullName.length === 0 ||
    typeof value.phone !== "string" ||
    value.phone.length === 0
  ) {
    return undefined;
  }

  const email = toNullableString(value.email);
  const serviceAddress = toNullableString(value.serviceAddress);

  if (email === undefined || serviceAddress === undefined) {
    return undefined;
  }

  return {
    conversationId: value.conversationId,
    fullName: value.fullName,
    phone: value.phone,
    email,
    serviceAddress,
  };
}

function toMissingFieldArray(value: unknown): ContactCardMissingField[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const fields = value.filter(isContactCardMissingField);
  return fields.length === value.length ? fields : null;
}

function isContactCardMissingField(
  value: unknown,
): value is ContactCardMissingField {
  return (
    typeof value === "string" &&
    CONTACT_CARD_MISSING_FIELDS.includes(value as ContactCardMissingField)
  );
}

function isCustomerIntakeState(value: unknown): value is CustomerIntakeState {
  return (
    typeof value === "string" &&
    CUSTOMER_INTAKE_STATES.includes(value as CustomerIntakeState)
  );
}

function toNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}
