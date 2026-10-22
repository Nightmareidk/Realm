CREATE TYPE "public"."theme_look" AS ENUM('now-playing', 'wristband', 'plain');--> statement-breakpoint
CREATE TYPE "public"."theme_purchase_status" AS ENUM('pending', 'paid', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."theme_source" AS ENUM('added', 'bought', 'own');--> statement-breakpoint
CREATE TYPE "public"."theme_status" AS ENUM('draft', 'published', 'hidden', 'removed');--> statement-breakpoint
CREATE TYPE "public"."theme_look_pref" AS ENUM('now-playing', 'wristband', 'plain');--> statement-breakpoint
CREATE TABLE "theme_assets" (
	"theme_id" bigint NOT NULL,
	"media_id" bigint NOT NULL,
	CONSTRAINT "theme_assets_theme_id_media_id_pk" PRIMARY KEY("theme_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "theme_library" (
	"user_id" bigint NOT NULL,
	"theme_id" bigint NOT NULL,
	"source" "theme_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_library_user_id_theme_id_pk" PRIMARY KEY("user_id","theme_id")
);
--> statement-breakpoint
CREATE TABLE "theme_purchases" (
	"id" bigint PRIMARY KEY NOT NULL,
	"theme_id" bigint NOT NULL,
	"buyer_id" bigint NOT NULL,
	"amount_cents" integer NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"realm_cents" integer DEFAULT 0 NOT NULL,
	"creator_cents" integer DEFAULT 0 NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text NOT NULL,
	"status" "theme_purchase_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_reports" (
	"theme_id" bigint NOT NULL,
	"reporter_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_reports_theme_id_reporter_id_pk" PRIMARY KEY("theme_id","reporter_id")
);
--> statement-breakpoint
CREATE TABLE "theme_reviews" (
	"theme_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"stars" smallint NOT NULL,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_reviews_theme_id_user_id_pk" PRIMARY KEY("theme_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "theme_versions" (
	"theme_id" bigint NOT NULL,
	"number" integer NOT NULL,
	"file" jsonb NOT NULL,
	"changelog" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_versions_theme_id_number_pk" PRIMARY KEY("theme_id","number")
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" bigint PRIMARY KEY NOT NULL,
	"creator_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"look" "theme_look" NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"own_art" boolean DEFAULT false NOT NULL,
	"status" "theme_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"installs" integer DEFAULT 0 NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "look" "theme_look_pref" DEFAULT 'now-playing' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "theme_id" bigint;--> statement-breakpoint
ALTER TABLE "theme_assets" ADD CONSTRAINT "theme_assets_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_assets" ADD CONSTRAINT "theme_assets_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_library" ADD CONSTRAINT "theme_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_library" ADD CONSTRAINT "theme_library_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_purchases" ADD CONSTRAINT "theme_purchases_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_purchases" ADD CONSTRAINT "theme_purchases_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_reports" ADD CONSTRAINT "theme_reports_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_reports" ADD CONSTRAINT "theme_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_reviews" ADD CONSTRAINT "theme_reviews_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_reviews" ADD CONSTRAINT "theme_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_versions" ADD CONSTRAINT "theme_versions_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "theme_assets_media_idx" ON "theme_assets" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "theme_library_theme_idx" ON "theme_library" USING btree ("theme_id");--> statement-breakpoint
CREATE UNIQUE INDEX "theme_purchases_provider_key" ON "theme_purchases" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "theme_purchases_buyer_idx" ON "theme_purchases" USING btree ("buyer_id","theme_id");--> statement-breakpoint
CREATE INDEX "theme_reviews_theme_idx" ON "theme_reviews" USING btree ("theme_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "themes_creator_idx" ON "themes" USING btree ("creator_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "themes_store_idx" ON "themes" USING btree ("status","installs" DESC NULLS LAST);