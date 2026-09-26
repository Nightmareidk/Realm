# Realm — Data Model

> PostgreSQL 17 · Drizzle ORM · all IDs are Snowflake `bigint` (strings in JSON) unless noted.
> Conventions: `snake_case` columns · `created_at`/`updated_at` timestamptz · soft delete via `deleted_at` where users expect "undo" or where legal retention applies; hard purge jobs follow · every FK indexed · no `ON DELETE CASCADE` on user-generated content (deletion is a workflow, not a side effect).
>
> Legend: **P1** = built in Phase 1 · P2/P3 = later phases (shape reserved now).

---

## Identity & auth

### `users` — P1
| column | type | notes |
|---|---|---|
| id | bigint PK | snowflake |
| username | text, unique on `lower()` | stored lowercase; 3–32, `[a-z0-9_.]`, no leading/trailing dot; reserved-word list |
| display_name | text | 1–48, free text (Unicode, sanitized) |
| email | text, unique on `lower()` | stored lowercase; never exposed to other users |
| email_verified_at | timestamptz null | |
| password_hash | text | Argon2id (PHC string) |
| birth_date | date | age gate; never exposed |
| avatar_media_id, banner_media_id | bigint null → media | |
| bio | text null | ≤ 300 |
| pronouns | text null | ≤ 40 |
| accent_color | int null | profile accent |
| flags | bigint default 0 | staff, verified, early-supporter… (bitfield) |
| status | enum `active` \| `suspended` \| `deactivated` \| `deleted` | |
| created_at, updated_at, deleted_at | timestamptz | |

### `user_settings` — P1 (1:1 with users)
`user_id PK` · `theme` (`system`|`dark`|`light`) · `reduced_motion` (`system`|`on`|`off`) · `locale` · `profile_visibility` (`public`|`private`) · `dm_policy` (`everyone`|`friends_and_communities`|`friends`|`nobody`) · `friend_request_policy` (`everyone`|`friends_of_friends`|`nobody`) · `show_presence` bool · `show_read_receipts` bool · `updated_at`

### `sessions` — P1
| column | type | notes |
|---|---|---|
| id | bigint PK | public snowflake — safe in URLs and device lists |
| token_hash | text UNIQUE | `SHA-256(token)` hex — the raw token is never stored |
| user_id | bigint → users | |
| platform | enum `web`\|`ios`\|`android`\|`windows`\|`macos`\|`linux` | |
| device_name | text | "Chrome on Windows" / native-provided |
| ip_created | inet | retained ≤ 90 days, then nulled |
| country | char(2) null | coarse location for the device list |
| user_agent | text null | |
| device_id | bigint null → devices | P2 E2EE device binding |
| created_at, last_active_at, expires_at | timestamptz | sliding expiry |
| revoked_at | timestamptz null | |

### `email_verifications` — P1
`id` · `user_id` · `email` (the address being verified) · `code_hash` · `token_hash` (link variant) · `attempts` · `expires_at` · `consumed_at`

### `password_resets` — P1
`token_hash PK` · `user_id` · `expires_at` · `used_at` · `created_at`

### `security_events` — P1
`id` · `user_id` · `type` (`login`, `login_failed`, `password_changed`, `session_revoked`, `email_changed`, …) · `session_id` null · `ip` · `created_at` — powers "recent security activity" and incident response.

### `push_subscriptions` — P2
`id` · `user_id` · `session_id` · `kind` (`webpush`|`apns`|`fcm`) · `endpoint`/`token` · `keys` jsonb · `created_at`

---

## Social graph

### `relationships` — P1 (friends & blocks; directional rows)
`user_id` · `target_id` · `type` (`friend` | `pending_outgoing` | `pending_incoming` | `blocked`) · `created_at` · PK(`user_id`,`target_id`).
A friendship is two rows (`friend`/`friend`); a request is `pending_outgoing` + `pending_incoming`. Blocking overwrites the blocker's row with `blocked` and removes the reverse friendship.

