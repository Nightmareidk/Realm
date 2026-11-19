CREATE TYPE "public"."e2ee_message_kind" AS ENUM('welcome', 'commit', 'application');--> statement-breakpoint
CREATE TABLE "e2ee_deliveries" (
	"message_id" bigint NOT NULL,
	"device_id" bigint NOT NULL,
	CONSTRAINT "e2ee_deliveries_device_id_message_id_pk" PRIMARY KEY("device_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "e2ee_group_devices" (
	"channel_id" bigint NOT NULL,
	"device_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"added_epoch" integer NOT NULL,
	"removed_epoch" integer,
	CONSTRAINT "e2ee_group_devices_channel_id_device_id_pk" PRIMARY KEY("channel_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "e2ee_groups" (
	"channel_id" bigint PRIMARY KEY NOT NULL,
	"epoch" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "e2ee_messages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"epoch" integer NOT NULL,
	"kind" "e2ee_message_kind" NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"franking_commitment" "bytea",
	"server_signature" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "e2ee_deliveries" ADD CONSTRAINT "e2ee_deliveries_message_id_e2ee_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."e2ee_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e2ee_deliveries" ADD CONSTRAINT "e2ee_deliveries_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e2ee_group_devices" ADD CONSTRAINT "e2ee_group_devices_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e2ee_group_devices" ADD CONSTRAINT "e2ee_group_devices_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e2ee_group_devices" ADD CONSTRAINT "e2ee_group_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e2ee_groups" ADD CONSTRAINT "e2ee_groups_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e2ee_messages" ADD CONSTRAINT "e2ee_messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "e2ee_group_devices_device_idx" ON "e2ee_group_devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "e2ee_messages_channel_idx" ON "e2ee_messages" USING btree ("channel_id","id");