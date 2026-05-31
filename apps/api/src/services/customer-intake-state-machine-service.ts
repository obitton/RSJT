import type {
  ApprovalRecord,
  CreateApprovalRequest,
  CustomerIntakeEvaluation,
  CustomerIntakeField,
  CustomerIntakePrompt,
  CustomerIntakeSnapshot,
  CustomerIntakeState,
  MatchConfidenceBand,
  RepairShoprReference,
  SessionUser,
  UserRole,
} from "@rsjt/shared";
import {
  CustomerIntakeEvaluationSchema,
  NEW_LEAD_REQUIRED_FIELDS,
} from "@rsjt/shared";
import type {
  ConversationFieldsPatch,
  InboundMessageSummary,
} from "../repositories/intake-repository.js";
import type { IntakeSpamGate, SpamCheckMessage } from "./intake-spam-gate.js";

export interface CustomerIntakeStore {
  getConversationSnapshot(
    conversationId: string,
  ): Promise<CustomerIntakeSnapshot | null>;
  getRecentInboundMessages(
    conversationId: string,
    limit: number,
  ): Promise<InboundMessageSummary[]>;
  updateConversationIntake(input: {
    conversationId: string;
    state: CustomerIntakeState;
    spamScore: number;
    blockedReason: string | null;
    fields: ConversationFieldsPatch;
    lastInboundMessageId: string;
    lastInboundAt: Date;
  }): Promise<void>;
  linkMatchedRepairShoprReference(input: {
    conversationId: string;
    reference: RepairShoprReference | null;
    confidenceBand: string | null;
  }): Promise<void>;
  listPendingIntakeApprovalIds(conversationId: string): Promise<string[]>;
}

export interface CustomerIntakeApprovalStore {
  createApproval(
    user: SessionUser,
    input: CreateApprovalRequest,
  ): Promise<ApprovalRecord>;
}

export interface CustomerIntakeMatcher {
  search(input: {
    phone?: string;
    email?: string;
    name?: string;
    address?: string;
  }): Promise<{
    reference: RepairShoprReference;
    confidenceBand: MatchConfidenceBand;
  } | null>;
}

export type EvaluateInboundMessageInput = {
  conversationId: string;
  messageId: string;
  body: string;
  hasMedia: boolean;
  intakeBotUserId: string;
};

export interface CustomerIntakeStateMachineServiceApi {
  evaluateInboundMessage(
    input: EvaluateInboundMessageInput,
  ): Promise<CustomerIntakeEvaluation>;
  getConversationSnapshot(
    conversationId: string,
  ): Promise<CustomerIntakeSnapshot | null>;
}

const INTAKE_BOT_ROLE: UserRole = "manager";

const FIELD_PROMPTS: Record<CustomerIntakeField, string> = {
  customerName: "Could you share your name so we know who we're helping?",
  phone: "What is the best phone number to reach you?",
  email: "What is the best email for written updates?",
  serviceAddress:
    "What is the service address or location for the repair visit?",
  problemDescription: "Could you briefly describe the device and the problem?",
  preferredTiming: "When is a good window for the tech to come by?",
};

