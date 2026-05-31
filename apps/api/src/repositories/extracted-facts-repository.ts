import type { AppDb } from "@rsjt/db";
import { extractedFacts } from "@rsjt/db";
import {
  type ExtractedFact,
  ExtractedFactSchema,
  FactConfirmationConfidenceThreshold,
} from "@rsjt/shared";
import { eq } from "drizzle-orm";

type ExtractedFactRow = typeof extractedFacts.$inferSelect;

export type StoredExtractedFact = ExtractedFact & {
  id: string;
  createdAt: Date;
};

export class ExtractedFactsRepository {
  constructor(private readonly db: AppDb) {}

  async replaceForMessage(
    jobId: string,
    messageId: string,
    facts: ExtractedFact[],
  ) {
    const parsedFacts = facts.map((fact) => ExtractedFactSchema.parse(fact));

    await this.db.transaction(async (tx) => {
      await tx
        .delete(extractedFacts)
        .where(eq(extractedFacts.messageId, messageId));

      if (parsedFacts.length === 0) {
        return;
      }

      await tx.insert(extractedFacts).values(
        parsedFacts.map((fact) => ({
          jobId,
          messageId,
          factType: fact.type,
          value: fact.value,
          confidence: confidenceToBasisPoints(fact.confidence),
          evidence: fact.evidence,
        })),
      );
    });
  }

  async listForMessage(messageId: string) {
    const rows = await this.db
      .select()
      .from(extractedFacts)
      .where(eq(extractedFacts.messageId, messageId))
      .orderBy(extractedFacts.createdAt, extractedFacts.id);

    return rows.map(toStoredExtractedFact);
  }
}

function toStoredExtractedFact(row: ExtractedFactRow): StoredExtractedFact {
  const confidence = row.confidence / 10000;
  const fact = ExtractedFactSchema.parse({
    type: row.factType,
    value: row.value,
    confidence,
    evidence: row.evidence,
    requiresConfirmation: confidence < FactConfirmationConfidenceThreshold,
  });

  return {
    ...fact,
    id: row.id,
    createdAt: row.createdAt,
  };
}

function confidenceToBasisPoints(confidence: number) {
  return Math.round(confidence * 10000);
}
