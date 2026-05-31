import type { ExtractedFact, UserRole } from "@rsjt/shared";
import { describe, expect, it } from "vitest";
import {
  DeterministicUpdateExtractionAdapter,
  type ExtractedFactStore,
  type JobUpdateMessageStore,
  UpdateExtractionService,
} from "./update-extraction-service.js";

const jobId = "00000000-0000-4000-8000-000000009001";
const messageId = "00000000-0000-4000-8000-000000000201";

describe("UpdateExtractionService", () => {
  it("extracts structured facts from a terse job update", async () => {
    const factStore = new InMemoryExtractedFactStore();
    const service = new UpdateExtractionService(
      new StaticMessageStore(messageId),
      factStore,
      new DeterministicUpdateExtractionAdapter(),
    );

    const response = await service.extractJobUpdate({
      jobId,
      authorRole: "tech",
      body: "went to Michele, 1 hr 200",
    });

    expect(response).toMatchObject({
      jobId,
      messageId,
      missingFields: ["expense_cents", "follow_up_needed"],
      prompts: [
        {
          field: "expense_cents",
          message: "Any parts, materials, or subcontractor costs for this job?",
        },
        {
          field: "follow_up_needed",
          message: "Any follow-up needed with the customer?",
        },
      ],
    });
    expect(response.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "customer_hint",
          value: { text: "Michele" },
          confidence: 0.7,
          evidence: { messageId, quote: "Michele" },
          requiresConfirmation: true,
        }),
        expect.objectContaining({
          type: "duration_minutes",
          value: { minutes: 60 },
          confidence: 0.95,
          evidence: { messageId, quote: "1 hr" },
          requiresConfirmation: false,
        }),
        expect.objectContaining({
          type: "gross_charge_cents",
          value: { amountCents: 20000 },
          confidence: 0.75,
          evidence: { messageId, quote: "200" },
          requiresConfirmation: true,
        }),
        expect.objectContaining({
          type: "completion_state",
          value: { state: "likely_completed" },
          confidence: 0.65,
          evidence: { messageId, quote: "went to Michele, 1 hr 200" },
          requiresConfirmation: true,
        }),
      ]),
    );
    expect(factStore.replacements).toEqual([
      {
        jobId,
        messageId,
        facts: response.facts,
      },
    ]);
  });

  it("does not ask for expenses or follow-up when the update answers them", async () => {
    const service = new UpdateExtractionService(
      new StaticMessageStore(messageId),
      new InMemoryExtractedFactStore(),
      new DeterministicUpdateExtractionAdapter(),
    );

    const response = await service.extractJobUpdate({
      jobId,
      authorRole: "manager",
      body: "fixed for Michele, 90 min charged 300 no parts no follow up",
    });

    expect(response.missingFields).toEqual([]);
    expect(response.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "gross_charge_cents",
          value: { amountCents: 30000 },
          requiresConfirmation: false,
        }),
        expect.objectContaining({
          type: "completion_state",
          value: { state: "completed" },
          requiresConfirmation: false,
        }),
        expect.objectContaining({
          type: "follow_up_needed",
          value: { needed: false },
          requiresConfirmation: false,
        }),
      ]),
    );
  });
});

class StaticMessageStore implements JobUpdateMessageStore {
  constructor(private readonly messageId: string) {}

  async createJobUpdateMessage(input: {
    jobId: string;
    authorRole: UserRole;
    body: string;
  }) {
    expect(input).toMatchObject({ jobId, body: expect.any(String) });
    return this.messageId;
  }
}

class InMemoryExtractedFactStore implements ExtractedFactStore {
  readonly replacements: Array<{
    jobId: string;
    messageId: string;
    facts: ExtractedFact[];
  }> = [];

  async replaceForMessage(
    jobId: string,
    messageId: string,
    facts: ExtractedFact[],
  ) {
    this.replacements.push({ jobId, messageId, facts });
  }
}
