import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

function load(overrides: NodeJS.ProcessEnv = {}) {
  return loadConfig({ DATABASE_URL: "postgres://x", ...overrides });
}

describe("loadConfig", () => {
  it("parses MESSAGING_OUTBOUND_ENABLED from true, false, 1, or 0 only", () => {
    for (const value of ["false", "FALSE", "0"]) {
      expect(
        load({ MESSAGING_OUTBOUND_ENABLED: value }).MESSAGING_OUTBOUND_ENABLED,
      ).toBe(false);
    }
    for (const value of ["true", "1"]) {
      expect(
        load({ MESSAGING_OUTBOUND_ENABLED: value }).MESSAGING_OUTBOUND_ENABLED,
      ).toBe(true);
    }
    expect(() => load({ MESSAGING_OUTBOUND_ENABLED: "yes" })).toThrow();
    expect(load().MESSAGING_OUTBOUND_ENABLED).toBe(false);
  });

  it("leaves REPAIRSHOPR_WRITEBACK_ENABLED undefined when unset and parses false", () => {
    expect(load().REPAIRSHOPR_WRITEBACK_ENABLED).toBeUndefined();
    expect(
      load({ REPAIRSHOPR_WRITEBACK_ENABLED: "false" })
        .REPAIRSHOPR_WRITEBACK_ENABLED,
    ).toBe(false);
  });

  it("treats an empty REPAIRSHOPR_API_KEY as unset", () => {
    expect(
      load({ REPAIRSHOPR_API_KEY: "" }).REPAIRSHOPR_API_KEY,
    ).toBeUndefined();
  });

  it("rejects an empty DATABASE_URL", () => {
    expect(() => load({ DATABASE_URL: "" })).toThrow();
  });

  it("uses the default API_PORT when API_PORT is empty", () => {
    expect(load({ API_PORT: "" }).API_PORT).toBe(47630);
  });
});