export class CustomerIntakeStateMachineService
  implements CustomerIntakeStateMachineServiceApi
{
  constructor(
    private readonly store: CustomerIntakeStore,
    private readonly approvalStore: CustomerIntakeApprovalStore,
    private readonly spamGate: IntakeSpamGate,
    private readonly matcher: CustomerIntakeMatcher | null,
  ) {}

  async getConversationSnapshot(conversationId: string) {
    return this.store.getConversationSnapshot(conversationId);
  }

  async evaluateInboundMessage(
    input: EvaluateInboundMessageInput,
  ): Promise<CustomerIntakeEvaluation> {
    const snapshot = await this.store.getConversationSnapshot(
      input.conversationId,
    );

    if (!snapshot) {
      throw new Error("Conversation not found for intake evaluation");
    }

    const recent = await this.store.getRecentInboundMessages(
      input.conversationId,
      5,
    );

    const lastInboundAt = recent[0]?.createdAt ?? new Date();

    const spamResult = this.spamGate.evaluate({
      current: { body: input.body, hasMedia: input.hasMedia },
      recentMessages: recent
        .filter((message) => message.id !== input.messageId)
        .map<SpamCheckMessage>((message) => ({
          body: message.body,
          hasMedia: false,
        })),
    });

    if (spamResult.isBlocked) {
      await this.store.updateConversationIntake({
        conversationId: input.conversationId,
        state: "blocked",
        spamScore: snapshot.spamScore + spamResult.score,
        blockedReason: spamResult.reason,
        fields: {},
        lastInboundMessageId: input.messageId,
        lastInboundAt,
      });

      return buildEvaluation({
        conversationId: input.conversationId,
        state: "blocked",
        spamScore: snapshot.spamScore + spamResult.score,
        blockedReason: spamResult.reason,
        missingFields: [],
        nextPrompt: null,
        matchedReference: snapshot.matchedReference,
        matchedConfidenceBand: snapshot.matchedConfidenceBand,
        stagedApprovalIds: await this.store.listPendingIntakeApprovalIds(
          input.conversationId,
        ),
      });
    }

    const fields = extractFields(input.body);
    const merged: CustomerIntakeSnapshot = {
      ...snapshot,
      customerName: fields.customerName ?? snapshot.customerName,
      email: fields.email ?? snapshot.email,
      serviceAddress: fields.serviceAddress ?? snapshot.serviceAddress,
      problemDescription:
        fields.problemDescription ?? snapshot.problemDescription,
      preferredTiming: fields.preferredTiming ?? snapshot.preferredTiming,
    };

    let matchedReference = snapshot.matchedReference;
    let matchedConfidenceBand = snapshot.matchedConfidenceBand;

    if (this.matcher && !matchedReference && shouldAttemptMatch(merged)) {
      const matched = await this.matcher.search({
        ...(merged.phone ? { phone: merged.phone } : {}),
        ...(merged.email ? { email: merged.email } : {}),
        ...(merged.customerName ? { name: merged.customerName } : {}),
        ...(merged.serviceAddress ? { address: merged.serviceAddress } : {}),
      });
      if (matched) {
        matchedReference = matched.reference;
        matchedConfidenceBand = matched.confidenceBand;
        await this.store.linkMatchedRepairShoprReference({
          conversationId: input.conversationId,
          reference: matched.reference,
          confidenceBand: matched.confidenceBand,
        });
      }
    }

    const missingFields = computeMissingFields(merged);
    const state = decideState({
      hasName: Boolean(merged.customerName),
      hasContactContext: Boolean(merged.phone || merged.email),
      hasServiceContext: Boolean(
        merged.problemDescription || merged.serviceAddress,
      ),
      matchedConfidenceBand,
      missingFields,
    });

    await this.store.updateConversationIntake({
      conversationId: input.conversationId,
      state,
      spamScore: snapshot.spamScore + spamResult.score,
      blockedReason: null,
      fields: {
        ...(fields.customerName !== null
          ? { customerName: fields.customerName }
          : {}),
        ...(fields.email !== null ? { email: fields.email } : {}),
        ...(fields.serviceAddress !== null
          ? { serviceAddress: fields.serviceAddress }
          : {}),
        ...(fields.problemDescription !== null
          ? { problemDescription: fields.problemDescription }
          : {}),
        ...(fields.preferredTiming !== null
          ? { preferredTiming: fields.preferredTiming }
          : {}),
      },
      lastInboundMessageId: input.messageId,
      lastInboundAt,
    });

    let stagedApprovalIds = await this.store.listPendingIntakeApprovalIds(
      input.conversationId,
    );
    let nextPrompt: CustomerIntakePrompt | null = null;

    if (state === "review_ready") {
      const intakeUser: SessionUser = {
        id: input.intakeBotUserId,
        role: INTAKE_BOT_ROLE,
        displayName: "Intake",
      };
      const approval = await this.approvalStore.createApproval(intakeUser, {
        kind: "repairshopr_writeback",
        risk: "customer_identity",
        requiredRole: "manager",
        payload: {
          conversationId: input.conversationId,
          customerName: merged.customerName,
          phone: merged.phone,
          email: merged.email,
          serviceAddress: merged.serviceAddress,
          problemDescription: merged.problemDescription,
          preferredTiming: merged.preferredTiming,
        },
        evidence: [
          {
            messageId: input.messageId,
            quote: truncateForEvidence(input.body),
          },
        ],
      });
      stagedApprovalIds = [...stagedApprovalIds, approval.id];
    } else if (
      state !== "matched" &&
      missingFields.length > 0 &&
      !snapshot.takeoverActive
    ) {
      const field = missingFields[0];
      if (field) {
        nextPrompt = {
          field,
          message: FIELD_PROMPTS[field],
        };
        const intakeUser: SessionUser = {
          id: input.intakeBotUserId,
          role: INTAKE_BOT_ROLE,
          displayName: "Intake",
        };
        const approval = await this.approvalStore.createApproval(intakeUser, {
          kind: "customer_message",
          risk: "customer_identity",
          requiredRole: "manager",
          payload: {
            conversationId: input.conversationId,
            field,
            body: nextPrompt.message,
          },
          evidence: [
            {
              messageId: input.messageId,
              quote: truncateForEvidence(input.body),
            },
          ],
        });
        stagedApprovalIds = [...stagedApprovalIds, approval.id];
      }
    }

    return buildEvaluation({
      conversationId: input.conversationId,
      state,
      spamScore: snapshot.spamScore + spamResult.score,
      blockedReason: null,
      missingFields,
      nextPrompt,
      matchedReference,
      matchedConfidenceBand,
      stagedApprovalIds,
    });
  }
}

