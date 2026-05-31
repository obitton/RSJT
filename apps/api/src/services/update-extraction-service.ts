import {
  type ExtractedFact,
  ExtractedFactSchema,
  FactConfirmationConfidenceThreshold,
  type MissingField,
  type MissingFieldPrompt,
  type UpdateExtractionResponse,
  UpdateExtractionResponseSchema,
  type UserRole,
} from "@rsjt/shared";

export type CreateJobUpdateMessageInput = {
  jobId: string;
  authorRole: UserRole;
  body: string;
};

export interface JobUpdateMessageStore {
  createJobUpdateMessage(input: CreateJobUpdateMessageInput): Promise<string>;
}

export interface ExtractedFactStore {
  replaceForMessage(
    jobId: string,
    messageId: string,
    facts: ExtractedFact[],
  ): Promise<void>;
}

export type UpdateExtractionAdapterInput = {
  body: string;
  messageId: string;
};

export interface UpdateExtractionAdapter {
  extract(input: UpdateExtractionAdapterInput): Promise<ExtractedFact[]>;
}

export type ExtractJobUpdateInput = {
  jobId: string;
  authorRole: UserRole;
  body: string;
};

export interface UpdateExtractionServiceApi {
  extractJobUpdate(
    input: ExtractJobUpdateInput,
  ): Promise<UpdateExtractionResponse>;
}

const NO_EXPENSE_PATTERN = /\b(no|none)\s+(parts?|materials?|expenses?)\b/i;
const EXPENSE_PATTERN =
  /\b(parts?|materials?|expenses?)\s+\$?(\d+(?:\.\d{1,2})?)\b/i;
