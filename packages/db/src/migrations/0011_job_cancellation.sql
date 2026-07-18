ALTER TABLE "jobs" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "canceled_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_canceled_by_user_id_users_id_fk" FOREIGN KEY ("canceled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
