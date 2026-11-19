ALTER TYPE "public"."notification_type" ADD VALUE 'capsule_open' BEFORE 'comment_reply';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "capsule_opened_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "posts_capsule_idx" ON "posts" USING btree ("opens_at") WHERE "posts"."opens_at" is not null;