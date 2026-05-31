import { isRecord } from "@/auth/session-validation";
import type {
  SchedulingDecisionResponse,
  SchedulingProposal,
  SchedulingProposalDetailResponse,
  SchedulingProposalListResponse,
  SchedulingProposalState,
  SourceEvidence,
} from "@rsjt/shared";

const STATES = [
  "pending",
  "approved",
  "rejected",
  "expired",
] as const satisfies readonly SchedulingProposalState[];

export function toSchedulingProposalListResponse(
  value: unknown,
): SchedulingProposalListResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const pending = toProposalArray(value.pending);
  const decided = toProposalArray(value.decided);
  if (!pending || !decided) {
    return null;
  }
  return { pending, decided };
}

export function toSchedulingProposalDetailResponse(
  value: unknown,
): SchedulingProposalDetailResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const proposal = toProposal(value.proposal);
  return proposal ? { proposal } : null;
}

export function toSchedulingDecisionResponse(
  value: unknown,
): SchedulingDecisionResponse | null {
  return toSchedulingProposalDetailResponse(value);
}

function toProposalArray(value: unknown): SchedulingProposal[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const proposals = value.map(toProposal);
  return proposals.every((proposal) => proposal !== null) ? proposals : null;
}

function toProposal(value: unknown): SchedulingProposal | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.conversationId !== "string" ||
    typeof value.preferredWindowText !== "string" ||
    typeof value.customerMessageBody !== "string" ||
    !STATES.includes(value.state as SchedulingProposalState)
  ) {
    return null;
  }
  const createdAt = toDate(value.createdAt);
  const updatedAt = toDate(value.updatedAt);
  if (!createdAt || !updatedAt) {
    return null;
  }
  const startAt = toNullableDate(value.startAt);
  if (startAt === undefined) {
    return null;
  }
  const endAt = toNullableDate(value.endAt);
  if (endAt === undefined) {
    return null;
  }
  const decidedAt = toNullableDate(value.decidedAt);
  if (decidedAt === undefined) {
    return null;
  }
  const jobId = toNullableString(value.jobId);
  if (jobId === undefined) {
    return null;
  }
  const decidedByUserId = toNullableString(value.decidedByUserId);
  if (decidedByUserId === undefined) {
    return null;
  }
  const customerMessageApprovalId = toNullableString(
    value.customerMessageApprovalId,
  );
  if (customerMessageApprovalId === undefined) {
    return null;
  }
  const appointmentApprovalId = toNullableString(value.appointmentApprovalId);
  if (appointmentApprovalId === undefined) {
    return null;
  }
  const evidence = toSourceEvidenceArray(value.sourceEvidence);
  if (!evidence) {
    return null;
  }
  const appointmentPayload = toAppointmentPayload(
    value.repairShoprAppointmentPayload,
  );
  if (!appointmentPayload) {
    return null;
  }

  return {
    id: value.id,
    conversationId: value.conversationId,
    jobId,
    state: value.state as SchedulingProposalState,
    preferredWindowText: value.preferredWindowText,
    startAt,
    endAt,
    customerMessageBody: value.customerMessageBody,
    repairShoprAppointmentPayload: appointmentPayload,
    sourceEvidence: evidence,
    customerMessageApprovalId,
    appointmentApprovalId,
    decidedByUserId,
    decidedAt,
    createdAt,
    updatedAt,
  };
}

function toSourceEvidenceArray(value: unknown): SourceEvidence[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.map(toSourceEvidence);
  return items.every((item) => item !== null) ? items : null;
}

function toSourceEvidence(value: unknown): SourceEvidence | null {
  if (
    !isRecord(value) ||
    typeof value.messageId !== "string" ||
    typeof value.quote !== "string"
  ) {
    return null;
  }
  const result: SourceEvidence = {
    messageId: value.messageId,
    quote: value.quote,
  };
  if (typeof value.startOffset === "number") {
    result.startOffset = value.startOffset;
  }
  if (typeof value.endOffset === "number") {
    result.endOffset = value.endOffset;
  }
  return result;
}

function toAppointmentPayload(
  value: unknown,
): SchedulingProposal["repairShoprAppointmentPayload"] | null {
  if (
    !isRecord(value) ||
    typeof value.status !== "string" ||
    value.status !== "staged"
  ) {
    return null;
  }
  return value as SchedulingProposal["repairShoprAppointmentPayload"];
}

function toNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function toNullableDate(value: unknown): Date | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = toDate(value);
  return parsed ?? undefined;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
