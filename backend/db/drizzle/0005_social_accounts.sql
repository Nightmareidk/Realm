CREATE TYPE "public"."account_kind" AS ENUM('personal', 'business');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'post_like' BEFORE 'comment_reply';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_kind" "account_kind" DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "website_url" text;