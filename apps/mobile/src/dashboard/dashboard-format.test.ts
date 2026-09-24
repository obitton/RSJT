import { JobStateSchema } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import { formatJobStateLabel } from "./dashboard-format";

describe("formatJobStateLabel", () => {
  it("returns a non-empty label for every job state", () => {
    for (const state of JobStateSchema.options) {
      const label = formatJobStateLabel(state);

      expect(label, state).toBeTypeOf("string");
      expect(label, state).not.toBe("");
    }
  });
});
