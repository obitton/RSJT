import { formatJobStateLabel } from "@/dashboard/dashboard-format";
import type { JobState, ReminderReason } from "@rsjt/shared";

export function formatReminderReason(reason: ReminderReason) {
  switch (reason) {
    case "missing_completion":
      return "Missing completion";
    case "missing_split_category":
      return "Missing split category";
    case "missing_charge_or_profit":
      return "Missing charge or profit";
    case "missing_expense_detail":
      return "Missing expense detail";
    case "missing_follow_up":
      return "Missing follow-up status";
    case "follow_up_needed":
      return "Follow-up needed";
  }
}

export function formatReminderState(state: JobState) {
  return formatJobStateLabel(state);
}

export function formatReminderActionLabel(reason: ReminderReason) {
  return canResolveReminderQuickly(reason) ? "Mark done" : "Open money review";
}

export function canResolveReminderQuickly(reason: ReminderReason) {
  return reason === "follow_up_needed";
}
