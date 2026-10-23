CREATE TABLE "playlist_items" (
	"playlist_id" bigint NOT NULL,
	"sound_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_items_playlist_id_sound_id_pk" PRIMARY KEY("playlist_id","sound_id")
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" bigint PRIMARY KEY NOT NULL,
	"owner_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_public" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sound_likes" (
	"user_id" bigint NOT NULL,
	"sound_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sound_likes_user_id_sound_id_pk" PRIMARY KEY("user_id","sound_id")
);
--> statement-breakpoint
CREATE TABLE "sound_plays" (
	"user_id" bigint NOT NULL,
	"sound_id" bigint NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sound_plays_user_id_sound_id_pk" PRIMARY KEY("user_id","sound_id")
);
--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_sound_id_sounds_id_fk" FOREIGN KEY ("sound_id") REFERENCES "public"."sounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_likes" ADD CONSTRAINT "sound_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_likes" ADD CONSTRAINT "sound_likes_sound_id_sounds_id_fk" FOREIGN KEY ("sound_id") REFERENCES "public"."sounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_plays" ADD CONSTRAINT "sound_plays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_plays" ADD CONSTRAINT "sound_plays_sound_id_sounds_id_fk" FOREIGN KEY ("sound_id") REFERENCES "public"."sounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlist_items_order_idx" ON "playlist_items" USING btree ("playlist_id","position");--> statement-breakpoint
CREATE INDEX "playlists_owner_idx" ON "playlists" USING btree ("owner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sound_likes_user_idx" ON "sound_likes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sound_plays_recent_idx" ON "sound_plays" USING btree ("user_id","played_at" DESC NULLS LAST);