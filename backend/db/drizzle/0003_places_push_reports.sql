CREATE TYPE "public"."push_platform" AS ENUM('web', 'ios', 'android');--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"platform" "push_platform" DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "filename" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "embed" jsonb;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_once_key" ON "reports" USING btree ("reporter_id","target_type","target_id");