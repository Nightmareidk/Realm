CREATE TABLE "post_hashtags" (
	"post_id" bigint NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_hashtags_post_id_tag_pk" PRIMARY KEY("post_id","tag")
);
--> statement-breakpoint
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_hashtags_tag_idx" ON "post_hashtags" USING btree ("tag","post_id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "post_hashtags_recent_idx" ON "post_hashtags" USING btree ("created_at" DESC NULLS LAST);