### `follows` — P1 (content subscriptions; asymmetric)
`follower_id` · `followee_id` · `status` (`active` | `pending` — for private profiles) · `created_at` · PK(`follower_id`,`followee_id`) · index on (`followee_id`, `created_at`).

### `mutes` — P1
`user_id` · `target_type` (`user`|`community`|`channel`) · `target_id` · `until` null · PK(all three).

---

## Communities

### `communities` — P1
| column | type | notes |
|---|---|---|
| id | bigint PK | also the ID of its `@everyone` role |
| slug | text, unique on `lower()` | URL handle, 3–32 |
| name | text | 2–64 |
| description | text null | ≤ 500 |
| icon_media_id, banner_media_id | bigint null | |
| owner_id | bigint → users | |
| visibility | enum `public` \| `private` | public = discoverable + previewable |
| join_policy | enum `open` \| `request` \| `invite` | |
| is_nsfw | bool | |
| member_count | int | denormalized, updated by worker |
| rules | jsonb | ordered list of {title, body} |
| features | bigint | feature flags (bitfield) |
| created_at, updated_at, deleted_at | | |

### `community_members` — P1
`community_id` · `user_id` · `nickname` null · `joined_at` · `timeout_until` null · `flags` · PK(`community_id`,`user_id`) · index (`user_id`).

### `roles` — P1
`id` · `community_id` · `name` · `color` int null · `position` int · `permissions` bigint · `hoist` bool · `mentionable` bool · `created_at`. `@everyone` has `id = community_id`, `position = 0`.

### `member_roles` — P1
`community_id` · `user_id` · `role_id` · PK(all three).

### `channels` — P1 (community channels **and** DMs)
| column | type | notes |
|---|---|---|
| id | bigint PK | |
| type | enum `text`\|`board`\|`announcement`\|`category`\|`voice`(P3)\|`dm`\|`group_dm` | |
| community_id | bigint null | null for DMs |
| parent_id | bigint null → channels | category grouping |
| name | text null | null for 1:1 DMs |
| topic | text null | |
| position | int | |
| is_nsfw | bool | |
| slowmode_seconds | int default 0 | |
| owner_id | bigint null | group DM owner |
| icon_media_id | bigint null | group DM icon |
| encryption | enum `none` \| `mls` | P2 flips DMs to `mls` |
| last_message_id | bigint null | unread computation, DM ordering |
| created_at, updated_at, deleted_at | | |

### `channel_overwrites` — P1
`channel_id` · `target_type` (`role`|`member`) · `target_id` · `allow` bigint · `deny` bigint · PK(`channel_id`,`target_type`,`target_id`).

### `channel_recipients` — P1 (DM / group DM membership)
`channel_id` · `user_id` · `joined_at` · `closed_at` null (hidden from DM list) · PK(`channel_id`,`user_id`).

### `invites` — P1
`code` text PK (8 chars, base62) · `community_id` · `channel_id` · `inviter_id` · `max_uses` null · `uses` · `expires_at` null · `created_at` · `revoked_at`.

### `bans` — P1
`community_id` · `user_id` · `moderator_id` · `reason` · `created_at` · `expires_at` null · PK(`community_id`,`user_id`).

### `join_requests` — P2
For `join_policy = request`: `community_id` · `user_id` · `answers` jsonb · `status` · `created_at`.

---

## Messaging

### `messages` — P1
| column | type | notes |
|---|---|---|
| id | bigint PK | snowflake (time-ordered) |
| channel_id | bigint | index (`channel_id`, `id` DESC) — *the* hot path |
| author_id | bigint | |
| type | enum `default`\|`reply`\|`system_join`\|`system_pin`\|`system_call`… | |
| content | text null | ≤ 4000; null when E2EE |
| ciphertext | bytea null | P2, MLS channels only |
| reply_to_id | bigint null | |
| mentions | bigint[] | user IDs (for notifications / highlight) |
| mention_roles | bigint[] | |
| mention_everyone | bool | |
| nonce | text null | client-generated; dedupes optimistic sends |
| edited_at, deleted_at, pinned_at | timestamptz null | |
| pinned_by | bigint null | |
| flags | int | suppress_embeds, silent… |
| created_at | timestamptz | redundant with snowflake but convenient for SQL |

