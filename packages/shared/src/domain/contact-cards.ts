import { z } from "zod";
import { CustomerIntakeStateSchema } from "./intake.js";

export const ContactCardParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

export const ContactCardMissingFieldSchema = z.enum([
  "name",
  "phone",
  "identified_state",
]);

export const ContactCardDataSchema = z.object({
  conversationId: z.string().uuid(),
  fullName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().min(1).nullable(),
  serviceAddress: z.string().trim().min(1).nullable(),
});

export const ContactCardPreviewResponseSchema = z.object({
  available: z.boolean(),
  missingFields: z.array(ContactCardMissingFieldSchema),
  state: CustomerIntakeStateSchema,
  contact: ContactCardDataSchema.nullable(),
});

export const ContactCardVcardResponseSchema = z.object({
  text: z.string().min(1),
});

export type ContactCardParams = z.infer<typeof ContactCardParamsSchema>;
export type ContactCardMissingField = z.infer<
  typeof ContactCardMissingFieldSchema
>;
export type ContactCardData = z.infer<typeof ContactCardDataSchema>;
export type ContactCardPreviewResponse = z.infer<
  typeof ContactCardPreviewResponseSchema
>;
export type ContactCardVcardResponse = z.infer<
  typeof ContactCardVcardResponseSchema
>;
