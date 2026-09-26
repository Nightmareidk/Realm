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
| Versioning | Additive changes only within `/v1`. `X-Realm-Client: <platform>/<version>` required from native clients. |
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
| GET | `/users/@me/communities` | joined communities (also in READY) |
| — | `/users/@me/export`, `DELETE /users/@me` | P2 (GDPR) |

### Communities — P1
| Method | Path | Notes |
|---|---|---|
| POST | `/communities` | creates community, `@everyone` role, default `#general` + board |
| GET / PATCH / DELETE | `/communities/:idOrSlug` | preview for non-members if public |
| POST | `/communities/:id/join` | open communities; `request` policy → P2 |
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
| POST | `/channels/:id/invites` · GET `/invites/:code` · POST `/invites/:code` | create / preview / accept |
| GET | `/channels/:id/messages?before=\|after=\|around=&limit=` | |
| POST | `/channels/:id/messages` | `{ content, replyToId?, attachmentIds?, nonce }` |
| PATCH / DELETE | `/channels/:id/messages/:messageId` | edit (author) / delete (author or `MANAGE_MESSAGES`) |
| PUT / DELETE | `/channels/:id/messages/:messageId/reactions/:emoji/@me` | |
| GET | `/channels/:id/pins` · PUT / DELETE `/channels/:id/pins/:messageId` | |
| POST | `/channels/:id/ack` | `{ messageId }` → read state (+ read receipt in DMs) |
| GET | `/channels/:id/messages/search?q=` | non-E2EE channels only (P2) |
| GET | `/users/@me/channels` | DM + group DM list |
| POST | `/users/@me/channels` | `{ recipientIds }` → open/reuse DM or create group DM (respects `dm_policy`, blocks) |
| PUT / DELETE | `/channels/:id/recipients/:userId` | group DM add/remove |

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

### Media — P1
| Method | Path | Notes |
|---|---|---|
| POST | `/media/uploads` | `{ kind, mimeType, sizeBytes, sha256 }` → `{ mediaId, uploadUrl, headers, expiresAt }` |
| POST | `/media/:id/complete` | server verifies object, queues processing |
| GET | `/media/:id` | status + variant URLs |

### Discovery & search — P1 basic, P2/P3 richer
| Method | Path | Notes |
|---|---|---|
| GET | `/search?q=&type=users\|communities\|posts&cursor=` | Postgres FTS/trigram |
| GET | `/discover/communities?category=` | curated + popular public communities |
| GET | `/discover/trending` | P2 (topics) |
| GET | `/discover/creators` | P3 |

### Notifications — P1
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?before=` | |
| POST | `/notifications/read` | `{ ids }` or `{ before }` |
| GET / PATCH | `/users/@me/notification-prefs` | global + per-community/channel |
| POST / DELETE | `/push-subscriptions` | P2 |

### Moderation & safety — P1
| Method | Path | Notes |
|---|---|---|
| POST | `/reports` | `{ targetType, targetId, reason, details }` — snapshot stored as evidence |
| GET | `/communities/:id/reports?status=` | community mod queue |
| PATCH | `/reports/:id` | resolve (action/dismiss) |

### Releases — P1
| GET | `/releases` | per-platform status for the download portal |

### E2EE — P2
`/e2ee/devices`, `/e2ee/devices/:id/signatures`, `/e2ee/key-packages` (publish/claim), `/e2ee/groups/:channelId/commits`, `/e2ee/groups/:channelId/messages`, `/e2ee/backup`.

---

## Realtime gateway

Endpoint: `wss://gateway.<domain>/?v=1&encoding=json`
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
