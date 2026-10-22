CREATE TYPE "public"."sound_kind" AS ENUM('library', 'original');--> statement-breakpoint
CREATE TYPE "public"."story_visibility" AS ENUM('public', 'followers');--> statement-breakpoint
CREATE TABLE "sounds" (
	"id" bigint PRIMARY KEY NOT NULL,
	"kind" "sound_kind" NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"creator_id" bigint,
	"media_id" bigint,
	"external_id" text,
	"audio_url" text,
	"cover_url" text,
	"duration_ms" integer NOT NULL,
	"licence" text,
	"source_url" text,
	"uses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" bigint PRIMARY KEY NOT NULL,
	"author_id" bigint NOT NULL,
	"media_id" bigint NOT NULL,
	"caption" text,
	"sound_id" bigint,
	"sound_start_ms" integer,
	"sound_play_ms" integer,
	"visibility" "story_visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "story_views" (
	"story_id" bigint NOT NULL,
	"viewer_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_views_story_id_viewer_id_pk" PRIMARY KEY("story_id","viewer_id")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "sound_id" bigint;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "sound_start_ms" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "sound_play_ms" integer;--> statement-breakpoint
ALTER TABLE "sounds" ADD CONSTRAINT "sounds_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sounds" ADD CONSTRAINT "sounds_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_sound_id_sounds_id_fk" FOREIGN KEY ("sound_id") REFERENCES "public"."sounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sounds_external_key" ON "sounds" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "sounds_uses_idx" ON "sounds" USING btree ("uses" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sounds_creator_idx" ON "sounds" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "stories_author_idx" ON "stories" USING btree ("author_id","expires_at" DESC NULLS LAST);