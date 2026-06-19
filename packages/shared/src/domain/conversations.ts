import { z } from "zod";
import { JobSummarySchema } from "./jobs.js";

export const ConversationMessageDirectionSchema = z.enum([
  "inbound",
  "outbound",
  "internal",
]);

export const OutboundMessageStatusSchema = z.enum([
  "draft",
  "blocked",
  "queued",
  "accepted",
  "sent",
  "delivered",
  "failed",
  "undelivered",
]);

export const ConversationMessageSchema = z.object({
  id: z.string().uuid(),
  direction: ConversationMessageDirectionSchema,
  authorRole: z.enum(["manager", "tech"]).nullable(),
  body: z.string(),
  twilioMessageSid: z.string().min(1).nullable(),
  externalStatus: z.string().min(1).nullable(),
  sentByUserId: z.string().uuid().nullable(),
  createdAt: z.date(),
});

export const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  externalPhone: z.string().min(1).nullable(),
  takeoverActive: z.boolean(),
  takeoverStartedAt: z.date().nullable(),
  takeoverStartedByUserId: z.string().uuid().nullable(),
  intakeState: z.string().min(1),
  customerName: z.string().min(1).nullable(),
  lastInboundAt: z.date().nullable(),
  lastInboundPreview: z.string().min(1).nullable(),
  updatedAt: z.date(),
});

export const ConversationDetailSchema = ConversationSummarySchema.extend({
  // The job this lead was converted into, if any. Present means the lead is
  // already a job and should not offer conversion again.
  jobId: z.string().uuid().nullable(),
  messages: z.array(ConversationMessageSchema),
});

export const ConversationListResponseSchema = z.object({
  active: z.array(ConversationSummarySchema),
  needsResponse: z.array(ConversationSummarySchema),
  recent: z.array(ConversationSummarySchema),
});

export const ConversationDetailResponseSchema = z.object({
  conversation: ConversationDetailSchema,
});

export const ConversationIdParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

export const SetTakeoverRequestSchema = z.object({
  active: z.boolean(),
});

export const SendConversationMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(1600),
});

export const SendConversationMessageResponseSchema = z.object({
  message: ConversationMessageSchema,
});

// Converting a lead (conversation) into a job returns the job that was created.
export const ConvertLeadToJobResponseSchema = z.object({
  job: JobSummarySchema,
});

export type ConversationMessageDirection = z.infer<
  typeof ConversationMessageDirectionSchema
>;
export type OutboundMessageStatus = z.infer<typeof OutboundMessageStatusSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;
export type ConversationListResponse = z.infer<
  typeof ConversationListResponseSchema
>;
export type ConversationDetailResponse = z.infer<
  typeof ConversationDetailResponseSchema
>;
export type ConversationIdParams = z.infer<typeof ConversationIdParamsSchema>;
export type SetTakeoverRequest = z.infer<typeof SetTakeoverRequestSchema>;
export type SendConversationMessageRequest = z.infer<
  typeof SendConversationMessageRequestSchema
>;
export type SendConversationMessageResponse = z.infer<
  typeof SendConversationMessageResponseSchema
>;
export type ConvertLeadToJobResponse = z.infer<
  typeof ConvertLeadToJobResponseSchema
>;
