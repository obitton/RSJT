import { z } from "zod";

const NumMediaSchema = z.coerce.number().int().min(0);

const TwilioFormBaseShape = {
  MessageSid: z.string().min(1),
  AccountSid: z.string().min(1).optional(),
};

export const TwilioInboundWebhookSchema = z
  .object({
    ...TwilioFormBaseShape,
    From: z.string().min(1),
    To: z.string().min(1),
    Body: z.string().default(""),
    NumMedia: NumMediaSchema.default(0),
    MessagingServiceSid: z.string().min(1).optional(),
  })
  .passthrough();

export const TwilioStatusCallbackSchema = z
  .object({
    ...TwilioFormBaseShape,
    MessageStatus: z.string().min(1),
    ErrorCode: z.string().min(1).optional(),
    ErrorMessage: z.string().min(1).optional(),
  })
  .passthrough();

export const TwilioMediaItemSchema = z.object({
  index: z.number().int().min(0),
  contentType: z.string().min(1),
  url: z.string().url(),
});

export const MessageMediaSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  mediaIndex: z.number().int().min(0),
  contentType: z.string().min(1),
  url: z.string().url(),
  createdAt: z.date(),
});

export const MessagingWebhookEventKindSchema = z.enum([
  "inbound_message",
  "status_callback",
]);

export const MessagingWebhookEventSchema = z.object({
  id: z.string().uuid(),
  eventType: MessagingWebhookEventKindSchema,
  twilioMessageSid: z.string().min(1).nullable(),
  payload: z.record(z.unknown()),
  createdAt: z.date(),
});

export const InboundMessageRecordSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  twilioMessageSid: z.string().min(1),
  body: z.string(),
  media: z.array(MessageMediaSchema),
  createdAt: z.date(),
});

export type TwilioInboundWebhook = z.infer<typeof TwilioInboundWebhookSchema>;
export type TwilioStatusCallback = z.infer<typeof TwilioStatusCallbackSchema>;
export type TwilioMediaItem = z.infer<typeof TwilioMediaItemSchema>;
export type MessageMedia = z.infer<typeof MessageMediaSchema>;
export type MessagingWebhookEventKind = z.infer<
  typeof MessagingWebhookEventKindSchema
>;
export type MessagingWebhookEvent = z.infer<typeof MessagingWebhookEventSchema>;
export type InboundMessageRecord = z.infer<typeof InboundMessageRecordSchema>;

export function extractTwilioMediaItems(
  payload: TwilioInboundWebhook,
): TwilioMediaItem[] {
  const items: TwilioMediaItem[] = [];

  for (let index = 0; index < payload.NumMedia; index += 1) {
    const urlKey = `MediaUrl${index}`;
    const contentTypeKey = `MediaContentType${index}`;
    const url = payload[urlKey];
    const contentType = payload[contentTypeKey];

    if (typeof url !== "string" || typeof contentType !== "string") {
      continue;
    }

    const parsed = TwilioMediaItemSchema.safeParse({
      index,
      contentType,
      url,
    });

    if (parsed.success) {
      items.push(parsed.data);
    }
  }

  return items;
}
