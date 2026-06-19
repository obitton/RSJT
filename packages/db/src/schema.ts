import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["manager", "tech"]);

export const jobState = pgEnum("job_state", [
  "unmatched",
  "intake",
  "accepted",
  "scheduled",
  "completed",
  "payout_ready",
  "closed",
  "canceled",
]);

// How a job came to exist: converted from a lead conversation, or created
// directly (walk-in, phone-in, import) with no originating chat.
export const jobOrigin = pgEnum("job_origin", ["lead", "manual"]);

export const approvalState = pgEnum("approval_state", [
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
  "failed",
]);

export const splitCategory = pgEnum("split_category", [
  "returning_repairshopr_customer",
  "new_lead",
  "customer_service_heavy",
]);

export const customerIntakeState = pgEnum("customer_intake_state", [
  "unknown",
  "identifying",
  "collecting",
  "matched",
  "review_ready",
  "blocked",
]);

export const schedulingProposalState = pgEnum("scheduling_proposal_state", [
  "pending",
  "approved",
  "rejected",
  "expired",
]);

export const writebackExecutionState = pgEnum("writeback_execution_state", [
  "ready",
  "succeeded",
  "failed",
  "blocked",
]);

export const profitBasis = pgEnum("profit_basis", [
  "reported_profit",
  "charge_minus_reported_expenses",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    role: userRole("role").notNull(),
    passcodeHash: text("passcode_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_username_unique").on(table.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalPhone: text("external_phone"),
    takeoverActive: boolean("takeover_active").notNull().default(false),
    takeoverStartedAt: timestamp("takeover_started_at", { withTimezone: true }),
    takeoverStartedByUserId: uuid("takeover_started_by_user_id"),
    intakeState: customerIntakeState("intake_state")
      .notNull()
      .default("unknown"),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    serviceAddress: text("service_address"),
    problemDescription: text("problem_description"),
    preferredTiming: text("preferred_timing"),
    blockedReason: text("blocked_reason"),
    spamScore: integer("spam_score").notNull().default(0),
    matchedRepairShoprEntityType: text("matched_repairshopr_entity_type"),
    matchedRepairShoprId: text("matched_repairshopr_id"),
    matchedRepairShoprDisplayLabel: text("matched_repairshopr_display_label"),
    matchedConfidenceBand: text("matched_confidence_band"),
    lastInboundMessageId: uuid("last_inbound_message_id"),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversations_external_phone_idx").on(table.externalPhone),
    index("conversations_intake_state_idx").on(table.intakeState),
    index("conversations_last_inbound_at_idx").on(table.lastInboundAt),
    index("conversations_matched_repairshopr_idx").on(
      table.matchedRepairShoprEntityType,
      table.matchedRepairShoprId,
    ),
    index("conversations_takeover_active_idx").on(table.takeoverActive),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The lead (conversation) this job originated from. Nullable because jobs
    // can predate the lead lifecycle; REV01 slice 7 sets it on conversion.
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    // Provenance of the job. Defaults to "manual" so any job not created by the
    // lead-to-job conversion (which sets "lead") is clearly flagged as direct.
    origin: jobOrigin("origin").notNull().default("manual"),
    originNote: text("origin_note"),
    state: jobState("state").notNull().default("unmatched"),
    customerLabel: text("customer_label"),
    repairShoprEntityType: text("repairshopr_entity_type"),
    repairShoprId: text("repairshopr_id"),
    splitCategory: splitCategory("split_category"),
    grossChargeCents: integer("gross_charge_cents"),
    reportedProfitCents: integer("reported_profit_cents"),
    calculatedProfitCents: integer("calculated_profit_cents"),
    profitBasis: profitBasis("profit_basis"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("jobs_state_idx").on(table.state),
    index("jobs_conversation_id_idx").on(table.conversationId),
    index("jobs_repairshopr_ref_idx").on(
      table.repairShoprEntityType,
      table.repairShoprId,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    direction: text("direction").notNull(),
    authorRole: text("author_role"),
    body: text("body").notNull(),
    twilioMessageSid: text("twilio_message_sid"),
    externalStatus: text("external_status"),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_job_id_idx").on(table.jobId),
    index("messages_twilio_sid_idx").on(table.twilioMessageSid),
    index("messages_external_status_idx").on(table.externalStatus),
    index("messages_conversation_created_at_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const messageMedia = pgTable(
  "message_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    mediaIndex: integer("media_index").notNull(),
    contentType: text("content_type").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("message_media_message_id_idx").on(table.messageId),
    uniqueIndex("message_media_message_index_unique").on(
      table.messageId,
      table.mediaIndex,
    ),
  ],
);

export const messagingWebhookEvents = pgTable(
  "messaging_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(),
    twilioMessageSid: text("twilio_message_sid"),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messaging_webhook_events_sid_idx").on(table.twilioMessageSid),
    index("messaging_webhook_events_type_idx").on(table.eventType),
  ],
);

export const extractedFacts = pgTable(
  "extracted_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    factType: text("fact_type").notNull(),
    value: jsonb("value").notNull(),
    confidence: integer("confidence_basis_points").notNull(),
    evidence: jsonb("evidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("extracted_facts_job_id_idx").on(table.jobId),
    index("extracted_facts_message_id_idx").on(table.messageId),
  ],
);

export const matchCandidates = pgTable(
  "match_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    repairShoprEntityType: text("repairshopr_entity_type").notNull(),
    repairShoprId: text("repairshopr_id").notNull(),
    repairShoprDisplayLabel: text("repairshopr_display_label").notNull(),
    repairShoprUrl: text("repairshopr_url"),
    confidence: integer("confidence_basis_points").notNull(),
    confidenceBand: text("confidence_band").notNull(),
    reasons: jsonb("reasons").notNull(),
    selectedAt: timestamp("selected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("match_candidates_job_id_idx").on(table.jobId),
    uniqueIndex("match_candidates_job_repairshopr_unique").on(
      table.jobId,
      table.repairShoprEntityType,
      table.repairShoprId,
    ),
  ],
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    state: approvalState("state").notNull().default("pending"),
    risk: text("risk").notNull(),
    requiredRole: userRole("required_role").notNull(),
    originalPayload: jsonb("original_payload").notNull(),
    payload: jsonb("payload").notNull(),
    evidence: jsonb("evidence").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("approvals_state_idx").on(table.state),
    index("approvals_job_id_idx").on(table.jobId),
    index("approvals_kind_idx").on(table.kind),
    index("approvals_risk_idx").on(table.risk),
    index("approvals_required_role_idx").on(table.requiredRole),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description"),
    enteredByUserId: uuid("entered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("expenses_job_id_idx").on(table.jobId)],
);

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    splitCategory: splitCategory("split_category").notNull(),
    profitBasis: profitBasis("profit_basis").notNull(),
    grossChargeCents: integer("gross_charge_cents").notNull(),
    reportedExpenseCents: integer("reported_expense_cents")
      .notNull()
      .default(0),
    reportedProfitCents: integer("reported_profit_cents"),
    calculatedProfitCents: integer("calculated_profit_cents"),
    managerShareCents: integer("manager_share_cents").notNull(),
    techShareCents: integer("tech_share_cents").notNull(),
    finalizedByUserId: uuid("finalized_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payouts_job_id_idx").on(table.jobId),
    index("payouts_finalized_at_idx").on(table.finalizedAt),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("reminders_unresolved_idx").on(table.resolvedAt)],
);

export const schedulingProposals = pgTable(
  "scheduling_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    state: schedulingProposalState("state").notNull().default("pending"),
    preferredWindowText: text("preferred_window_text").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    customerMessageBody: text("customer_message_body").notNull(),
    repairShoprAppointmentPayload: jsonb(
      "repairshopr_appointment_payload",
    ).notNull(),
    sourceEvidence: jsonb("source_evidence").notNull(),
    customerMessageApprovalId: uuid("customer_message_approval_id").references(
      () => approvals.id,
      { onDelete: "set null" },
    ),
    appointmentApprovalId: uuid("appointment_approval_id").references(
      () => approvals.id,
      { onDelete: "set null" },
    ),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("scheduling_proposals_state_idx").on(table.state),
    index("scheduling_proposals_conversation_id_idx").on(table.conversationId),
    index("scheduling_proposals_job_id_idx").on(table.jobId),
    index("scheduling_proposals_message_approval_idx").on(
      table.customerMessageApprovalId,
    ),
    index("scheduling_proposals_appointment_approval_idx").on(
      table.appointmentApprovalId,
    ),
  ],
);

export const writebackExecutions = pgTable(
  "writeback_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    approvalId: uuid("approval_id")
      .notNull()
      .references(() => approvals.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    state: writebackExecutionState("state").notNull().default("ready"),
    targetKind: text("target_kind").notNull(),
    action: text("action").notNull(),
    requestPayload: jsonb("request_payload").notNull(),
    responsePayload: jsonb("response_payload"),
    errorMessage: text("error_message"),
    repairShoprEntityType: text("repairshopr_entity_type"),
    repairShoprId: text("repairshopr_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
    executedByUserId: uuid("executed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    succeededAt: timestamp("succeeded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("writeback_executions_approval_unique").on(table.approvalId),
    index("writeback_executions_state_idx").on(table.state),
    index("writeback_executions_job_id_idx").on(table.jobId),
    index("writeback_executions_target_action_idx").on(
      table.targetKind,
      table.action,
    ),
    index("writeback_executions_repairshopr_ref_idx").on(
      table.repairShoprEntityType,
      table.repairShoprId,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);
