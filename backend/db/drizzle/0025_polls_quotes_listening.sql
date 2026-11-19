ALTER TYPE "public"."notification_type" ADD VALUE 'post_quote' BEFORE 'comment_reply';--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"post_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"choice" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "post_polls" (
	"post_id" bigint PRIMARY KEY NOT NULL,
	"options" jsonb NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sound_play_days" (
	"user_id" bigint NOT NULL,
	"sound_id" bigint NOT NULL,
	"day" date NOT NULL,
	"plays" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sound_play_days_user_id_sound_id_day_pk" PRIMARY KEY("user_id","sound_id","day")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "quote_post_id" bigint;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "share_listening" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_polls" ADD CONSTRAINT "post_polls_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_play_days" ADD CONSTRAINT "sound_play_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_play_days" ADD CONSTRAINT "sound_play_days_sound_id_sounds_id_fk" FOREIGN KEY ("sound_id") REFERENCES "public"."sounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sound_play_days_user_idx" ON "sound_play_days" USING btree ("user_id","day" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_quote_idx" ON "posts" USING btree ("quote_post_id");