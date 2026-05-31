ALTER TABLE "approvals" RENAME COLUMN "approved_by_user_id" TO "decided_by_user_id";--> statement-breakpoint
ALTER TABLE "approvals" RENAME CONSTRAINT "approvals_approved_by_user_id_users_id_fk" TO "approvals_decided_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "required_role" "user_role";--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "original_payload" jsonb;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "approvals" SET "required_role" = 'manager' WHERE "required_role" IS NULL;--> statement-breakpoint
UPDATE "approvals" SET "original_payload" = "payload" WHERE "original_payload" IS NULL;--> statement-breakpoint
ALTER TABLE "approvals" ALTER COLUMN "required_role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "approvals" ALTER COLUMN "original_payload" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_kind_idx" ON "approvals" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "approvals_risk_idx" ON "approvals" USING btree ("risk");--> statement-breakpoint
CREATE INDEX "approvals_required_role_idx" ON "approvals" USING btree ("required_role");
