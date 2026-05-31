import type { ExtractedFact, JobState, MissingField } from "@rsjt/shared";

export function formatJobState(state: JobState) {
  switch (state) {
    case "unmatched":
      return "Unmatched";
    case "intake":
      return "Intake";
    case "accepted":
      return "Accepted";
    case "scheduled":
      return "Scheduled";
    case "completed":
      return "Completed";
    case "payout_ready":
      return "Payout ready";
    case "closed":
      return "Closed";
  }
}

export function formatFactLabel(type: ExtractedFact["type"]) {
  switch (type) {
    case "customer_hint":
      return "Customer hint";
    case "work_performed":
      return "Work performed";
    case "duration_minutes":
      return "Duration";
    case "gross_charge_cents":
      return "Charge";
    case "expense_cents":
      return "Expense";
    case "reported_profit_cents":
      return "Reported profit";
    case "completion_state":
      return "Completion";
    case "scheduling_note":
      return "Scheduling";
    case "follow_up_needed":
      return "Follow-up";
  }
}

export function formatFactValue(fact: ExtractedFact) {
  switch (fact.type) {
    case "customer_hint":
    case "work_performed":
    case "scheduling_note":
      return fact.value.text;
    case "duration_minutes":
      return `${fact.value.minutes} min`;
    case "gross_charge_cents":
    case "reported_profit_cents":
      return formatMoney(fact.value.amountCents);
    case "expense_cents":
      return fact.value.description
        ? `${formatMoney(fact.value.amountCents)} ${fact.value.description}`
        : formatMoney(fact.value.amountCents);
    case "completion_state":
      return formatCompletionState(fact.value.state);
    case "follow_up_needed":
      return fact.value.needed
        ? (fact.value.note ?? "Follow-up needed")
        : "No follow-up needed";
  }
}

export function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function formatMissingFieldLabel(field: MissingField) {
  switch (field) {
    case "customer_hint":
      return "Customer";
    case "expense_cents":
      return "Expense";
    case "completion_state":
      return "Completion";
    case "follow_up_needed":
      return "Follow-up";
  }
}

export function quickReplyForMissingField(field: MissingField) {
  switch (field) {
    case "customer_hint":
      return "Customer: ";
    case "expense_cents":
      return "No parts or materials.";
    case "completion_state":
      return "Job completed.";
    case "follow_up_needed":
      return "No follow up needed.";
  }
}

function formatCompletionState(
  state: Extract<ExtractedFact, { type: "completion_state" }>["value"]["state"],
) {
  switch (state) {
    case "completed":
      return "Completed";
    case "not_completed":
      return "Not completed";
    case "likely_completed":
      return "Likely completed";
    case "unknown":
      return "Unknown";
  }
}

function formatMoney(amountCents: number) {
  return `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
}
