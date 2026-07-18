import { isRecord } from "@/auth/session-validation";
import type {
  CancelJobResponse,
  ExtractedFact,
  JobState,
  JobSummary,
  JobUpdateFeedResponse,
  MissingField,
  MissingFieldPrompt,
  ProfitBasis,
  RepairShoprEntityType,
  RepairShoprReference,
  SourceEvidence,
  SplitCategory,
  UpdateExtractionResponse,
} from "@rsjt/shared";

const JOB_STATES = [
  "unmatched",
  "intake",
  "accepted",
  "scheduled",
  "completed",
  "payout_ready",
  "closed",
  "canceled",
] as const satisfies readonly JobState[];

const SPLIT_CATEGORIES = [
  "returning_repairshopr_customer",
  "new_lead",
  "customer_service_heavy",
] as const satisfies readonly SplitCategory[];

const PROFIT_BASES = [
  "reported_profit",
  "charge_minus_reported_expenses",
] as const satisfies readonly ProfitBasis[];

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

const EXTRACTED_FACT_TYPES = [
  "customer_hint",
  "work_performed",
  "duration_minutes",
  "gross_charge_cents",
  "expense_cents",
  "reported_profit_cents",
  "completion_state",
  "scheduling_note",
  "follow_up_needed",
] as const satisfies readonly ExtractedFact["type"][];

const MISSING_FIELDS = [
  "customer_hint",
  "expense_cents",
  "completion_state",
  "follow_up_needed",
] as const satisfies readonly MissingField[];

const COMPLETION_STATES = [
  "completed",
  "not_completed",
  "likely_completed",
  "unknown",
] as const satisfies readonly Extract<
  ExtractedFact,
  { type: "completion_state" }
>["value"]["state"][];

type BaseFact = Pick<
  ExtractedFact,
  "confidence" | "evidence" | "requiresConfirmation"
>;

export function toJobUpdateFeedResponse(
  value: unknown,
): JobUpdateFeedResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const activeJobs = toJobSummaryArray(value.activeJobs);
  const unresolvedJobs = toJobSummaryArray(value.unresolvedJobs);

  if (!activeJobs || !unresolvedJobs) {
    return null;
  }

  return { activeJobs, unresolvedJobs };
}

export function toUpdateExtractionResponse(
  value: unknown,
): UpdateExtractionResponse | null {
  if (
    !isRecord(value) ||
    typeof value.jobId !== "string" ||
    typeof value.messageId !== "string"
  ) {
    return null;
  }

  const facts = toExtractedFactArray(value.facts);
  const missingFields = toMissingFieldArray(value.missingFields);
  const prompts = toMissingFieldPromptArray(value.prompts);

  if (!facts || !missingFields || !prompts) {
    return null;
  }

  return {
    jobId: value.jobId,
    messageId: value.messageId,
    facts,
    missingFields,
    prompts,
  };
}

function toJobSummaryArray(value: unknown): JobSummary[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const jobs = value.map(toJobSummary);
  return jobs.every((job) => job !== null) ? jobs : null;
}

export function toCancelJobResponse(value: unknown): CancelJobResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const job = toJobSummary(value.job);
  if (!job) {
    return null;
  }

  return { job };
}

export function toJobSummary(value: unknown): JobSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isJobState(value.state)
  ) {
    return null;
  }

  const splitCategory = toOptionalSplitCategory(value.splitCategory);
  const grossChargeCents = toOptionalCents(value.grossChargeCents);
  const reportedProfitCents = toOptionalCents(value.reportedProfitCents);
  const profitBasis = toOptionalProfitBasis(value.profitBasis);
  const repairShoprReference =
    value.repairShoprReference === undefined
      ? undefined
      : toRepairShoprReference(value.repairShoprReference);
  const canceledAt = toOptionalDate(value.canceledAt);

  if (
    splitCategory === null ||
    grossChargeCents === null ||
    reportedProfitCents === null ||
    profitBasis === null ||
    repairShoprReference === null ||
    canceledAt === null
  ) {
    return null;
  }

  return {
    id: value.id,
    state: value.state,
    ...(typeof value.customerLabel === "string"
      ? { customerLabel: value.customerLabel }
      : {}),
    ...(splitCategory ? { splitCategory } : {}),
    ...(grossChargeCents !== undefined ? { grossChargeCents } : {}),
    ...(reportedProfitCents !== undefined ? { reportedProfitCents } : {}),
    ...(profitBasis ? { profitBasis } : {}),
    ...(repairShoprReference ? { repairShoprReference } : {}),
    ...(typeof value.cancelReason === "string" && value.cancelReason.length > 0
      ? { cancelReason: value.cancelReason }
      : {}),
    ...(canceledAt !== undefined ? { canceledAt } : {}),
  };
}

