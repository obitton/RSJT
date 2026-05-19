import { z } from "zod";

export const RepairShoprEntityTypeSchema = z.enum([
  "customer",
  "contact",
  "lead",
  "ticket",
  "appointment",
  "invoice",
  "payment",
  "ticket_comment",
]);

export const RepairShoprReferenceSchema = z.object({
  entityType: RepairShoprEntityTypeSchema,
  repairShoprId: z.string().min(1),
  displayLabel: z.string().min(1),
  url: z.string().url().optional(),
});

export type RepairShoprEntityType = z.infer<typeof RepairShoprEntityTypeSchema>;
export type RepairShoprReference = z.infer<typeof RepairShoprReferenceSchema>;
