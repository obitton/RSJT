import { isRecord } from "@/auth/session-validation";
import { toJobSummary } from "@/jobs/job-validation";
import type {
  ConversationDetail,
  ConversationDetailResponse,
  ConversationListResponse,
  ConversationMessage,
  ConversationMessageDirection,
  ConversationSummary,
  ConvertLeadToJobResponse,
  SendConversationMessageResponse,
  UserRole,
} from "@rsjt/shared";

const DIRECTIONS = [
  "inbound",
  "outbound",
  "internal",
] as const satisfies readonly ConversationMessageDirection[];

const USER_ROLES = ["manager", "tech"] as const satisfies readonly UserRole[];

export function toConversationListResponse(
  value: unknown,
): ConversationListResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const active = toSummaryArray(value.active);
  const needsResponse = toSummaryArray(value.needsResponse);
  const recent = toSummaryArray(value.recent);
  if (!active || !needsResponse || !recent) {
    return null;
  }
  return { active, needsResponse, recent };
}

export function toConversationDetailResponse(
  value: unknown,
): ConversationDetailResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const conversation = toConversationDetail(value.conversation);
  if (!conversation) {
    return null;
  }
  return { conversation };
}

export function toSendConversationMessageResponse(
  value: unknown,
): SendConversationMessageResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const message = toConversationMessage(value.message);
  return message ? { message } : null;
}

export function toConvertLeadToJobResponse(
  value: unknown,
): ConvertLeadToJobResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const job = toJobSummary(value.job);
  return job ? { job } : null;
}

function toSummaryArray(value: unknown): ConversationSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const summaries = value.map(toConversationSummary);
  return summaries.every((summary) => summary !== null) ? summaries : null;
}

function toConversationSummary(value: unknown): ConversationSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.takeoverActive !== "boolean" ||
    typeof value.intakeState !== "string"
  ) {
    return null;
  }
  const updatedAt = toDate(value.updatedAt);
  if (!updatedAt) {
    return null;
  }
  const externalPhone = toNullableString(value.externalPhone);
  if (externalPhone === undefined) {
    return null;
  }
  const customerName = toNullableString(value.customerName);
  if (customerName === undefined) {
    return null;
  }
  const lastInboundPreview = toNullableString(value.lastInboundPreview);
  if (lastInboundPreview === undefined) {
    return null;
  }
  const takeoverStartedAt = toNullableDate(value.takeoverStartedAt);
  if (takeoverStartedAt === undefined) {
    return null;
  }
  const lastInboundAt = toNullableDate(value.lastInboundAt);
  if (lastInboundAt === undefined) {
    return null;
  }
  const takeoverStartedByUserId = toNullableUuid(value.takeoverStartedByUserId);
  if (takeoverStartedByUserId === undefined) {
    return null;
  }

  return {
    id: value.id,
    externalPhone,
    takeoverActive: value.takeoverActive,
    takeoverStartedAt,
    takeoverStartedByUserId,
    intakeState: value.intakeState,
    customerName,
    lastInboundAt,
    lastInboundPreview,
    updatedAt,
  };
}

function toConversationDetail(value: unknown): ConversationDetail | null {
  const summary = toConversationSummary(value);
  if (!summary || !isRecord(value)) {
    return null;
  }
  const messagesValue = value.messages;
  if (!Array.isArray(messagesValue)) {
    return null;
  }
  const messages = messagesValue.map(toConversationMessage);
  if (!messages.every((message) => message !== null)) {
    return null;
  }

  const jobId = toNullableUuid(value.jobId);
  if (jobId === undefined) {
    return null;
  }

  return {
    ...summary,
    jobId,
    messages,
  };
}

function toConversationMessage(value: unknown): ConversationMessage | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.body !== "string" ||
    typeof value.direction !== "string" ||
    !DIRECTIONS.includes(value.direction as ConversationMessageDirection)
  ) {
    return null;
  }
  const createdAt = toDate(value.createdAt);
  if (!createdAt) {
    return null;
  }
  const authorRole = toAuthorRole(value.authorRole);
  if (authorRole === undefined) {
    return null;
  }
  const twilioMessageSid = toNullableString(value.twilioMessageSid);
  if (twilioMessageSid === undefined) {
    return null;
  }
  const externalStatus = toNullableString(value.externalStatus);
  if (externalStatus === undefined) {
    return null;
  }
  const sentByUserId = toNullableUuid(value.sentByUserId);
  if (sentByUserId === undefined) {
    return null;
  }

  return {
    id: value.id,
    direction: value.direction as ConversationMessageDirection,
    authorRole,
    body: value.body,
    twilioMessageSid,
    externalStatus,
    sentByUserId,
    createdAt,
  };
}

function toAuthorRole(value: unknown): UserRole | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && USER_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }
  return undefined;
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

function toNullableUuid(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
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
