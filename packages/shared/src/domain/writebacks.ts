import { z } from "zod";
import { ApprovalKindSchema } from "./approvals.js";
import { RepairShoprEntityTypeSchema } from "./repairshopr.js";

const JsonObjectSchema = z.record(z.string(), z.unknown());

export const WritebackExecutionStateSchema = z.enum([
  "ready",
  "succeeded",
  "failed",
  "blocked",
]);

export const WritebackTargetKindSchema = z.enum([
  "repairshopr",
  "customer_message",
]);

export const RepairShoprWritebackActionSchema = z.enum([
  "customer_update",
  "contact_update",
  "lead_create",
  "ticket_create",
  "ticket_comment_create",
  "appointment_create",
]);

export const CustomerMessageExecutionActionSchema = z.literal(
  "customer_message_send",
);

export const WritebackActionSchema = z.union([
  RepairShoprWritebackActionSchema,
  CustomerMessageExecutionActionSchema,
]);

const ExistingRepairShoprTargetSchema = z.object({
  entityType: RepairShoprEntityTypeSchema,
  repairShoprId: z.string().min(1),
  displayLabel: z.string().min(1).optional(),
});

const NewRepairShoprTargetSchema = z.object({
  entityType: RepairShoprEntityTypeSchema,
  repairShoprId: z.string().min(1).optional(),
  displayLabel: z.string().min(1).optional(),
});

export const RepairShoprWritebackPayloadSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("customer_update"),
      target: ExistingRepairShoprTargetSchema.extend({
        entityType: z.literal("customer"),
      }),
      repairShoprPayload: JsonObjectSchema,
    }),
    z.object({
      action: z.literal("contact_update"),
      target: ExistingRepairShoprTargetSchema.extend({
        entityType: z.literal("contact"),
      }),
      repairShoprPayload: JsonObjectSchema,
    }),
    z.object({
      action: z.literal("lead_create"),
      target: NewRepairShoprTargetSchema.extend({
        entityType: z.literal("lead"),
      }),
      repairShoprPayload: JsonObjectSchema,
    }),
    z.object({
      action: z.literal("ticket_create"),
      target: NewRepairShoprTargetSchema.extend({
        entityType: z.literal("ticket"),
      }),
      repairShoprPayload: JsonObjectSchema,
    }),
    z.object({
      action: z.literal("ticket_comment_create"),
      target: ExistingRepairShoprTargetSchema.extend({
        entityType: z.literal("ticket"),
      }),
      repairShoprPayload: JsonObjectSchema,
    }),
    z.object({
      action: z.literal("appointment_create"),
      target: NewRepairShoprTargetSchema.extend({
        entityType: z.literal("appointment"),
      }),
      repairShoprPayload: JsonObjectSchema,
    }),
  ],
);

export const AppointmentCreationPayloadSchema = z.object({
  conversationId: z.string().uuid().optional(),
  jobId: z.string().uuid().nullable().optional(),
  appointment: JsonObjectSchema,
  preferredWindowText: z.string().trim().min(1).optional(),
});

export const CustomerMessageExecutionPayloadSchema = z.object({
  conversationId: z.string().uuid(),
  jobId: z.string().uuid().nullable().optional(),
  body: z.string().trim().min(1),
  preferredWindowText: z.string().trim().min(1).optional(),
});

export const WritebackApprovalPayloadSchema = z.union([
  RepairShoprWritebackPayloadSchema,
  AppointmentCreationPayloadSchema,
  CustomerMessageExecutionPayloadSchema,
]);

export const WritebackExecutionSchema = z.object({
  id: z.string().uuid(),
  approvalId: z.string().uuid(),
  jobId: z.string().uuid().nullable(),
  kind: ApprovalKindSchema,
  state: WritebackExecutionStateSchema,
  targetKind: WritebackTargetKindSchema,
  action: WritebackActionSchema,
  requestPayload: WritebackApprovalPayloadSchema,
  responsePayload: JsonObjectSchema.nullable(),
  errorMessage: z.string().nullable(),
  repairShoprEntityType: RepairShoprEntityTypeSchema.nullable(),
  repairShoprId: z.string().min(1).nullable(),
  attemptCount: z.number().int().nonnegative(),
  lastAttemptedAt: z.date().nullable(),
  executedByUserId: z.string().uuid().nullable(),
  succeededAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const WritebackExecutionListQuerySchema = z.object({
  state: WritebackExecutionStateSchema.optional(),
  approvalId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
});

export const WritebackExecutionListResponseSchema = z.object({
  executions: z.array(WritebackExecutionSchema),
});

export const WritebackApprovalExecuteParamsSchema = z.object({
  approvalId: z.string().uuid(),
});

export const WritebackExecutionIdParamsSchema = z.object({
  executionId: z.string().uuid(),
});

export const WritebackExecutionResponseSchema = z.object({
  execution: WritebackExecutionSchema,
});

export type WritebackExecutionState = z.infer<
  typeof WritebackExecutionStateSchema
>;
export type WritebackTargetKind = z.infer<typeof WritebackTargetKindSchema>;
export type RepairShoprWritebackAction = z.infer<
  typeof RepairShoprWritebackActionSchema
>;
export type WritebackAction = z.infer<typeof WritebackActionSchema>;
export type RepairShoprWritebackPayload = z.infer<
  typeof RepairShoprWritebackPayloadSchema
>;
export type AppointmentCreationPayload = z.infer<
  typeof AppointmentCreationPayloadSchema
>;
export type CustomerMessageExecutionPayload = z.infer<
  typeof CustomerMessageExecutionPayloadSchema
>;
export type WritebackApprovalPayload = z.infer<
  typeof WritebackApprovalPayloadSchema
>;
export type WritebackExecution = z.infer<typeof WritebackExecutionSchema>;
export type WritebackExecutionListQuery = z.infer<
  typeof WritebackExecutionListQuerySchema
>;
export type WritebackExecutionListResponse = z.infer<
  typeof WritebackExecutionListResponseSchema
>;
export type WritebackExecutionResponse = z.infer<
  typeof WritebackExecutionResponseSchema
>;
