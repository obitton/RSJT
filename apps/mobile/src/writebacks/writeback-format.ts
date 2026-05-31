import type {
  WritebackAction,
  WritebackExecution,
  WritebackExecutionState,
} from "@rsjt/shared";

export function formatWritebackState(state: WritebackExecutionState) {
  switch (state) {
    case "ready":
      return "Ready";
    case "succeeded":
      return "Completed";
    case "failed":
      return "Failed";
    case "blocked":
      return "Blocked";
  }
}

export function formatWritebackAction(action: WritebackAction) {
  switch (action) {
    case "customer_update":
      return "Update customer";
    case "contact_update":
      return "Update contact";
    case "lead_create":
      return "Create lead";
    case "ticket_create":
      return "Create ticket";
    case "ticket_comment_create":
      return "Add ticket comment";
    case "appointment_create":
      return "Create appointment";
    case "customer_message_send":
      return "Send customer message";
  }
}

export function formatWritebackTarget(execution: WritebackExecution) {
  if (execution.targetKind === "customer_message") {
    return "Customer message";
  }

  if (execution.repairShoprEntityType && execution.repairShoprId) {
    return `${formatEntity(execution.repairShoprEntityType)} ${execution.repairShoprId}`;
  }

  return "RepairShopr";
}

export function formatWritebackIssue(execution: WritebackExecution) {
  if (execution.errorMessage) {
    return execution.errorMessage;
  }
  if (execution.state === "blocked") {
    return "External writes are disabled locally.";
  }
  if (execution.state === "failed") {
    return "Execution failed.";
  }
  return null;
}

export function formatAttemptSummary(execution: WritebackExecution) {
  if (execution.attemptCount === 0) {
    return "No attempts yet";
  }

  return `${execution.attemptCount} attempt${execution.attemptCount === 1 ? "" : "s"}`;
}

function formatEntity(
  entityType: NonNullable<WritebackExecution["repairShoprEntityType"]>,
) {
  switch (entityType) {
    case "customer":
      return "Customer";
    case "contact":
      return "Contact";
    case "lead":
      return "Lead";
    case "ticket":
      return "Ticket";
    case "appointment":
      return "Appointment";
    case "invoice":
      return "Invoice";
    case "payment":
      return "Payment";
    case "ticket_comment":
      return "Ticket comment";
  }
}
