CREATE TYPE "public"."device_status" AS ENUM('pending', 'approved', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."revocation_reason" AS ENUM('device', 'password', 'key_reset');--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'e2ee_device_approved';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'e2ee_device_revoked';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'e2ee_key_reset';--> statement-breakpoint
CREATE TABLE "account_identity_keys" (
	"user_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"public_key" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "account_identity_keys_user_id_version_pk" PRIMARY KEY("user_id","version")
);
--> statement-breakpoint
CREATE TABLE "device_revocations" (
	"device_id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"reason" "revocation_reason" NOT NULL,
	"revoked_at" timestamp with time zone NOT NULL,
	"signature" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"status" "device_status" DEFAULT 'pending' NOT NULL,
	"platform" "platform" NOT NULL,
	"name" text NOT NULL,
	"signature_key" "bytea" NOT NULL,
	"account_key_version" integer,
	"cert_issued_at" timestamp with time zone,
	"cert_signature" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_packages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"device_id" bigint NOT NULL,
	"key_package" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by" bigint
);
--> statement-breakpoint
ALTER TABLE "account_identity_keys" ADD CONSTRAINT "account_identity_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_revocations" ADD CONSTRAINT "device_revocations_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_revocations" ADD CONSTRAINT "device_revocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_packages" ADD CONSTRAINT "key_packages_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_signature_key_key" ON "devices" USING btree ("signature_key");--> statement-breakpoint
CREATE INDEX "key_packages_device_idx" ON "key_packages" USING btree ("device_id","claimed_at","id");