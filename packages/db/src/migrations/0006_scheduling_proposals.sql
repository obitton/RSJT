CREATE TYPE "public"."scheduling_proposal_state" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "scheduling_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"job_id" uuid,
	"state" "scheduling_proposal_state" DEFAULT 'pending' NOT NULL,
	"preferred_window_text" text NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"customer_message_body" text NOT NULL,
	"repairshopr_appointment_payload" jsonb NOT NULL,
	"source_evidence" jsonb NOT NULL,
	"customer_message_approval_id" uuid,
	"appointment_approval_id" uuid,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduling_proposals" ADD CONSTRAINT "scheduling_proposals_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_proposals" ADD CONSTRAINT "scheduling_proposals_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_proposals" ADD CONSTRAINT "scheduling_proposals_customer_message_approval_id_approvals_id_fk" FOREIGN KEY ("customer_message_approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_proposals" ADD CONSTRAINT "scheduling_proposals_appointment_approval_id_approvals_id_fk" FOREIGN KEY ("appointment_approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_proposals" ADD CONSTRAINT "scheduling_proposals_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduling_proposals_state_idx" ON "scheduling_proposals" USING btree ("state");--> statement-breakpoint
CREATE INDEX "scheduling_proposals_conversation_id_idx" ON "scheduling_proposals" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "scheduling_proposals_job_id_idx" ON "scheduling_proposals" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "scheduling_proposals_message_approval_idx" ON "scheduling_proposals" USING btree ("customer_message_approval_id");--> statement-breakpoint
CREATE INDEX "scheduling_proposals_appointment_approval_idx" ON "scheduling_proposals" USING btree ("appointment_approval_id");
