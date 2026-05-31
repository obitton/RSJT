import type { SchedulingProposalState } from "@rsjt/shared";

export function formatProposalState(state: SchedulingProposalState) {
  switch (state) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
  }
}

export function formatProposalApprovalLabel(state: SchedulingProposalState) {
  switch (state) {
    case "pending":
      return "Awaiting tech approval";
    case "approved":
      return "Approved locally · not sent";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
  }
}

export const UNSAFE_WORDING_HINT =
  "This wording confirms availability before approval. Edit the message before approving.";