const DURATION_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours|min|mins|minute|minutes)\b/i;
const DIRECT_CHARGE_PATTERN = /\bcharged\s+\$?(\d+(?:\.\d{1,2})?)\b/i;
const MONEY_PATTERN = /\$(\d+(?:\.\d{1,2})?)\b/;
const CUSTOMER_HINT_PATTERN = /\b(?:to|at|for)\s+([A-Z][A-Za-z.'-]*)\b/;
const COMPLETED_PATTERN = /\b(done|completed|complete|finished|fixed)\b/i;
const NOT_COMPLETED_PATTERN = /\b(not done|not complete|unfinished)\b/i;
const FOLLOW_UP_PATTERN = /\b(follow up|follow-up|call back|callback)\b/i;
const NO_FOLLOW_UP_PATTERN = /\b(no follow up|no follow-up|no callback)\b/i;
const SCHEDULING_PATTERN =
  /\b(schedule|scheduled|appointment|tomorrow|today|pickup|dropoff)\b/i;

export class UpdateExtractionService implements UpdateExtractionServiceApi {
  constructor(
    private readonly messages: JobUpdateMessageStore,
    private readonly facts: ExtractedFactStore,
    private readonly adapter: UpdateExtractionAdapter,
  ) {}

  async extractJobUpdate(input: ExtractJobUpdateInput) {
    const messageId = await this.messages.createJobUpdateMessage({
      jobId: input.jobId,
      authorRole: input.authorRole,
      body: input.body,
    });
    const facts = (
      await this.adapter.extract({
        body: input.body,
        messageId,
      })
    ).map(normalizeFact);
    const missingFields = findMissingFields(input.body, facts);
    const prompts = buildMissingFieldPrompts(missingFields);

    await this.facts.replaceForMessage(input.jobId, messageId, facts);

    return UpdateExtractionResponseSchema.parse({
      jobId: input.jobId,
      messageId,
      facts,
      missingFields,
      prompts,
    });
  }
}

export class DeterministicUpdateExtractionAdapter
  implements UpdateExtractionAdapter
{
  async extract(input: UpdateExtractionAdapterInput) {
    const facts: ExtractedFact[] = [];
    const body = input.body.trim();

    addCustomerHintFact(facts, body, input.messageId);
    addDurationFact(facts, body, input.messageId);
    addGrossChargeFact(facts, body, input.messageId);
    addExpenseFact(facts, body, input.messageId);
    addCompletionFact(facts, body, input.messageId);
    addSchedulingFact(facts, body, input.messageId);
    addFollowUpFact(facts, body, input.messageId);
    addWorkPerformedFact(facts, body, input.messageId);

    return facts;
  }
}

function addCustomerHintFact(
  facts: ExtractedFact[],
  body: string,
  messageId: string,
) {
  const match = CUSTOMER_HINT_PATTERN.exec(body);
  if (!match?.[1]) {
    return;
  }

  facts.push(
    extractedFact({
      type: "customer_hint",
      value: { text: match[1] },
      confidence: 0.7,
      messageId,
      quote: match[1],
    }),
  );
}

function addDurationFact(
  facts: ExtractedFact[],
  body: string,
  messageId: string,
) {
  const match = DURATION_PATTERN.exec(body);
  if (!match?.[1] || !match[2]) {
    return;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const minutes = unit.startsWith("h")
    ? Math.round(amount * 60)
    : Math.round(amount);

  facts.push(
    extractedFact({
      type: "duration_minutes",
      value: { minutes },
      confidence: 0.95,
      messageId,
      quote: match[0],
    }),
  );
}

function addGrossChargeFact(
  facts: ExtractedFact[],
  body: string,
  messageId: string,
) {
  const match = findGrossChargeMatch(body);
  if (!match) {
    return;
  }

  facts.push(
    extractedFact({
      type: "gross_charge_cents",
      value: { amountCents: amountToCents(match.amount) },
      confidence: match.confidence,
      messageId,
      quote: match.quote,
    }),
  );
}

function addExpenseFact(
  facts: ExtractedFact[],
  body: string,
  messageId: string,
) {
  const match = EXPENSE_PATTERN.exec(body);
  if (!match?.[1] || !match[2]) {
    return;
  }

  facts.push(
    extractedFact({
      type: "expense_cents",
      value: {
        amountCents: amountToCents(match[2]),
        description: match[1].toLowerCase(),
      },
      confidence: 0.9,
      messageId,
      quote: match[0],
    }),
  );
}

function addCompletionFact(
  facts: ExtractedFact[],
  body: string,
  messageId: string,
) {
  const notCompletedMatch = NOT_COMPLETED_PATTERN.exec(body);
  if (notCompletedMatch) {
    facts.push(
      extractedFact({
        type: "completion_state",
        value: { state: "not_completed" },
        confidence: 0.9,
        messageId,
        quote: notCompletedMatch[0],
      }),
    );
    return;
  }

  const completedMatch = COMPLETED_PATTERN.exec(body);
  if (completedMatch) {
    facts.push(
      extractedFact({
        type: "completion_state",
        value: { state: "completed" },
        confidence: 0.9,
        messageId,
        quote: completedMatch[0],
      }),
    );
    return;
  }

  if (DURATION_PATTERN.test(body) && findGrossChargeMatch(body)) {
    facts.push(
      extractedFact({
        type: "completion_state",
        value: { state: "likely_completed" },
        confidence: 0.65,
        messageId,
        quote: body,
      }),
    );
  }
}

function addSchedulingFact(
  facts: ExtractedFact[],
  body: string,
  messageId: string,
) {
  const match = SCHEDULING_PATTERN.exec(body);
  if (!match) {
    return;
  }

  facts.push(
    extractedFact({
      type: "scheduling_note",
      value: { text: body },
      confidence: 0.6,
      messageId,
      quote: match[0],
    }),
  );
}

function addFollowUpFact(
  facts: ExtractedFact[],
  body: string,
  messageId: string,
) {
  const noFollowUpMatch = NO_FOLLOW_UP_PATTERN.exec(body);
  if (noFollowUpMatch) {
    facts.push(
      extractedFact({
        type: "follow_up_needed",
        value: { needed: false },
        confidence: 0.85,
        messageId,
        quote: noFollowUpMatch[0],
      }),
    );
    return;
  }

  const followUpMatch = FOLLOW_UP_PATTERN.exec(body);
  if (!followUpMatch) {
    return;
  }

  facts.push(
    extractedFact({
      type: "follow_up_needed",
      value: { needed: true, note: body },
      confidence: 0.85,
      messageId,
      quote: followUpMatch[0],
    }),
  );
}

function addWorkPerformedFact(
  facts: ExtractedFact[],
  body: string,
  messageId: string,
) {
  if (!/\b(went|fixed|diagnosed|installed|replaced|cleaned)\b/i.test(body)) {
    return;
  }

  facts.push(
    extractedFact({
      type: "work_performed",
      value: { text: body },
      confidence: 0.55,
      messageId,
      quote: body,
    }),
  );
}

function findGrossChargeMatch(body: string) {
  const directMatch = DIRECT_CHARGE_PATTERN.exec(body);
  if (directMatch?.[1]) {
    return {
      amount: directMatch[1],
      quote: directMatch[0],
      confidence: 0.9,
    };
  }

  const moneyMatch = MONEY_PATTERN.exec(body);
  if (moneyMatch?.[1] && !isExpenseQuote(body, moneyMatch.index)) {
    return {
      amount: moneyMatch[1],
      quote: moneyMatch[0],
      confidence: 0.85,
    };
  }

  const durationMatch = DURATION_PATTERN.exec(body);
  if (durationMatch?.index === undefined) {
    return null;
  }

  const trailingText = body.slice(
    durationMatch.index + durationMatch[0].length,
  );
  const trailingAmountMatch = /(?:^|[\s,])(\d+(?:\.\d{1,2})?)\s*$/.exec(
    trailingText,
  );
  if (!trailingAmountMatch?.[1]) {
    return null;
  }

  return {
    amount: trailingAmountMatch[1],
    quote: trailingAmountMatch[1],
    confidence: 0.75,
  };
}

function findMissingFields(body: string, facts: ExtractedFact[]) {
  const factTypes = new Set(facts.map((fact) => fact.type));
  const missingFields: MissingField[] = [];

  if (!factTypes.has("customer_hint")) {
    missingFields.push("customer_hint");
  }

  if (!factTypes.has("expense_cents") && !NO_EXPENSE_PATTERN.test(body)) {
    missingFields.push("expense_cents");
  }

  if (!factTypes.has("completion_state")) {
    missingFields.push("completion_state");
  }

  if (!factTypes.has("follow_up_needed")) {
    missingFields.push("follow_up_needed");
  }

  return missingFields;
}

function buildMissingFieldPrompts(
  missingFields: MissingField[],
): MissingFieldPrompt[] {
  return missingFields.map((field) => ({
    field,
    message: missingPromptText(field),
  }));
}

function missingPromptText(field: MissingField) {
  switch (field) {
    case "customer_hint":
      return "Which customer or RepairShopr record is this update for?";
    case "expense_cents":
      return "Any parts, materials, or subcontractor costs for this job?";
    case "completion_state":
      return "Is the job completed, or is more work still needed?";
    case "follow_up_needed":
      return "Any follow-up needed with the customer?";
  }
}

function normalizeFact(fact: ExtractedFact) {
  const parsedFact = ExtractedFactSchema.parse(fact);

  return ExtractedFactSchema.parse({
    ...parsedFact,
    requiresConfirmation:
      parsedFact.confidence < FactConfirmationConfidenceThreshold,
  });
}

function extractedFact(input: {
  type: ExtractedFact["type"];
  value: unknown;
  confidence: number;
  messageId: string;
  quote: string;
}): ExtractedFact {
  return ExtractedFactSchema.parse({
    type: input.type,
    value: input.value,
    confidence: input.confidence,
    evidence: {
      messageId: input.messageId,
      quote: input.quote,
    },
    requiresConfirmation:
      input.confidence < FactConfirmationConfidenceThreshold,
  });
}

function amountToCents(amount: string) {
  return Math.round(Number(amount) * 100);
}

function isExpenseQuote(body: string, index: number) {
  const prefix = body.slice(Math.max(0, index - 16), index);
  return /\b(parts?|materials?|expenses?)\s*$/i.test(prefix);
}