function toRepairShoprReference(value: unknown): RepairShoprReference | null {
  if (
    !isRecord(value) ||
    !isRepairShoprEntityType(value.entityType) ||
    typeof value.repairShoprId !== "string" ||
    typeof value.displayLabel !== "string"
  ) {
    return null;
  }

  if (value.url !== undefined && typeof value.url !== "string") {
    return null;
  }

  return {
    entityType: value.entityType,
    repairShoprId: value.repairShoprId,
    displayLabel: value.displayLabel,
    ...(value.url ? { url: value.url } : {}),
  };
}

function toExtractedFactArray(value: unknown): ExtractedFact[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const facts = value.map(toExtractedFact);
  return facts.every((fact) => fact !== null) ? facts : null;
}

function toExtractedFact(value: unknown): ExtractedFact | null {
  if (!isRecord(value) || !isExtractedFactType(value.type)) {
    return null;
  }

  const base = toBaseFact(value);
  if (!base) {
    return null;
  }

  switch (value.type) {
    case "customer_hint": {
      const factValue = toTextFactValue(value.value);
      return factValue ? { type: value.type, value: factValue, ...base } : null;
    }
    case "work_performed": {
      const factValue = toTextFactValue(value.value);
      return factValue ? { type: value.type, value: factValue, ...base } : null;
    }
    case "duration_minutes": {
      const factValue = toDurationFactValue(value.value);
      return factValue ? { type: value.type, value: factValue, ...base } : null;
    }
    case "gross_charge_cents": {
      const factValue = toMoneyFactValue(value.value);
      return factValue ? { type: value.type, value: factValue, ...base } : null;
    }
    case "expense_cents": {
      const factValue = toExpenseFactValue(value.value);
      return factValue ? { type: value.type, value: factValue, ...base } : null;
    }
    case "reported_profit_cents": {
      const factValue = toMoneyFactValue(value.value);
      return factValue ? { type: value.type, value: factValue, ...base } : null;
    }
    case "completion_state": {
      const factValue = toCompletionFactValue(value.value);
      return factValue ? { type: value.type, value: factValue, ...base } : null;
    }
    case "scheduling_note": {
      const factValue = toTextFactValue(value.value);
      return factValue ? { type: value.type, value: factValue, ...base } : null;
    }
    case "follow_up_needed": {
      const factValue = toFollowUpFactValue(value.value);
      return factValue ? { type: value.type, value: factValue, ...base } : null;
    }
  }
}

function toBaseFact(value: Record<string, unknown>): BaseFact | null {
  const evidence = toSourceEvidence(value.evidence);

  if (
    typeof value.confidence !== "number" ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    typeof value.requiresConfirmation !== "boolean" ||
    !evidence
  ) {
    return null;
  }

  return {
    confidence: value.confidence,
    evidence,
    requiresConfirmation: value.requiresConfirmation,
  };
}

function toSourceEvidence(value: unknown): SourceEvidence | null {
  if (
    !isRecord(value) ||
    typeof value.messageId !== "string" ||
    typeof value.quote !== "string"
  ) {
    return null;
  }

  if (
    value.startOffset !== undefined &&
    (typeof value.startOffset !== "number" || value.startOffset < 0)
  ) {
    return null;
  }

  if (
    value.endOffset !== undefined &&
    (typeof value.endOffset !== "number" || value.endOffset < 0)
  ) {
    return null;
  }

  return {
    messageId: value.messageId,
    quote: value.quote,
    ...(typeof value.startOffset === "number"
      ? { startOffset: value.startOffset }
      : {}),
    ...(typeof value.endOffset === "number"
      ? { endOffset: value.endOffset }
      : {}),
  };
}

