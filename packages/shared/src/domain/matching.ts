import { z } from "zod";
import { MatchCandidateSchema } from "./jobs.js";
import { RepairShoprReferenceSchema } from "./repairshopr.js";

const OptionalHintSchema = z.string().trim().min(1).optional();

export const MatchSearchInputSchema = z
  .object({
    phone: OptionalHintSchema,
    email: z.string().trim().email().optional(),
    name: OptionalHintSchema,
    address: OptionalHintSchema,
    ticketNumber: OptionalHintSchema,
  })
  .refine(
    (input) =>
      Boolean(
        input.phone ||
          input.email ||
          input.name ||
          input.address ||
          input.ticketNumber,
      ),
    { message: "At least one match hint is required" },
  );

export const MatchSearchRequestSchema = z.object({
  input: MatchSearchInputSchema,
});

export const JobIdParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const MatchCandidateParamsSchema = JobIdParamsSchema.extend({
  candidateId: z.string().uuid(),
});

export const MatchSearchResponseSchema = z.object({
  jobId: z.string().uuid(),
  candidates: z.array(MatchCandidateSchema),
  displayLinkedCandidateId: z.string().uuid().nullable(),
  requiresConfirmation: z.boolean(),
});

export const MatchSelectionResponseSchema = z.object({
  jobId: z.string().uuid(),
  selectedCandidateId: z.string().uuid().nullable(),
  repairShoprReference: RepairShoprReferenceSchema.nullable(),
});

export type MatchSearchInput = z.infer<typeof MatchSearchInputSchema>;
export type MatchSearchRequest = z.infer<typeof MatchSearchRequestSchema>;
export type MatchSearchResponse = z.infer<typeof MatchSearchResponseSchema>;
export type MatchSelectionResponse = z.infer<
  typeof MatchSelectionResponseSchema
>;
