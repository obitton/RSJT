import type { AppDb } from "@rsjt/db";
import { auditEvents, expenses, jobs } from "@rsjt/db";
import {
  type JobExpense,
  type JobExpenseInput,
  JobExpenseSchema,
  type JobState,
  type ProfitBasis,
  type SplitCategory,
} from "@rsjt/shared";
import { asc, eq } from "drizzle-orm";

type JobMoneyJob = typeof jobs.$inferSelect;
type ExpenseRow = typeof expenses.$inferSelect;

export type JobMoneyRecord = {
  job: JobMoneyJob;
  expenses: JobExpense[];
};

export type ReplaceJobMoneyInput = {
  jobId: string;
  actorUserId: string;
  state: JobState;
  completedAt: Date | null;
  grossChargeCents: number | null;
  reportedProfitCents: number | null;
  calculatedProfitCents: number | null;
  profitBasis: ProfitBasis | null;
  expenses: JobExpenseInput[];
};

export type OverrideSplitCategoryInput = {
  jobId: string;
  actorUserId: string;
  splitCategory: SplitCategory;
  reason: string;
  state: JobState;
  completedAt: Date | null;
  calculatedProfitCents: number | null;
  profitBasis: ProfitBasis | null;
};

export class JobMoneyRepository {
  constructor(private readonly db: AppDb) {}

  async getMoney(jobId: string): Promise<JobMoneyRecord | null> {
    const [job] = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) {
      return null;
    }

    const expenseRows = await this.db
      .select()
      .from(expenses)
      .where(eq(expenses.jobId, jobId))
      .orderBy(asc(expenses.createdAt), asc(expenses.id));

    return {
      job,
      expenses: expenseRows.map(toJobExpense),
    };
  }

  async replaceMoney(
    input: ReplaceJobMoneyInput,
  ): Promise<JobMoneyRecord | null> {
    const updated = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [job] = await tx
        .update(jobs)
        .set({
          state: input.state,
          completedAt: input.completedAt,
          grossChargeCents: input.grossChargeCents,
          reportedProfitCents: input.reportedProfitCents,
          calculatedProfitCents: input.calculatedProfitCents,
          profitBasis: input.profitBasis,
          updatedAt: now,
        })
        .where(eq(jobs.id, input.jobId))
        .returning({ id: jobs.id });

      if (!job) {
        return false;
      }

      await tx.delete(expenses).where(eq(expenses.jobId, input.jobId));

      if (input.expenses.length > 0) {
        await tx.insert(expenses).values(
          input.expenses.map((expense) => ({
            jobId: input.jobId,
            category: expense.category,
            amountCents: expense.amountCents,
            description: expense.description ?? null,
            enteredByUserId: input.actorUserId,
            updatedAt: now,
          })),
        );
      }

      return true;
    });

    return updated ? this.getMoney(input.jobId) : null;
  }

  async overrideSplitCategory(
    input: OverrideSplitCategoryInput,
  ): Promise<JobMoneyRecord | null> {
    const updated = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: jobs.id,
          splitCategory: jobs.splitCategory,
        })
        .from(jobs)
        .where(eq(jobs.id, input.jobId))
        .limit(1);

      if (!existing) {
        return false;
      }

      const now = new Date();
      await tx
        .update(jobs)
        .set({
          splitCategory: input.splitCategory,
          state: input.state,
          completedAt: input.completedAt,
          calculatedProfitCents: input.calculatedProfitCents,
          profitBasis: input.profitBasis,
          updatedAt: now,
        })
        .where(eq(jobs.id, input.jobId));

      await tx.insert(auditEvents).values({
        actorUserId: input.actorUserId,
        entityType: "job",
        entityId: input.jobId,
        action: "split_category_override",
        metadata: {
          previousSplitCategory: existing.splitCategory,
          nextSplitCategory: input.splitCategory,
          reason: input.reason,
        },
      });

      return true;
    });

    return updated ? this.getMoney(input.jobId) : null;
  }
}

function toJobExpense(row: ExpenseRow): JobExpense {
  return JobExpenseSchema.parse({
    id: row.id,
    jobId: row.jobId,
    category: row.category,
    amountCents: row.amountCents,
    description: row.description,
    enteredByUserId: row.enteredByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