Deleted messages keep a tombstone row (`deleted_at`, content nulled) so replies and read states stay consistent; a purge job removes content fully.

### `message_attachments` — P1
`message_id` · `media_id` · `position` · PK(`message_id`,`position`).

### `message_reactions` — P1
`message_id` · `emoji` text (Unicode grapheme or `custom:<id>`) · `user_id` · `created_at` · PK(`message_id`,`emoji`,`user_id`).

### `read_states` — P1
`user_id` · `channel_id` · `last_read_message_id` · `mention_count` · `updated_at` · PK(`user_id`,`channel_id`). Powers unread dots, mention badges, and (DMs) read receipts.

---

## Content (posts, comments, votes)

### `posts` — P1
| column | type | notes |
|---|---|---|
| id | bigint PK | |
| author_id | bigint | |
| community_id | bigint null | null = profile post |
| channel_id | bigint null | the `board` channel |
| kind | enum `text`\|`image`\|`video`(P3 full)\|`link`\|`clip`(short vertical video, P3) | |
| title | text null | required on community boards, optional on profiles |
| body | text null | ≤ 40,000, restricted Markdown, sanitized on render |
| link_url | text null | |
| visibility | enum `public`\|`followers`\|`community` | profile posts: public/followers; board posts: community |
| is_nsfw, is_spoiler | bool | |
| score | int | upvotes − downvotes (or likes) — denormalized |
| comment_count, save_count, share_count | int | denormalized |
| hot_rank | double | recomputed on vote (worker) |
| search | tsvector | generated from title+body |
| locked_at | timestamptz null | no new comments |
| removed_at, removed_by, removal_reason | | moderator removal (distinct from author delete) |
| created_at, edited_at, deleted_at | | |

Indexes: (`community_id`, `hot_rank` DESC), (`community_id`, `id` DESC), (`author_id`, `id` DESC), GIN(`search`).

### `post_media` — P1
`post_id` · `media_id` · `position` · `alt_text` · PK(`post_id`,`position`).

### `comments` — P1
`id` · `post_id` · `author_id` · `parent_id` null · `path` text (materialized path of zero-padded IDs, e.g. `000…123/000…456`) · `depth` smallint (UI collapses past 8) · `body` · `score` · `reply_count` · `created_at` · `edited_at` · `deleted_at` · `removed_at`/`removed_by`.
Index (`post_id`, `path`) → a whole thread in one ordered range scan.

### `votes` — P1
`user_id` · `target_type` (`post`|`comment`) · `target_id` · `value` smallint (+1 / −1) · `created_at` · PK(`user_id`,`target_type`,`target_id`).
Profile posts show +1 as "likes"; boards may enable downvotes per community.

### `saves` — P1
`user_id` · `post_id` · `created_at` · PK(`user_id`,`post_id`).

### `topics` / `post_topics` — P2
Hashtag-style topics for discovery and trending.

### `stories` — P4
Ephemeral 24h media; audience = followers/close friends.

---

## Media

