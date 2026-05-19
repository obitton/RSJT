import { describe, expect, it } from "vitest";
import {
  ExpenseCategorySchema,
  MatchConfidenceThresholds,
  MatchSearchInputSchema,
  SplitCategorySchema,
  SplitPercentByCategory,
} from "../index.js";

describe("domain contracts", () => {
  it("does not include travel as a deductible expense category", () => {
    expect(ExpenseCategorySchema.safeParse("travel").success).toBe(false);
  });

  it("models returning RepairShopr customer split", () => {
    expect(SplitCategorySchema.parse("returning_repairshopr_customer")).toBe(
      "returning_repairshopr_customer",
    );
    expect(SplitPercentByCategory.returning_repairshopr_customer).toEqual({
      manager: 30,
      tech: 70,
    });
  });

  it("uses medium-high and high match thresholds from PP01", () => {
    expect(MatchConfidenceThresholds.mediumHigh).toBe(0.7);
    expect(MatchConfidenceThresholds.high).toBe(0.85);
  });

  it("requires at least one match search hint", () => {
    expect(MatchSearchInputSchema.safeParse({}).success).toBe(false);
    expect(
      MatchSearchInputSchema.safeParse({ phone: "555-0101" }).success,
    ).toBe(true);
  });
});
