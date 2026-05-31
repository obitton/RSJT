ALTER TABLE "conversations" ADD COLUMN "takeover_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "takeover_started_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sent_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_takeover_started_by_user_id_users_id_fk" FOREIGN KEY ("takeover_started_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_takeover_active_idx" ON "conversations" USING btree ("takeover_active");--> statement-breakpoint
CREATE INDEX "messages_external_status_idx" ON "messages" USING btree ("external_status");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");
