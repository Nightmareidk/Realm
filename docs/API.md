# Realm — API & Realtime Contract

> Base URL `/v1`. JSON only. Every schema is defined once in `shared/contracts` (Zod) and exported as OpenAPI 3.1 at `/v1/openapi.json`.
> **P1** = Phase 1. Endpoints marked later are listed so the shape is stable.

## Conventions

| Topic | Rule |
|---|---|
| IDs | Snowflake **strings** everywhere. |
| Auth | Cookie `realm_session` (web) or `Authorization: Bearer <token>` (native). |
| CSRF | Mutations require `Content-Type: application/json` and an allow-listed `Origin` (web). |
| Pagination | Cursor-based: `?before=<id>&limit=50` / `?after=<id>`; responses include `nextCursor`. No offsets. |
| Idempotency | Creates accept an `Idempotency-Key` header; messages also carry a client `nonce` echoed back in the event. |
| Errors | `{ "error": { "code": "MISSING_PERMISSION", "message": "…", "details": {…}, "requestId": "…" } }` — `code` values are a closed enum in contracts; clients switch on `code`, never on `message`. |
| Rate limits | `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers; `429` with `retryAfter`. |
| Versioning | Additive changes only within `/v1`. `X-Realm-Client: <platform>/<version>` required from native clients. They may also send `X-Realm-Device: <phone model>` (plain text, 48 characters), which names their session: "Realm app on Google Pixel 7". |
| Partial updates | `PATCH` with only the fields to change; `null` clears a nullable field. |

---

## REST endpoints

### Auth — P1
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `{ email, username, password, displayName, birthDate }` → creates user + session, sends verification code |
| POST | `/auth/login` | `{ login (email or username), password }` → session |
| POST | `/auth/logout` | revokes current session |
| POST | `/auth/email/verify` | `{ code }` or `{ token }` |
| POST | `/auth/email/resend` | rate-limited |
| POST | `/auth/password/forgot` | `{ email }` → always `202` (no account enumeration) |
| POST | `/auth/password/reset` | `{ token, password }` → revokes all sessions |
| POST | `/auth/password/change` | `{ currentPassword, newPassword }` |
| GET | `/auth/sessions` | device/session list (current flagged) |
| DELETE | `/auth/sessions/:id` | revoke one |
| DELETE | `/auth/sessions` | revoke all except current |
| POST | `/gateway/tickets` | 60 s single-use ticket for web WebSocket IDENTIFY |
| — | `/auth/2fa/*`, `/auth/passkeys/*` | P2 |
| — | `/auth/oauth/:provider/*` | P3 |

### Users & relationships — P1
| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/users/@me` | own account (includes email) |
| GET / PATCH | `/users/@me/settings` | privacy, appearance |
| GET | `/users/:username` | public profile (respects privacy + blocks) |
| GET | `/users/:id/posts` · `/users/:id/media` | profile tabs |
| GET | `/users/:id/followers` · `/users/:id/following` | |
| PUT / DELETE | `/users/:id/follow` | follow/unfollow (pending if private) |
| GET | `/users/@me/relationships` | friends, requests, blocks |
| PUT | `/users/@me/relationships/:userId` | `{ type: "friend" }` send/accept request · `{ type: "blocked" }` |
| DELETE | `/users/@me/relationships/:userId` | unfriend / cancel / unblock |
| GET / PUT / DELETE | `/users/@me/mutes/...` | mute users/communities/channels |
| GET | `/users/@me/communities` | joined communities, as `SpaceDetail` (also in READY) |
| GET | `/users/@me/read-states` | your read position per room (also in READY) |
| — | `/users/@me/export`, `DELETE /users/@me` | P2 (GDPR) |

### Communities — P1
| Method | Path | Notes |
|---|---|---|
| POST | `/communities` | `{ name, visibility?, accent?, slug? }` → creates the Space, its `@everyone` and Mods roles and `#general` (the board room waits for posts). *Built 2026-10-04.* |
| GET / PATCH / DELETE | `/communities/:idOrSlug` | preview for non-members if public |
| POST | `/communities/:id/join` | open (public) communities, e.g. from Explore; `request` policy → P2 |
| POST / GET | `/communities/:id/invites` | create `{ maxAgeSeconds: 1800\|3600\|86400\|604800\|0, maxUses: 0\|1\|5\|10\|25 }` / list live ones (all if you manage the Space, else your own) |
| DELETE | `/communities/:id/members/@me` | leave |
| GET | `/communities/:id/members?after=&limit=` | paginated |
| PATCH / DELETE | `/communities/:id/members/:userId` | nickname, roles, timeout / kick |
| PUT / DELETE | `/communities/:id/bans/:userId` | ban / unban |
| GET / POST | `/communities/:id/roles` | |
| PATCH / DELETE | `/communities/:id/roles/:roleId` | |
| PATCH | `/communities/:id/roles` | reorder positions |
| GET / POST | `/communities/:id/channels` | |
| PATCH | `/communities/:id/channels` | reorder / re-parent |
| GET | `/communities/:id/audit-log?before=` | requires `VIEW_AUDIT_LOG` |
| GET | `/communities/:id/posts?sort=hot\|new\|top&t=` | community feed across boards |

### Channels & messages — P1
| Method | Path | Notes |
|---|---|---|
| GET / PATCH / DELETE | `/channels/:id` | |
| PUT / DELETE | `/channels/:id/overwrites/:targetId` | permission overwrites |
| GET / POST / DELETE | `/invites/:code` | preview (no sign-in needed; a private Space shows no rooms) / accept / turn off. Dead invites answer `410` with `INVITE_EXPIRED`, `INVITE_USED_UP` or `INVITE_REVOKED` and a message naming who to ask. Invites are made per Space (above). |
| GET | `/channels/:id/messages?before=\|after=\|around=&limit=` | |
| POST | `/channels/:id/messages` | `{ content, replyToId?, attachmentIds?, nonce }` |
| PATCH / DELETE | `/channels/:id/messages/:messageId` | edit (author) / delete (author or `MANAGE_MESSAGES`) |
| PUT / DELETE | `/channels/:id/messages/:messageId/reactions/:emoji/@me` | any single emoji; at most 20 kinds per message → `MESSAGE_REACTION_ADD/REMOVE` |
| GET | `/channels/:id/pins` · PUT / DELETE `/channels/:id/pins/:messageId` | up to 25 per room; pinning posts a `system_pin` line; needs `PIN_MESSAGES` (everyone has it in DMs) |
| POST | `/channels/:id/ack` | `{ messageId }` → read state (+ read receipt in DMs) |
| GET | `/channels/:id/messages/search?q=` | non-E2EE channels only (P2) |
| GET | `/users/@me/channels` | your open DMs and group chats as `Conversation`s (recipients, last-message preview, your pin, `seen`), pinned first |
| GET | `/users/@me/channels/:id` | one conversation (also a closed one, opened by its link) |
| POST | `/users/@me/channels` | `{ recipientIds, name? }` → reuse the DM with one person, or start a group (up to 25). Follows each person's `dm_policy`; blocks win (`BLOCKED`); under-18s only meet friends and people who share a Space (`DM_NOT_ALLOWED`). A new DM shows up for the other person once something is said |
| PATCH | `/users/@me/channels/:id` | `{ name?, pinned? }`: rename a group (posts `system_channel_rename`), pin it in your own list |
| PUT / DELETE | `/users/@me/channels/:id/recipients/:userId` | add to a group (anyone in it), remove (its starter) or leave (`@me`); for a DM, DELETE `@me` closes it until something new is said |

### Posts, comments, feeds — P1
| Method | Path | Notes |
|---|---|---|
| GET | `/feed?tab=home\|following\|communities&cursor=` | |
| POST | `/posts` | `{ kind, title?, body?, linkUrl?, mediaIds?, communityId?, channelId?, visibility }` |
| GET / PATCH / DELETE | `/posts/:id` | |
| PUT / DELETE | `/posts/:id/vote` | `{ value: 1 \| -1 }` |
| PUT / DELETE | `/posts/:id/save` | |
| POST | `/posts/:id/share` | records a share; returns canonical URL |
| POST | `/posts/:id/remove` | moderator removal with reason (audit logged) |
| GET | `/posts/:id/comments?sort=best\|new&parent=&cursor=` | returns a tree slice (depth-limited, "load more" cursors) |
| POST | `/posts/:id/comments` | `{ body, parentId? }` |
| PATCH / DELETE | `/comments/:id` | |
| PUT / DELETE | `/comments/:id/vote` | |
| GET | `/users/@me/saved` | |

### Media — P1 *(built 2026-10-04)*
| Method | Path | Notes |
|---|---|---|
| POST | `/media/uploads` | `{ kind: image\|video\|audio\|file, mimeType, sizeBytes, filename?, durationMs? }` → `{ mediaId, uploadUrl, headers, expiresAt }`. Type and exact size are signed into the upload URL. Limits: images 10 MB, video 100 MB, audio 15 MB (voice ≤ 5 min), files 25 MB; 500 MB a day per person. |
| POST | `/media/:id/complete` | checks the real type from the first bytes (programs refused), reads image size, makes it usable |
| GET | `/media/:id` | the upload's info (its owner, or anyone who can see it) |
| GET | `/media/:id/raw` | `302` to a short-lived storage link, after an access check: owner; anyone for profile pictures; for a message's file, people who can read that room (moderators only while it's hidden). Files always download. |
| PUT / GET | `/media/local/*` | development only: the local folder standing in for R2 (HMAC-signed links) |

Messages take `attachmentIds` (your own ready uploads, once each) and `place: { name, address, lat, lng }` (shared once; under-18s only in Spaces ≤ 200). They come back with `attachments`, `place` and `hidden`.

### Discovery & search — P1 basic, P2/P3 richer
| Method | Path | Notes |
|---|---|---|
| GET | `/search?q=&type=users\|communities\|posts&cursor=` | Postgres FTS/trigram |
| GET | `/discover/communities?sort=active\|new\|members&limit=` | public Spaces with live `hereNow`; adult-marked ones are hidden from under-18s |
| POST | `/discover/nearby` `{lat,lng,limit?}` | public Spaces within 150 km, closest first, with `distanceKm`; adults only. The point goes in the body (never a URL or log) and is rounded to 2 decimals |
| GET | `/discover/capabilities` | `{voice, push}`: which optional services this Realm has, so clients never offer one that can't work |
| GET | `/discover/trending` | P2 (topics) |
| GET | `/discover/creators` | P3 |

### Notifications — P1
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?before=` | |
| POST | `/notifications/read` | `{ ids }` or `{ before }` |
| GET / PATCH | `/users/@me/notification-prefs` | global + per-community/channel |
| POST / DELETE | `/push-subscriptions` | P2 |

### Moderation & safety — P1 *(built 2026-10-04)*
| Method | Path | Notes |
|---|---|---|
| POST | `/reports` | `{ targetType: message\|user\|community\|post\|comment, targetId, reason, details?, communityId? }` → `{ hidden, goesTo: space\|realm\|noted }`. One report per person per thing, and only for what you can see. A message, or a post or comment shared to a Space, hides itself after 2 reports (Spaces ≤ 10) or 3 and goes to that Space's moderators. A profile post or comment hides itself after 3 reports from established accounts (email confirmed, a day old); its author still sees it, marked `hidden`. `sexual_minors` hides at once and goes to Realm. A public Space leaves Explore after 5. |
| GET | `/communities/:id/reports` | the Space's queue, folded per item; reporters never shown |
| POST | `/communities/:id/reports/:targetId` | `{ action: dismiss\|remove }` (logged) |
| PATCH | `/communities/:id/members/:userId` | `{ roleIds?, timeoutUntil?, reason? }`; only on people below you |
| DELETE | `/communities/:id/members/:userId` | remove (kick) |
| GET · PUT · DELETE | `/communities/:id/bans/:userId` | ban `{ reason?, deleteMessagesHours: 0\|1\|24\|168 }` / lift |
| GET | `/communities/:id/audit-log` | activity log |
| GET | `/users/@me/safety` | blocked people and mutes |
| PUT · DELETE | `/users/@me/blocks/:userId` · `/users/@me/mutes/:type/:id` | block, mute (user, community, channel) |
| PUT · DELETE | `/users/@me/push-tokens` | this device's FCM token |
| POST | `/channels/:id/voice` | a LiveKit pass `{ url, token, canSpeak, canVideo, expiresAt }` for a voice room; `503 SERVICE_UNAVAILABLE` when LiveKit isn't set up |

Automatic spam limits on every message answer `429 SLOW_DOWN` with a plain reason.

### Releases — P1
| GET | `/releases` | per-platform status for the download portal |

### E2EE — P2
`/e2ee/devices`, `/e2ee/devices/:id/signatures`, `/e2ee/key-packages` (publish/claim), `/e2ee/groups/:channelId/commits`, `/e2ee/groups/:channelId/messages`, `/e2ee/backup`.

---

## Realtime gateway

Endpoint: `wss://gateway.<domain>/?v=1&encoding=json`

The upgrade must come from Realm's web origin, or carry no `Origin`, or (the phone app: Android's WebSocket adds one on its own) the gateway's own address. Native clients IDENTIFY with their session token; browsers with a ticket.
Frame: `{ "op": number, "d": any, "s"?: number, "t"?: string }`

### Opcodes
| op | Name | Dir | Purpose |
|---|---|---|---|
| 0 | DISPATCH | S→C | An event (`t` = type, `s` = sequence) |
| 1 | HEARTBEAT | both | Keepalive; payload = last seq |
| 2 | IDENTIFY | C→S | `{ token \| ticket, client: { platform, version }, capabilities }` |
| 3 | PRESENCE_UPDATE | C→S | `{ status: online\|idle\|dnd\|invisible, activity? }` |
| 4 | SUBSCRIBE | C→S | `{ communityId, channels?, memberRanges?, typing: bool }` lazy subscriptions |
| 5 | UNSUBSCRIBE | C→S | |
| 6 | RESUME | C→S | `{ sessionId, seq }` |
| 7 | RECONNECT | S→C | Server asks client to reconnect (deploys, rebalancing) |
| 8 | TYPING | C→S | `{ channelId }` (throttled client-side to 1 / 8 s) |
| 9 | INVALID_SESSION | S→C | `{ resumable: bool }` |
| 10 | HELLO | S→C | `{ heartbeatInterval }` |
| 11 | HEARTBEAT_ACK | S→C | |

### Dispatch events (`t`)
| Event | P | Payload / notes |
|---|---|---|
| `READY` | 1 | `{ sessionId, user, settings, relationships, communities[] (with channels, roles, self member), dmChannels[], readStates[], presences[] }` |
| `RESUMED` | 1 | |
| `USER_UPDATE` · `USER_SETTINGS_UPDATE` | 1 | own account, synced across devices |
| `RELATIONSHIP_ADD` · `RELATIONSHIP_REMOVE` | 1 | |
| `PRESENCE_UPDATE` | 1 | friends + subscribed communities |
| `COMMUNITY_CREATE` · `COMMUNITY_UPDATE` · `COMMUNITY_DELETE` | 1 | CREATE also fires when you join; DELETE when you leave/are removed |
| `COMMUNITY_MEMBER_ADD` · `_UPDATE` · `_REMOVE` | 1 | |
| `COMMUNITY_ROLE_CREATE` · `_UPDATE` · `_DELETE` | 1 | |
| `COMMUNITY_BAN_ADD` · `_REMOVE` | 1 | moderators only |
| `CHANNEL_CREATE` · `CHANNEL_UPDATE` · `CHANNEL_DELETE` | 1 | incl. DMs |
| `CHANNEL_PINS_UPDATE` | 1 | |
| `MESSAGE_CREATE` · `MESSAGE_UPDATE` · `MESSAGE_DELETE` | 1 | CREATE echoes `nonce` for optimistic reconciliation |
| `MESSAGE_REACTION_ADD` · `_REMOVE` | 1 | |
| `TYPING_START` | 1 | `{ channelId, userId, at }` |
| `READ_STATE_UPDATE` | 1 | your read position synced across your devices |
| `MESSAGE_ACK` | 1 | DM read receipts (respects `show_read_receipts`) |
| `NOTIFICATION_CREATE` | 1 | |
| `POST_CREATE` | 1 | only to clients subscribed to that community board ("new posts" pill) |
| `POST_UPDATE` · `POST_DELETE` | 1 | |
| `COMMENT_CREATE` | 1 | only while viewing the post |
| `E2EE_WELCOME` · `E2EE_COMMIT` · `E2EE_MESSAGE` · `E2EE_KEY_PACKAGES_LOW` · `DEVICE_ADD` · `DEVICE_REMOVE` | 2 | |
| `VOICE_STATE_UPDATE` · `VOICE_SERVER_UPDATE` · `CALL_CREATE` · `CALL_UPDATE` · `CALL_DELETE` | 3 | |

### Delivery rules
- An event reaches a session only if that user can currently `VIEW_CHANNEL` (community) or is a recipient (DM). The gateway re-checks on role/overwrite changes.
- Blocked users' messages still arrive (the client collapses them); blocks affect DMs, mentions and notifications server-side.
- At-least-once: clients dedupe on IDs; on resume gaps the client refetches the affected channel ranges.