### `media` — P1
| column | type | notes |
|---|---|---|
| id | bigint PK | |
| owner_id | bigint | |
| kind | enum `image`\|`video`\|`audio`\|`file` | |
| status | enum `pending`\|`processing`\|`ready`\|`failed`\|`blocked` | `blocked` = failed safety scan |
| storage_key | text | `u/{ownerId}/{mediaId}/original` |
| mime_type | text | verified from magic bytes |
| size_bytes | bigint | |
| width, height, duration_ms | int null | |
| blurhash | text null | placeholder |
| variants | jsonb | `{ "w320": {...}, "w1080": {...} }` |
| sha256 | text | dedupe + safety hash matching |
| is_encrypted | bool | P2: E2EE ciphertext (server can't process) |
| created_at | | |

---

## Notifications

### `notifications` — P1
`id` · `user_id` (recipient) · `type` (`mention`, `reply`, `post_reply`, `comment_reply`, `vote_milestone`, `follow`, `friend_request`, `friend_accept`, `community_invite`, …) · `actor_id` null · `subject_type` · `subject_id` · `group_key` (collapse "12 people liked your post") · `data` jsonb · `read_at` · `created_at` · index (`user_id`, `id` DESC).
DM messages don't create rows here — unread DMs come from `read_states`.

### `notification_prefs` — P1
`user_id` · `scope_type` (`global`|`community`|`channel`) · `scope_id` · `level` (`all`|`mentions`|`none`) · `muted_until` · per-type toggles jsonb · PK(`user_id`,`scope_type`,`scope_id`).

---

## Moderation & safety

### `reports` — P1
`id` · `reporter_id` · `target_type` (`user`|`post`|`comment`|`message`|`community`) · `target_id` · `community_id` null (routes to that community's mods; null = platform T&S) · `reason` (enum: spam, harassment, hate, sexual_minors, violence, self_harm, impersonation, ip, other) · `details` · `evidence` jsonb (snapshot of content at report time; P2: franked E2EE plaintext) · `status` (`open`|`actioned`|`dismissed`) · `handled_by` · `handled_at` · `created_at`.

### `audit_log` — P1
`id` · `community_id` · `actor_id` · `action` (e.g. `channel.create`, `member.ban`, `role.update`, `post.remove`) · `target_type` · `target_id` · `changes` jsonb (before/after) · `reason` · `created_at` · index (`community_id`, `id` DESC). Append-only.

### `platform_actions` — P2
Platform-level T&S actions (suspensions, content blocks, NCMEC report references) with restricted access.

---

## Releases (download portal)

### `releases` — P1 (or static config until native apps exist)
`platform` (`windows`|`macos`|`linux`|`android`|`ios`) · `channel` (`stable`|`beta`) · `status` (`coming_soon`|`available`) · `version` · `url` · `sha256` · `size_bytes` · `min_os` · `published_at`.

---

## E2EE (Phase 2)

| table | purpose |
|---|---|
| `devices` | `id`, `user_id`, `signature_public_key`, `name`, `platform`, `created_at`, `last_seen_at`, `revoked_at` |
| `device_signatures` | user-identity-key signatures over device keys (cross-signing) |
| `user_identity_keys` | current + historical public identity keys (for change warnings; key transparency later) |
| `key_packages` | `id`, `device_id`, `key_package` bytea, `is_last_resort`, `created_at`, `claimed_at` |
| `e2ee_groups` | `channel_id` (1:1 with an `mls` channel), `epoch`, `updated_at` |
| `e2ee_group_devices` | membership of devices in each MLS group |
| `e2ee_messages` | `id`, `channel_id`, `sender_device_id`, `epoch`, `kind` (`application`|`commit`|`welcome`|`proposal`), `ciphertext` bytea, `franking_tag`, `server_signature`, `created_at` |
| `e2ee_backups` | encrypted backup blobs + wrapped-key metadata (never the key) |

---

## Ephemeral state (Redis, not Postgres)

| key pattern | contents | TTL |
|---|---|---|
| `sess:{hash}` | cached session → user | 60 s |
| `presence:{userId}` | status, active platforms, activity | heartbeat-refreshed |
| `typing:{channelId}` | user IDs typing | 8 s |
| `gw:replay:{sessionId}` | recent dispatches for RESUME | 2 min |
| `rl:{bucket}:{key}` | rate-limit counters | per window |
| `snowflake:worker:{n}` | worker-ID lease | 30 s, renewed |
