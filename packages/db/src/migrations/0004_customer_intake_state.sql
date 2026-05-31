CREATE TYPE "public"."customer_intake_state" AS ENUM('unknown', 'identifying', 'collecting', 'matched', 'review_ready', 'blocked');--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "intake_state" "customer_intake_state" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "customer_email" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "service_address" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "problem_description" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "preferred_timing" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "spam_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "matched_repairshopr_entity_type" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "matched_repairshopr_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "matched_repairshopr_display_label" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "matched_confidence_band" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_inbound_message_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_inbound_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "conversations_intake_state_idx" ON "conversations" USING btree ("intake_state");--> statement-breakpoint
CREATE INDEX "conversations_last_inbound_at_idx" ON "conversations" USING btree ("last_inbound_at");--> statement-breakpoint
CREATE INDEX "conversations_matched_repairshopr_idx" ON "conversations" USING btree ("matched_repairshopr_entity_type","matched_repairshopr_id");
