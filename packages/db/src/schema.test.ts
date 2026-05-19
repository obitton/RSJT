import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  approvalState,
  approvals,
  auditEvents,
  conversations,
  expenses,
  extractedFacts,
  jobState,
  jobs,
  matchCandidates,
  messages,
  payouts,
  profitBasis,
  reminders,
  sessions,
  splitCategory,
  userRole,
  users,
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
  });

  it("keeps core enum values aligned with shared product decisions", () => {
    expect(userRole.enumValues).toEqual(["manager", "tech"]);
    expect(jobState.enumValues).toContain("payout_ready");
    expect(approvalState.enumValues).toContain("pending");
    expect(splitCategory.enumValues).toContain(
      "returning_repairshopr_customer",
    );
    expect(profitBasis.enumValues).toContain("reported_profit");
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
    expect(indexNames(payouts)).toContain("payouts_job_id_idx");
    expect(indexNames(auditEvents)).toContain("audit_events_entity_idx");
  });
});

function indexNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).indexes.map((index) => index.config.name);
}
