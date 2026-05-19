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
]);

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversations_external_phone_idx").on(table.externalPhone),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_job_id_idx").on(table.jobId),
    index("messages_twilio_sid_idx").on(table.twilioMessageSid),
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
    payload: jsonb("payload").notNull(),
    evidence: jsonb("evidence").notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("approvals_state_idx").on(table.state),
    index("approvals_job_id_idx").on(table.jobId),
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
