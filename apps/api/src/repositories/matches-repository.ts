import type { AppDb } from "@rsjt/db";
import { jobs, matchCandidates } from "@rsjt/db";
import {
  type MatchCandidate,
  MatchConfidenceBandSchema,
  MatchReasonSchema,
  type RepairShoprReference,
  RepairShoprReferenceSchema,
} from "@rsjt/shared";
import { and, eq, isNotNull } from "drizzle-orm";

type MatchCandidateRow = typeof matchCandidates.$inferSelect;

export type StoredMatchCandidate = MatchCandidate & {
  selectedAt: Date | null;
};

export interface MatchCandidateStore {
  replaceForJob(jobId: string, candidates: MatchCandidate[]): Promise<void>;
  listForJob(jobId: string): Promise<StoredMatchCandidate[]>;
  selectForJob(
    jobId: string,
    candidateId: string,
  ): Promise<RepairShoprReference | null>;
  clearSelection(jobId: string): Promise<void>;
  getSelectedReference(jobId: string): Promise<RepairShoprReference | null>;
}

export class MatchesRepository implements MatchCandidateStore {
  constructor(private readonly db: AppDb) {}

  async replaceForJob(jobId: string, candidates: MatchCandidate[]) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(jobs)
        .set({
          repairShoprEntityType: null,
          repairShoprId: null,
          customerLabel: null,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      await tx.delete(matchCandidates).where(eq(matchCandidates.jobId, jobId));

      if (candidates.length === 0) {
        return;
      }

      await tx.insert(matchCandidates).values(
        candidates.map((candidate) => ({
          id: candidate.id,
          jobId,
          repairShoprEntityType: candidate.repairShoprReference.entityType,
          repairShoprId: candidate.repairShoprReference.repairShoprId,
          repairShoprDisplayLabel: candidate.repairShoprReference.displayLabel,
          repairShoprUrl: candidate.repairShoprReference.url ?? null,
          confidence: confidenceToBasisPoints(candidate.confidence),
          confidenceBand: candidate.confidenceBand,
          reasons: candidate.reasons,
          selectedAt: null,
        })),
      );
    });
  }

  async listForJob(jobId: string) {
    const rows = await this.db
      .select()
      .from(matchCandidates)
      .where(eq(matchCandidates.jobId, jobId));

    return rows.map(toStoredCandidate);
  }

  async selectForJob(jobId: string, candidateId: string) {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(matchCandidates)
        .where(
          and(
            eq(matchCandidates.jobId, jobId),
            eq(matchCandidates.id, candidateId),
          ),
        )
        .limit(1);

      if (!candidate) {
        return null;
      }

      const now = new Date();

      await tx
        .update(matchCandidates)
        .set({ selectedAt: null })
        .where(eq(matchCandidates.jobId, jobId));

      await tx
        .update(matchCandidates)
        .set({ selectedAt: now })
        .where(
          and(
            eq(matchCandidates.jobId, jobId),
            eq(matchCandidates.id, candidateId),
          ),
        );

      await tx
        .update(jobs)
        .set({
          repairShoprEntityType: candidate.repairShoprEntityType,
          repairShoprId: candidate.repairShoprId,
          customerLabel: candidate.repairShoprDisplayLabel,
          updatedAt: now,
        })
        .where(eq(jobs.id, jobId));

      return toRepairShoprReference(candidate);
    });
  }

  async clearSelection(jobId: string) {
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(matchCandidates)
        .set({ selectedAt: null })
        .where(eq(matchCandidates.jobId, jobId));

      await tx
        .update(jobs)
        .set({
          repairShoprEntityType: null,
          repairShoprId: null,
          customerLabel: null,
          updatedAt: now,
        })
        .where(eq(jobs.id, jobId));
    });
  }

  async getSelectedReference(jobId: string) {
    const [candidate] = await this.db
      .select()
      .from(matchCandidates)
      .where(
        and(
          eq(matchCandidates.jobId, jobId),
          isNotNull(matchCandidates.selectedAt),
        ),
      )
      .limit(1);

    return candidate ? toRepairShoprReference(candidate) : null;
  }
}

function toStoredCandidate(row: MatchCandidateRow): StoredMatchCandidate {
  return {
    id: row.id,
    confidence: row.confidence / 10000,
    confidenceBand: MatchConfidenceBandSchema.parse(row.confidenceBand),
    reasons: MatchReasonSchema.array().parse(row.reasons),
    repairShoprReference: toRepairShoprReference(row),
    selectedAt: row.selectedAt,
  };
}

function toRepairShoprReference(row: MatchCandidateRow): RepairShoprReference {
  return RepairShoprReferenceSchema.parse({
    entityType: row.repairShoprEntityType,
    repairShoprId: row.repairShoprId,
    displayLabel: row.repairShoprDisplayLabel,
    ...(row.repairShoprUrl ? { url: row.repairShoprUrl } : {}),
  });
}

function confidenceToBasisPoints(confidence: number) {
  return Math.round(confidence * 10000);
}
