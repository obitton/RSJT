import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  approvalState,
  approvals,
  auditEvents,
  conversations,
  customerIntakeState,
  expenses,
  extractedFacts,
  jobState,
  jobs,
  matchCandidates,
  messageMedia,
  messages,
  messagingWebhookEvents,
  payouts,
  profitBasis,
  reminders,
  schedulingProposalState,
  schedulingProposals,
  sessions,
  splitCategory,
  userRole,
  users,
  writebackExecutionState,
  writebackExecutions,
} from "./schema.js";

describe("database schema", () => {
  it("exports the required app-owned tables", () => {
    expect(users).toBeDefined();
    expect(sessions).toBeDefined();
    expect(conversations).toBeDefined();
    expect(messages).toBeDefined();
    expect(jobs).toBeDefined();
    expect(extractedFacts).toBeDefined();
    expect(matchCandidates).toBeDefined();
    expect(approvals).toBeDefined();
    expect(expenses).toBeDefined();
    expect(payouts).toBeDefined();
    expect(reminders).toBeDefined();
    expect(auditEvents).toBeDefined();
    expect(messageMedia).toBeDefined();
    expect(messagingWebhookEvents).toBeDefined();
    expect(writebackExecutions).toBeDefined();
  });

  it("keeps core enum values aligned with shared product decisions", () => {
    expect(userRole.enumValues).toEqual(["manager", "tech"]);
    expect(jobState.enumValues).toContain("payout_ready");
    expect(approvalState.enumValues).toContain("pending");
    expect(splitCategory.enumValues).toContain(
      "returning_repairshopr_customer",
    );
    expect(profitBasis.enumValues).toContain("reported_profit");
    expect(writebackExecutionState.enumValues).toEqual([
      "ready",
      "succeeded",
      "failed",
      "blocked",
    ]);
  });

  it("stores RepairShopr records as external references on jobs", () => {
    const columns = getTableColumns(jobs);

    expect(columns.repairShoprEntityType).toBeDefined();
    expect(columns.repairShoprId).toBeDefined();
    expect(columns.customerLabel).toBeDefined();
    expect("repairShoprCustomer" in columns).toBe(false);
  });

  it("stores displayable RepairShopr references on match candidates", () => {
    const columns = getTableColumns(matchCandidates);

    expect(columns.repairShoprEntityType).toBeDefined();
    expect(columns.repairShoprId).toBeDefined();
    expect(columns.repairShoprDisplayLabel).toBeDefined();
    expect(columns.repairShoprUrl).toBeDefined();
  });

  it("stores staged approval lifecycle metadata", () => {
    const columns = getTableColumns(approvals);

    expect(columns.requiredRole).toBeDefined();
    expect(columns.originalPayload).toBeDefined();
    expect(columns.payload).toBeDefined();
    expect(columns.createdByUserId).toBeDefined();
    expect(columns.decidedByUserId).toBeDefined();
  });

  it("defines lookup indexes for common query paths", () => {
    expect(indexNames(users)).toContain("users_username_unique");
    expect(indexNames(sessions)).toEqual(
      expect.arrayContaining([
        "sessions_token_hash_unique",
        "sessions_user_id_idx",
      ]),
    );
    expect(indexNames(jobs)).toEqual(
      expect.arrayContaining(["jobs_state_idx", "jobs_repairshopr_ref_idx"]),
    );
    expect(indexNames(matchCandidates)).toEqual(
      expect.arrayContaining([
        "match_candidates_job_id_idx",
        "match_candidates_job_repairshopr_unique",
      ]),
    );
    expect(indexNames(approvals)).toEqual(
      expect.arrayContaining([
        "approvals_state_idx",
        "approvals_job_id_idx",
        "approvals_kind_idx",
        "approvals_risk_idx",
        "approvals_required_role_idx",
      ]),
    );
    expect(indexNames(payouts)).toContain("payouts_job_id_idx");
    expect(indexNames(auditEvents)).toContain("audit_events_entity_idx");
    expect(indexNames(messageMedia)).toEqual(
      expect.arrayContaining([
        "message_media_message_id_idx",
        "message_media_message_index_unique",
      ]),
    );
    expect(indexNames(messagingWebhookEvents)).toEqual(
      expect.arrayContaining([
        "messaging_webhook_events_sid_idx",
        "messaging_webhook_events_type_idx",
      ]),
    );
  });

  it("stores outbound external status and media metadata for messaging", () => {
    const messageColumns = getTableColumns(messages);
    const mediaColumns = getTableColumns(messageMedia);
    const eventColumns = getTableColumns(messagingWebhookEvents);

    expect(messageColumns.externalStatus).toBeDefined();
    expect(mediaColumns.mediaIndex).toBeDefined();
    expect(mediaColumns.contentType).toBeDefined();
    expect(mediaColumns.url).toBeDefined();
    expect(eventColumns.payload).toBeDefined();
    expect(eventColumns.eventType).toBeDefined();
  });

  it("models scheduling proposals with state and approval links", () => {
    expect(schedulingProposalState.enumValues).toEqual([
      "pending",
      "approved",
      "rejected",
      "expired",
    ]);
    const columns = getTableColumns(schedulingProposals);
    expect(columns.conversationId).toBeDefined();
    expect(columns.jobId).toBeDefined();
    expect(columns.preferredWindowText).toBeDefined();
    expect(columns.customerMessageBody).toBeDefined();
    expect(columns.repairShoprAppointmentPayload).toBeDefined();
    expect(columns.customerMessageApprovalId).toBeDefined();
    expect(columns.appointmentApprovalId).toBeDefined();
    expect(indexNames(schedulingProposals)).toEqual(
      expect.arrayContaining([
        "scheduling_proposals_state_idx",
        "scheduling_proposals_conversation_id_idx",
        "scheduling_proposals_job_id_idx",
      ]),
    );
  });

  it("models writeback execution attempts and external references", () => {
    const columns = getTableColumns(writebackExecutions);

    expect(columns.approvalId).toBeDefined();
    expect(columns.jobId).toBeDefined();
    expect(columns.state).toBeDefined();
    expect(columns.requestPayload).toBeDefined();
    expect(columns.responsePayload).toBeDefined();
    expect(columns.errorMessage).toBeDefined();
    expect(columns.repairShoprEntityType).toBeDefined();
    expect(columns.repairShoprId).toBeDefined();
    expect(columns.attemptCount).toBeDefined();
    expect(indexNames(writebackExecutions)).toEqual(
      expect.arrayContaining([
        "writeback_executions_approval_unique",
        "writeback_executions_state_idx",
        "writeback_executions_job_id_idx",
        "writeback_executions_target_action_idx",
        "writeback_executions_repairshopr_ref_idx",
      ]),
    );
  });

  it("models customer intake fields on conversations", () => {
    expect(customerIntakeState.enumValues).toEqual([
      "unknown",
      "identifying",
      "collecting",
      "matched",
      "review_ready",
      "blocked",
    ]);
    const columns = getTableColumns(conversations);
    expect(columns.intakeState).toBeDefined();
    expect(columns.customerName).toBeDefined();
    expect(columns.serviceAddress).toBeDefined();
    expect(columns.problemDescription).toBeDefined();
    expect(columns.preferredTiming).toBeDefined();
    expect(columns.spamScore).toBeDefined();
    expect(columns.matchedRepairShoprEntityType).toBeDefined();
    expect(columns.lastInboundMessageId).toBeDefined();
    expect(indexNames(conversations)).toEqual(
      expect.arrayContaining([
        "conversations_intake_state_idx",
        "conversations_last_inbound_at_idx",
        "conversations_matched_repairshopr_idx",
      ]),
    );
  });
});

function indexNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).indexes.map((index) => index.config.name);
}
