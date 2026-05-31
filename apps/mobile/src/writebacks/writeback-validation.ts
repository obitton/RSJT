import { isRecord } from "@/auth/session-validation";
import type {
  RepairShoprEntityType,
  WritebackAction,
  WritebackExecution,
  WritebackExecutionListResponse,
  WritebackExecutionResponse,
  WritebackExecutionState,
  WritebackTargetKind,
} from "@rsjt/shared";
import { WritebackApprovalPayloadSchema } from "@rsjt/shared";

const STATES = [
  "ready",
  "succeeded",
  "failed",
  "blocked",
] as const satisfies readonly WritebackExecutionState[];

const TARGET_KINDS = [
  "repairshopr",
  "customer_message",
] as const satisfies readonly WritebackTargetKind[];

const KINDS = [
  "repairshopr_writeback",
  "customer_message",
  "appointment_creation",
] as const;

type ExecutableWritebackKind = (typeof KINDS)[number];

const ACTIONS = [
  "customer_update",
  "contact_update",
  "lead_create",
  "ticket_create",
  "ticket_comment_create",
  "appointment_create",
  "customer_message_send",
] as const satisfies readonly WritebackAction[];

const REPAIRSHOPR_ENTITY_TYPES = [
  "customer",
  "contact",
  "lead",
  "ticket",
  "appointment",
  "invoice",
  "payment",
  "ticket_comment",
] as const satisfies readonly RepairShoprEntityType[];

export function toWritebackExecutionListResponse(
  value: unknown,
): WritebackExecutionListResponse | null {
  if (!isRecord(value) || !Array.isArray(value.executions)) {
    return null;
  }
  const executions = value.executions.map(toWritebackExecution);
  return executions.every((execution) => execution !== null)
    ? { executions }
    : null;
}

export function toWritebackExecutionResponse(
  value: unknown,
): WritebackExecutionResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const execution = toWritebackExecution(value.execution);
  return execution ? { execution } : null;
}

function toWritebackExecution(value: unknown): WritebackExecution | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.approvalId !== "string" ||
    !KINDS.includes(value.kind as ExecutableWritebackKind) ||
    !STATES.includes(value.state as WritebackExecutionState) ||
    !TARGET_KINDS.includes(value.targetKind as WritebackTargetKind) ||
    !ACTIONS.includes(value.action as WritebackAction) ||
    typeof value.attemptCount !== "number"
  ) {
    return null;
  }

  const jobId = toNullableString(value.jobId);
  const errorMessage = toNullableString(value.errorMessage);
  const repairShoprId = toNullableString(value.repairShoprId);
  const executedByUserId = toNullableString(value.executedByUserId);
  if (
    jobId === undefined ||
    errorMessage === undefined ||
    repairShoprId === undefined ||
    executedByUserId === undefined
  ) {
    return null;
  }

  const repairShoprEntityType = toNullableRepairShoprEntityType(
    value.repairShoprEntityType,
  );
  if (repairShoprEntityType === undefined) {
    return null;
  }

  const createdAt = toDate(value.createdAt);
  const updatedAt = toDate(value.updatedAt);
  const lastAttemptedAt = toNullableDate(value.lastAttemptedAt);
  const succeededAt = toNullableDate(value.succeededAt);
  if (
    !createdAt ||
    !updatedAt ||
    lastAttemptedAt === undefined ||
    succeededAt === undefined
  ) {
    return null;
  }

  const requestPayload = WritebackApprovalPayloadSchema.safeParse(
    value.requestPayload,
  );
  const responsePayload =
    value.responsePayload === null || isRecord(value.responsePayload)
      ? value.responsePayload
      : undefined;
  if (!requestPayload.success || responsePayload === undefined) {
    return null;
  }

  return {
    id: value.id,
    approvalId: value.approvalId,
    jobId,
    kind: value.kind as WritebackExecution["kind"],
    state: value.state as WritebackExecutionState,
    targetKind: value.targetKind as WritebackTargetKind,
    action: value.action as WritebackAction,
    requestPayload: requestPayload.data,
    responsePayload,
    errorMessage,
    repairShoprEntityType,
    repairShoprId,
    attemptCount: value.attemptCount,
    lastAttemptedAt,
    executedByUserId,
    succeededAt,
    createdAt,
    updatedAt,
  };
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

function toNullableRepairShoprEntityType(
  value: unknown,
): RepairShoprEntityType | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    typeof value === "string" &&
    REPAIRSHOPR_ENTITY_TYPES.includes(value as RepairShoprEntityType)
  ) {
    return value as RepairShoprEntityType;
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
