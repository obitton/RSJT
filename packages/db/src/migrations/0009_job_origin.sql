CREATE TYPE "public"."job_origin" AS ENUM('lead', 'manual');--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "origin" "job_origin" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "origin_note" text;