type ExtractedFields = {
  customerName: string | null;
  email: string | null;
  serviceAddress: string | null;
  problemDescription: string | null;
  preferredTiming: string | null;
};

const NAME_PATTERN =
  /(?:my name is|i am|i'm)\s+([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)?)/i;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const ADDRESS_PATTERN = /\b\d{1,6}\s+[A-Za-z][\w\s.'-]{3,}\b/;
const TIMING_PATTERN =
  /\b(today|tomorrow|tonight|this (?:morning|afternoon|evening)|next (?:week|monday|tuesday|wednesday|thursday|friday)|at \d{1,2}(?::\d{2})?(?:\s?(?:am|pm))?)\b/i;
const PROBLEM_KEYWORDS =
  /\b(broken|won't|wont|will not|doesn't work|does not work|issue|problem|crashed|stuck|frozen|battery|screen|laptop|computer|phone|tablet|monitor|wifi|charge|charging|boot|booting|crash|fix|repair|not working|need help|help)\b/i;

function extractFields(body: string): ExtractedFields {
  const trimmed = body.trim();

  const nameMatch = NAME_PATTERN.exec(trimmed);
  const emailMatch = EMAIL_PATTERN.exec(trimmed);
  const addressMatch = ADDRESS_PATTERN.exec(trimmed);
  const timingMatch = TIMING_PATTERN.exec(trimmed);
  const hasProblemContext =
    trimmed.length > 0 &&
    (PROBLEM_KEYWORDS.test(trimmed) || addressMatch !== null);

  return {
    customerName: nameMatch?.[1]?.trim() ?? null,
    email: emailMatch?.[0]?.trim() ?? null,
    serviceAddress: addressMatch?.[0]?.trim() ?? null,
    problemDescription: hasProblemContext ? trimmed : null,
    preferredTiming: timingMatch?.[0]?.trim() ?? null,
  };
}

function computeMissingFields(snapshot: CustomerIntakeSnapshot) {
  const missing: CustomerIntakeField[] = [];

  for (const field of NEW_LEAD_REQUIRED_FIELDS) {
    if (!snapshot[field]) {
      missing.push(field);
    }
  }

  return missing;
}

function shouldAttemptMatch(snapshot: CustomerIntakeSnapshot) {
  return Boolean(
    snapshot.phone ||
      snapshot.email ||
      snapshot.customerName ||
      snapshot.serviceAddress,
  );
}

function decideState(input: {
  hasName: boolean;
  hasContactContext: boolean;
  hasServiceContext: boolean;
  matchedConfidenceBand: string | null;
  missingFields: CustomerIntakeField[];
}): CustomerIntakeState {
  if (input.matchedConfidenceBand === "high") {
    if (input.hasServiceContext) {
      return "review_ready";
    }
    return "matched";
  }

  if (input.missingFields.length === 0) {
    return "review_ready";
  }

  if (input.hasName && input.hasServiceContext) {
    return "collecting";
  }

  if (input.hasName || input.hasContactContext) {
    return "identifying";
  }

  return "unknown";
}

function buildEvaluation(input: {
  conversationId: string;
  state: CustomerIntakeState;
  spamScore: number;
  blockedReason: string | null;
  missingFields: CustomerIntakeField[];
  nextPrompt: CustomerIntakePrompt | null;
  matchedReference: RepairShoprReference | null;
  matchedConfidenceBand: string | null;
  stagedApprovalIds: string[];
}): CustomerIntakeEvaluation {
  return CustomerIntakeEvaluationSchema.parse({
    conversationId: input.conversationId,
    state: input.state,
    blocked: input.state === "blocked",
    blockedReason: input.blockedReason,
    spamScore: input.spamScore,
    missingFields: input.missingFields,
    nextPrompt: input.nextPrompt,
    matchedReference: input.matchedReference,
    matchedConfidenceBand: input.matchedConfidenceBand,
    stagedApprovalIds: input.stagedApprovalIds,
  });
}

function truncateForEvidence(body: string) {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return "(empty inbound message)";
  }
  if (trimmed.length <= 200) {
    return trimmed;
  }
  return `${trimmed.slice(0, 200)}…`.replace("…", "...");
}
