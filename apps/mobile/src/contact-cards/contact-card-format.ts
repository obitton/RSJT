import type {
  ContactCardMissingField,
  ContactCardVcardResponse,
  CustomerIntakeState,
} from "@rsjt/shared";

export function formatContactCardMissingField(field: ContactCardMissingField) {
  switch (field) {
    case "name":
      return "Name";
    case "phone":
      return "Phone";
    case "identified_state":
      return "Identified customer state";
  }
}

export function formatContactCardState(state: CustomerIntakeState) {
  switch (state) {
    case "unknown":
      return "Unknown";
    case "identifying":
      return "Identifying";
    case "collecting":
      return "Collecting";
    case "matched":
      return "Matched";
    case "review_ready":
      return "Review ready";
    case "blocked":
      return "Blocked";
  }
}

export function buildContactShareMessage(vcard: ContactCardVcardResponse) {
  return vcard.text;
}
