import { describe, expect, it } from "vitest";
import { IntakeSpamGate } from "./intake-spam-gate.js";

describe("IntakeSpamGate", () => {
  const gate = new IntakeSpamGate();

  it("allows a normal repair request", () => {
    const result = gate.evaluate({
      current: { body: "My laptop will not boot.", hasMedia: false },
      recentMessages: [],
    });
    expect(result.isBlocked).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("blocks empty messages with no media", () => {
    const result = gate.evaluate({
      current: { body: "  ", hasMedia: false },
      recentMessages: [],
    });
    expect(result.isBlocked).toBe(true);
    expect(result.reason).toBe("Empty message");
  });

  it("allows empty messages when media is attached", () => {
    const result = gate.evaluate({
      current: { body: "", hasMedia: true },
      recentMessages: [],
    });
    expect(result.isBlocked).toBe(false);
  });

  it("blocks messages with more than three URLs", () => {
    const result = gate.evaluate({
      current: {
        body: "https://a https://b https://c https://d",
        hasMedia: false,
      },
      recentMessages: [],
    });
    expect(result.isBlocked).toBe(true);
    expect(result.reason).toBe("Too many links");
  });

  it("blocks messages containing high risk phrases", () => {
    const result = gate.evaluate({
      current: { body: "Click here to claim free money", hasMedia: false },
      recentMessages: [],
    });
    expect(result.isBlocked).toBe(true);
    expect(result.reason).toContain("High risk phrase");
  });

  it("blocks repeated identical messages", () => {
    const result = gate.evaluate({
      current: { body: "Hello", hasMedia: false },
      recentMessages: [
        { body: "Hello", hasMedia: false },
        { body: "Hello", hasMedia: false },
        { body: "Hello", hasMedia: false },
      ],
    });
    expect(result.isBlocked).toBe(true);
    expect(result.reason).toBe("Repeated identical messages");
  });
});
