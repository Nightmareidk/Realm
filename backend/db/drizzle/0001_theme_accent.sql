CREATE TYPE "public"."theme_accent" AS ENUM('mint', 'orchid', 'aqua', 'ember');--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "accent" "theme_accent" DEFAULT 'mint' NOT NULL;