CREATE TYPE "public"."verification_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('moderator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verified_kind" AS ENUM('notable', 'business', 'official');--> statement-breakpoint
CREATE TABLE "reserved_handles" (
	"handle" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"added_by" bigint,
	"claimed_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_actions" (
	"id" bigint PRIMARY KEY NOT NULL,
	"actor_id" bigint NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"kind" "verified_kind" NOT NULL,
	"real_name" text NOT NULL,
	"category" text NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"decided_by" bigint,
	"decided_at" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verified" "verified_kind";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_role" "staff_role";--> statement-breakpoint
ALTER TABLE "staff_actions" ADD CONSTRAINT "staff_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_actions_target_idx" ON "staff_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "verification_requests_status_idx" ON "verification_requests" USING btree ("status","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "verification_requests_user_idx" ON "verification_requests" USING btree ("user_id");