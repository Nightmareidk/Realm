CREATE TABLE "story_highlight_items" (
	"highlight_id" bigint NOT NULL,
	"story_id" bigint NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "story_highlight_items_highlight_id_story_id_pk" PRIMARY KEY("highlight_id","story_id")
);
--> statement-breakpoint
CREATE TABLE "story_highlights" (
	"id" bigint PRIMARY KEY NOT NULL,
	"owner_id" bigint NOT NULL,
	"title" text NOT NULL,
	"cover_story_id" bigint,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_highlight_items" ADD CONSTRAINT "story_highlight_items_highlight_id_story_highlights_id_fk" FOREIGN KEY ("highlight_id") REFERENCES "public"."story_highlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_highlight_items" ADD CONSTRAINT "story_highlight_items_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_highlights" ADD CONSTRAINT "story_highlights_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_highlight_items_story_idx" ON "story_highlight_items" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "story_highlights_owner_idx" ON "story_highlights" USING btree ("owner_id","position");