function toTextFactValue(value: unknown): { text: string } | null {
  if (!isRecord(value) || typeof value.text !== "string") {
    return null;
  }

  return { text: value.text };
}

function toDurationFactValue(
  value: unknown,
): Extract<ExtractedFact, { type: "duration_minutes" }>["value"] | null {
  if (
    !isRecord(value) ||
    typeof value.minutes !== "number" ||
    !Number.isInteger(value.minutes) ||
    value.minutes <= 0
  ) {
    return null;
  }

  return { minutes: value.minutes };
}

function toMoneyFactValue(value: unknown): { amountCents: number } | null {
  if (!isRecord(value)) {
    return null;
  }

  const amountCents = toRequiredCents(value.amountCents);
  return amountCents === null ? null : { amountCents };
}

function toExpenseFactValue(
  value: unknown,
): Extract<ExtractedFact, { type: "expense_cents" }>["value"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const amountCents = toRequiredCents(value.amountCents);
  if (amountCents === null) {
    return null;
  }

  if (
    value.description !== undefined &&
    typeof value.description !== "string"
  ) {
    return null;
  }

  return {
    amountCents,
    ...(value.description ? { description: value.description } : {}),
  };
}

function toCompletionFactValue(
  value: unknown,
): Extract<ExtractedFact, { type: "completion_state" }>["value"] | null {
  if (!isRecord(value) || !isCompletionState(value.state)) {
    return null;
  }

  return { state: value.state };
}

function toFollowUpFactValue(
  value: unknown,
): Extract<ExtractedFact, { type: "follow_up_needed" }>["value"] | null {
  if (!isRecord(value) || typeof value.needed !== "boolean") {
    return null;
  }

  if (value.note !== undefined && typeof value.note !== "string") {
    return null;
  }

  return {
    needed: value.needed,
    ...(value.note ? { note: value.note } : {}),
  };
}

function toMissingFieldArray(value: unknown): MissingField[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.every(isMissingField) ? value : null;
}

function toMissingFieldPromptArray(
  value: unknown,
): MissingFieldPrompt[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const prompts = value.map(toMissingFieldPrompt);
  return prompts.every((prompt) => prompt !== null) ? prompts : null;
}

function toMissingFieldPrompt(value: unknown): MissingFieldPrompt | null {
  if (
    !isRecord(value) ||
    !isMissingField(value.field) ||
    typeof value.message !== "string"
  ) {
    return null;
  }

  return {
    field: value.field,
    message: value.message,
  };
}

function toOptionalCents(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return toRequiredCents(value);
}

function toRequiredCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}

function toOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toOptionalSplitCategory(
  value: unknown,
): SplitCategory | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return isSplitCategory(value) ? value : null;
}

function toOptionalProfitBasis(value: unknown): ProfitBasis | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return isProfitBasis(value) ? value : null;
}

function isJobState(value: unknown): value is JobState {
  return JOB_STATES.some((state) => state === value);
}

function isSplitCategory(value: unknown): value is SplitCategory {
  return SPLIT_CATEGORIES.some((category) => category === value);
}

function isProfitBasis(value: unknown): value is ProfitBasis {
  return PROFIT_BASES.some((basis) => basis === value);
}

function isRepairShoprEntityType(
  value: unknown,
): value is RepairShoprEntityType {
  return REPAIRSHOPR_ENTITY_TYPES.some((entityType) => entityType === value);
}

function isExtractedFactType(value: unknown): value is ExtractedFact["type"] {
  return EXTRACTED_FACT_TYPES.some((type) => type === value);
}

function isMissingField(value: unknown): value is MissingField {
  return MISSING_FIELDS.some((field) => field === value);
}

function isCompletionState(
  value: unknown,
): value is Extract<
  ExtractedFact,
  { type: "completion_state" }
>["value"]["state"] {
  return COMPLETION_STATES.some((state) => state === value);
}
