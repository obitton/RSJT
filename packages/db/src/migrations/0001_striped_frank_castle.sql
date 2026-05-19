ALTER TABLE "match_candidates" ADD COLUMN "repairshopr_display_label" text NOT NULL;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD COLUMN "repairshopr_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "match_candidates_job_repairshopr_unique" ON "match_candidates" USING btree ("job_id","repairshopr_entity_type","repairshopr_id");