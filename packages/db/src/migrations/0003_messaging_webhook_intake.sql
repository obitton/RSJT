ALTER TABLE "messages" ADD COLUMN "external_status" text;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_twilio_sid_unique" ON "messages" USING btree ("twilio_message_sid") WHERE "twilio_message_sid" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "message_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"media_index" integer NOT NULL,
	"content_type" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messaging_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"twilio_message_sid" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_media_message_id_idx" ON "message_media" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_media_message_index_unique" ON "message_media" USING btree ("message_id","media_index");--> statement-breakpoint
CREATE INDEX "messaging_webhook_events_sid_idx" ON "messaging_webhook_events" USING btree ("twilio_message_sid");--> statement-breakpoint
CREATE INDEX "messaging_webhook_events_type_idx" ON "messaging_webhook_events" USING btree ("event_type");
