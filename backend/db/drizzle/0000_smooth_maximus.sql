CREATE TYPE "public"."channel_type" AS ENUM('text', 'board', 'announcement', 'category', 'voice', 'dm', 'group_dm');--> statement-breakpoint
CREATE TYPE "public"."community_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."encryption" AS ENUM('none', 'mls');--> statement-breakpoint
CREATE TYPE "public"."join_policy" AS ENUM('open', 'request', 'invite');--> statement-breakpoint
CREATE TYPE "public"."overwrite_target" AS ENUM('role', 'member');--> statement-breakpoint
CREATE TYPE "public"."post_kind" AS ENUM('text', 'image', 'video', 'link', 'clip');--> statement-breakpoint
CREATE TYPE "public"."post_visibility" AS ENUM('public', 'followers', 'community');--> statement-breakpoint
CREATE TYPE "public"."vote_target" AS ENUM('post', 'comment');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'audio', 'file');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('default', 'reply', 'system_join', 'system_pin', 'system_channel_rename', 'system_recipient_add', 'system_recipient_remove');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'hate', 'sexual_content', 'sexual_minors', 'violence', 'self_harm', 'impersonation', 'intellectual_property', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('user', 'post', 'comment', 'message', 'community');--> statement-breakpoint
CREATE TYPE "public"."notification_level" AS ENUM('all', 'mentions', 'none');--> statement-breakpoint
CREATE TYPE "public"."notification_scope" AS ENUM('global', 'community', 'channel');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('mention', 'reply', 'post_comment', 'comment_reply', 'vote_milestone', 'follow', 'follow_request', 'friend_request', 'friend_accept', 'community_invite', 'moderation');--> statement-breakpoint
CREATE TYPE "public"."release_channel" AS ENUM('stable', 'beta');--> statement-breakpoint
CREATE TYPE "public"."release_platform" AS ENUM('windows', 'macos', 'linux', 'android', 'ios');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('coming_soon', 'available');--> statement-breakpoint
CREATE TYPE "public"."follow_status" AS ENUM('active', 'pending');--> statement-breakpoint
CREATE TYPE "public"."mute_target" AS ENUM('user', 'community', 'channel');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('friend', 'pending_outgoing', 'pending_incoming', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."dm_policy" AS ENUM('everyone', 'friends_and_communities', 'friends', 'nobody');--> statement-breakpoint
CREATE TYPE "public"."friend_request_policy" AS ENUM('everyone', 'friends_of_friends', 'nobody');--> statement-breakpoint
CREATE TYPE "public"."motion_pref" AS ENUM('system', 'on', 'off');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('web', 'ios', 'android', 'windows', 'macos', 'linux');--> statement-breakpoint
CREATE TYPE "public"."profile_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."security_event_type" AS ENUM('register', 'login', 'login_failed', 'logout', 'password_changed', 'password_reset_requested', 'password_reset', 'email_verified', 'email_changed', 'session_revoked');--> statement-breakpoint
CREATE TYPE "public"."theme_pref" AS ENUM('system', 'dark', 'light');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deactivated', 'deleted');--> statement-breakpoint
CREATE TABLE "bans" (
	"community_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"moderator_id" bigint,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bans_community_id_user_id_pk" PRIMARY KEY("community_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "channel_overwrites" (
	"channel_id" bigint NOT NULL,
	"target_type" "overwrite_target" NOT NULL,
	"target_id" bigint NOT NULL,
	"allow" bigint DEFAULT 0 NOT NULL,
	"deny" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "channel_overwrites_channel_id_target_type_target_id_pk" PRIMARY KEY("channel_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "channel_recipients" (
	"channel_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "channel_recipients_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" bigint PRIMARY KEY NOT NULL,
	"type" "channel_type" NOT NULL,
	"community_id" bigint,
	"parent_id" bigint,
	"name" text,
	"topic" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"slowmode_seconds" integer DEFAULT 0 NOT NULL,
	"owner_id" bigint,
	"icon_media_id" bigint,
	"encryption" "encryption" DEFAULT 'none' NOT NULL,
	"last_message_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "communities" (
	"id" bigint PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_media_id" bigint,
	"banner_media_id" bigint,
	"owner_id" bigint NOT NULL,
	"visibility" "community_visibility" DEFAULT 'private' NOT NULL,
	"join_policy" "join_policy" DEFAULT 'invite' NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"features" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"community_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"nickname" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timeout_until" timestamp with time zone,
	"flags" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "community_members_community_id_user_id_pk" PRIMARY KEY("community_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"code" text PRIMARY KEY NOT NULL,
	"community_id" bigint NOT NULL,
	"channel_id" bigint,
	"inviter_id" bigint,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_roles" (
	"community_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"role_id" bigint NOT NULL,
	CONSTRAINT "member_roles_community_id_user_id_role_id_pk" PRIMARY KEY("community_id","user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" bigint PRIMARY KEY NOT NULL,
	"community_id" bigint NOT NULL,
	"name" text NOT NULL,
	"color" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"permissions" bigint DEFAULT 0 NOT NULL,
	"hoist" boolean DEFAULT false NOT NULL,
	"mentionable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" bigint PRIMARY KEY NOT NULL,
	"post_id" bigint NOT NULL,
	"author_id" bigint NOT NULL,
	"parent_id" bigint,
	"path" text NOT NULL,
	"depth" smallint DEFAULT 0 NOT NULL,
	"body" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" bigint
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"post_id" bigint NOT NULL,
	"position" smallint NOT NULL,
	"media_id" bigint NOT NULL,
	"alt_text" text,
	CONSTRAINT "post_media_post_id_position_pk" PRIMARY KEY("post_id","position")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" bigint PRIMARY KEY NOT NULL,
	"author_id" bigint NOT NULL,
	"community_id" bigint,
	"channel_id" bigint,
	"kind" "post_kind" NOT NULL,
	"title" text,
	"body" text,
	"link_url" text,
	"visibility" "post_visibility" DEFAULT 'public' NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"is_spoiler" boolean DEFAULT false NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"save_count" integer DEFAULT 0 NOT NULL,
	"share_count" integer DEFAULT 0 NOT NULL,
	"hot_rank" double precision DEFAULT 0 NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED,
	"locked_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" bigint,
	"removal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "saves" (
	"user_id" bigint NOT NULL,
	"post_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saves_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"user_id" bigint NOT NULL,
	"target_type" "vote_target" NOT NULL,
	"target_id" bigint NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" bigint PRIMARY KEY NOT NULL,
	"owner_id" bigint NOT NULL,
	"kind" "media_kind" NOT NULL,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"blurhash" text,
	"variants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sha256" text,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"message_id" bigint NOT NULL,
	"position" smallint NOT NULL,
	"media_id" bigint NOT NULL,
	CONSTRAINT "message_attachments_message_id_position_pk" PRIMARY KEY("message_id","position")
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"message_id" bigint NOT NULL,
	"emoji" text NOT NULL,
	"user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reactions_message_id_emoji_user_id_pk" PRIMARY KEY("message_id","emoji","user_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"author_id" bigint NOT NULL,
	"type" "message_type" DEFAULT 'default' NOT NULL,
	"content" text,
	"ciphertext" "bytea",
	"reply_to_id" bigint,
	"mentions" bigint[] DEFAULT '{}' NOT NULL,
	"mention_roles" bigint[] DEFAULT '{}' NOT NULL,
	"mention_everyone" boolean DEFAULT false NOT NULL,
	"nonce" text,
	"flags" integer DEFAULT 0 NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"pinned_at" timestamp with time zone,
	"pinned_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "read_states" (
	"user_id" bigint NOT NULL,
	"channel_id" bigint NOT NULL,
	"last_read_message_id" bigint,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "read_states_user_id_channel_id_pk" PRIMARY KEY("user_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY NOT NULL,
	"community_id" bigint NOT NULL,
	"actor_id" bigint NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" bigint,
	"changes" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" bigint PRIMARY KEY NOT NULL,
	"reporter_id" bigint NOT NULL,
	"target_type" "report_target" NOT NULL,
	"target_id" bigint NOT NULL,
	"community_id" bigint,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"handled_by" bigint,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"user_id" bigint NOT NULL,
	"scope_type" "notification_scope" NOT NULL,
	"scope_id" bigint DEFAULT 0 NOT NULL,
	"level" "notification_level" DEFAULT 'all' NOT NULL,
	"muted_until" timestamp with time zone,
	"toggles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "notification_prefs_user_id_scope_type_scope_id_pk" PRIMARY KEY("user_id","scope_type","scope_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"type" "notification_type" NOT NULL,
	"actor_id" bigint,
	"subject_type" text NOT NULL,
	"subject_id" bigint NOT NULL,
	"group_key" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"platform" "release_platform" NOT NULL,
	"channel" "release_channel" DEFAULT 'stable' NOT NULL,
	"status" "release_status" DEFAULT 'coming_soon' NOT NULL,
	"version" text,
	"url" text,
	"sha256" text,
	"size_bytes" bigint,
	"min_os" text,
	"published_at" timestamp with time zone,
	CONSTRAINT "releases_platform_channel_pk" PRIMARY KEY("platform","channel")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" bigint NOT NULL,
	"followee_id" bigint NOT NULL,
	"status" "follow_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id")
);
--> statement-breakpoint
CREATE TABLE "mutes" (
	"user_id" bigint NOT NULL,
	"target_type" "mute_target" NOT NULL,
	"target_id" bigint NOT NULL,
	"until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mutes_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"user_id" bigint NOT NULL,
	"target_id" bigint NOT NULL,
	"type" "relationship_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationships_user_id_target_id_pk" PRIMARY KEY("user_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"type" "security_event_type" NOT NULL,
	"session_id" bigint,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" bigint NOT NULL,
	"platform" "platform" NOT NULL,
	"device_name" text NOT NULL,
	"ip_created" "inet",
	"country" text,
	"user_agent" text,
	"device_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"theme" "theme_pref" DEFAULT 'system' NOT NULL,
	"reduced_motion" "motion_pref" DEFAULT 'system' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"profile_visibility" "profile_visibility" DEFAULT 'public' NOT NULL,
	"dm_policy" "dm_policy" DEFAULT 'friends_and_communities' NOT NULL,
	"friend_request_policy" "friend_request_policy" DEFAULT 'everyone' NOT NULL,
	"show_presence" boolean DEFAULT true NOT NULL,
	"show_read_receipts" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text NOT NULL,
	"birth_date" date NOT NULL,
	"avatar_media_id" bigint,
	"banner_media_id" bigint,
	"bio" text,
	"pronouns" text,
	"accent_color" integer,
	"flags" bigint DEFAULT 0 NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_overwrites" ADD CONSTRAINT "channel_overwrites_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_recipients" ADD CONSTRAINT "channel_recipients_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_recipients" ADD CONSTRAINT "channel_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saves" ADD CONSTRAINT "saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saves" ADD CONSTRAINT "saves_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_states" ADD CONSTRAINT "read_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_states" ADD CONSTRAINT "read_states_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutes" ADD CONSTRAINT "mutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_recipients_user_idx" ON "channel_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "channels_community_idx" ON "channels" USING btree ("community_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "communities_slug_key" ON "communities" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "communities_discover_idx" ON "communities" USING btree ("member_count" DESC NULLS LAST) WHERE "communities"."visibility" = 'public' and "communities"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "community_members_user_idx" ON "community_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invites_community_idx" ON "invites" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "member_roles_role_idx" ON "member_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "roles_community_idx" ON "roles" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "comments_thread_idx" ON "comments" USING btree ("post_id","path");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_community_hot_idx" ON "posts" USING btree ("community_id","hot_rank" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_community_new_idx" ON "posts" USING btree ("community_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_search_idx" ON "posts" USING gin ("search");--> statement-breakpoint
CREATE INDEX "saves_user_idx" ON "saves" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "media_owner_idx" ON "media" USING btree ("owner_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_channel_idx" ON "messages" USING btree ("channel_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_author_idx" ON "messages" USING btree ("author_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_community_idx" ON "audit_log" USING btree ("community_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_community_idx" ON "reports" USING btree ("community_id","status","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "relationships_target_idx" ON "relationships" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "email_verifications_user_idx" ON "email_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_verifications_token_key" ON "email_verifications" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_resets_user_idx" ON "password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_events_user_idx" ON "security_events" USING btree ("user_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));