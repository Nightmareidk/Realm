CREATE TYPE "public"."spark_source" AS ENUM('paid', 'gift', 'test');--> statement-breakpoint
CREATE TABLE "space_sparks" (
	"id" bigint PRIMARY KEY NOT NULL,
	"community_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"source" "spark_source" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "automod" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "space_sparks" ADD CONSTRAINT "space_sparks_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_sparks" ADD CONSTRAINT "space_sparks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "space_sparks_space_idx" ON "space_sparks" USING btree ("community_id","ends_at");--> statement-breakpoint
CREATE INDEX "space_sparks_user_idx" ON "space_sparks" USING btree ("user_id");