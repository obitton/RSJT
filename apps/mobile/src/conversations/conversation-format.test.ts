import { describe, expect, it } from "vitest";
import { formatMessageSender } from "./conversation-format";

describe("formatMessageSender", () => {
  it("labels an inbound message as the customer regardless of author", () => {
    expect(formatMessageSender("inbound", null)).toBe("Customer");
  });

  it("names the manager and tech from the author role", () => {
    expect(formatMessageSender("outbound", "manager")).toBe("Manager");
    expect(formatMessageSender("internal", "manager")).toBe("Manager");
    expect(formatMessageSender("outbound", "tech")).toBe("Tech");
    expect(formatMessageSender("internal", "tech")).toBe("Tech");
  });

  it("treats an authorless outbound or internal message as automated", () => {
    expect(formatMessageSender("outbound", null)).toBe("Automated");
    expect(formatMessageSender("internal", null)).toBe("Automated");
  });
});
