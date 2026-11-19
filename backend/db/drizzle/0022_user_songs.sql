ALTER TABLE "sounds" ADD COLUMN "cover_media_id" bigint;--> statement-breakpoint
ALTER TABLE "sounds" ADD COLUMN "rights_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sounds" ADD CONSTRAINT "sounds_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;