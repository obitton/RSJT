CREATE TYPE "public"."writeback_execution_state" AS ENUM('ready', 'succeeded', 'failed', 'blocked');--> statement-breakpoint
CREATE TABLE "writeback_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"job_id" uuid,
	"kind" text NOT NULL,
	"state" "writeback_execution_state" DEFAULT 'ready' NOT NULL,
	"target_kind" text NOT NULL,
	"action" text NOT NULL,
	"request_payload" jsonb NOT NULL,
	"response_payload" jsonb,
	"error_message" text,
	"repairshopr_entity_type" text,
	"repairshopr_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempted_at" timestamp with time zone,
	"executed_by_user_id" uuid,
	"succeeded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "writeback_executions_approval_unique" UNIQUE("approval_id")
);
--> statement-breakpoint
ALTER TABLE "writeback_executions" ADD CONSTRAINT "writeback_executions_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writeback_executions" ADD CONSTRAINT "writeback_executions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writeback_executions" ADD CONSTRAINT "writeback_executions_executed_by_user_id_users_id_fk" FOREIGN KEY ("executed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "writeback_executions_state_idx" ON "writeback_executions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "writeback_executions_job_id_idx" ON "writeback_executions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "writeback_executions_target_action_idx" ON "writeback_executions" USING btree ("target_kind","action");--> statement-breakpoint
CREATE INDEX "writeback_executions_repairshopr_ref_idx" ON "writeback_executions" USING btree ("repairshopr_entity_type","repairshopr_id");
