ALTER TYPE "public"."notification_type" ADD VALUE 'post_repost' BEFORE 'comment_reply';--> statement-breakpoint
CREATE TABLE "reposts" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"post_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reposts_once_key" ON "reposts" USING btree ("user_id","post_id");--> statement-breakpoint
CREATE INDEX "reposts_user_idx" ON "reposts" USING btree ("user_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reposts_post_idx" ON "reposts" USING btree ("post_id");