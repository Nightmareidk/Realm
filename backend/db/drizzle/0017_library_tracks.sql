ALTER TABLE "sounds" ADD COLUMN "added_by" bigint;--> statement-breakpoint
ALTER TABLE "sounds" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sounds" ADD CONSTRAINT "sounds_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;