# Realm's outside services

Realm runs on a handful of free-tier services (owner's plan, 2026-10-04). Every one is optional
while developing: with its keys unset, Realm uses a local stand-in, so the app runs with nothing
installed. Set the keys in `.env` (copy `.env.example`) to switch each one on.

| What | Service | Free tier (check current limits) | Local stand-in |
|---|---|---|---|
| Database | Neon or Supabase (Postgres) | small project | embedded PGlite (`pglite:.data/pglite`) |
| Online, typing, rate limits, jobs | Upstash (Redis) | daily command allowance | in memory, one process |
| Photos, videos, voice messages, files | Cloudflare R2 | 10 GB stored, no egress fees | a folder (`.data/media`) |
| Live chat | Realm's own WebSocket gateway | (part of Realm) | served by the API at `/gateway` |
| Voice, video, screen sharing | LiveKit (Cloud, or your own server) | Cloud: monthly participant minutes; self-hosted: free | LiveKit for Windows in dev mode (`realm-voice`), or off |
| Maps and place search | Google Maps (preferred) or Mapbox | Google: monthly free usage per API | places and the map picker hidden |
| Email | Resend | daily/monthly sends | written to the API's log |
| Push notifications | Firebase Cloud Messaging | free | off |

The API logs which ones are on when it starts (`providers {...}`).

The browser-side keys (`NEXT_PUBLIC_*` and `REALM_STORAGE_ORIGIN`) are read by the web app when
it's built. Put them in `frontend/web/.env.local` (git-ignored) and rebuild the web app.

Nobody at Realm can create these accounts for you: each needs your own sign-up and keys.

## Postgres: Neon (or Supabase)

1. Create a project and a database named `realm`.
2. Copy two connection strings, each ending in `?sslmode=require`:
   - the **pooled** one (Neon's host has `-pooler`; Supabase's is port 6543) as `DATABASE_URL`;
   - the **direct** one as `DATABASE_DIRECT_URL`.
3. Run `pnpm db:migrate`. It uses the direct URL.

Behind a pooler Realm turns prepared statements off by itself (`backend/db/src/client.ts`).

## Redis: Upstash

1. Create a Redis database in the region nearest your API.
2. Copy its `rediss://` URL as `REDIS_URL`.

With Redis set, run three processes: the API (`node dist/server.js`), the gateway
(`dist/gateway-main.js`, port `REALM_GATEWAY_PORT`) and the worker (`dist/worker-main.js`). The
gateway currently keeps voice-room presence in its own memory, so run one gateway node.

## Uploads: Cloudflare R2

1. Create a bucket (e.g. `realm-media`). Keep it **private**: Realm hands out short-lived links
   after checking who may see each file.
2. Create an R2 API token with Object Read & Write on that bucket. Set `S3_ACCESS_KEY_ID` and
   `S3_SECRET_ACCESS_KEY`.
3. Set `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto` and
   `S3_BUCKET`.
4. Add a CORS rule to the bucket so browsers can upload and read:
   ```json
   [{ "AllowedOrigins": ["https://your-realm-domain"], "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
5. For the web app's security policy, set `REALM_STORAGE_ORIGIN` to the same endpoint, then
   rebuild the web app.
6. A bucket made in the **EU jurisdiction** answers only at
   `https://<account-id>.eu.r2.cloudflarestorage.com`; the plain address says Access Denied.
7. `REALM_STORAGE_LIMIT_GB` (10 by default, R2's free amount) pauses uploads before storage could
   cost money, and emails `REALM_ALERT_EMAIL` at 90%, 93% and 97% of it and when it's full.

## Voice and video: LiveKit

**On this PC (development):** LiveKit for Windows runs as the `realm-voice` dev server (from
`.tools/livekit/`, downloaded from LiveKit's GitHub releases and checked against their
checksums). `.env` points at it with LiveKit's public dev-mode values (`devkey` / `secret`),
which only work on this machine. No Docker needed.

**Your own server (production):** see `docs/SELF-HOSTING.md`.

**Or LiveKit Cloud:**

1. Create a project.
2. Copy its WebSocket URL as `LIVEKIT_URL` (`wss://<project>.livekit.cloud`).
3. Create an API key and secret: `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.

Realm hands each person a 10-minute pass to one room. What they may publish follows their
permissions in the Space. Calls are not end-to-end encrypted (LiveKit supports it; Realm hasn't
switched it on).

## Maps: Google Maps (preferred)

1. In Google Cloud, create a project and turn on billing (Google gives monthly free usage per
   API; check the current amounts).
2. Enable four APIs: **Maps JavaScript API**, **Places API (New)**, **Geocoding API** and
   **Maps Static API**.
3. Create an API key. Restrict it by **websites** (your Realm domains, and
   `http://localhost:3000/*` for development) and to just those four APIs.
4. Optional, for Realm's own map look: in Map Management, create a **Map ID** (JavaScript,
   vector) with a dark style, and set it as `NEXT_PUBLIC_GOOGLE_MAP_ID`. Without one, Realm uses
   Google's dark scheme.
5. Set the key as `NEXT_PUBLIC_GOOGLE_MAPS_KEY` in `frontend/web/.env.local` and rebuild.

Worth knowing: Google's terms limit how long Places results may be kept, and require Google's
logo on its maps (shown automatically). Realm stores what someone chose to share in their message
(a name, an address and a rounded point); check Google's current Places terms before launch.

## Maps: Mapbox (alternative)

Used only when no Google key is set.

1. Create a **public** access token (`pk.`) with the default public scopes.
2. Under URL restrictions, add your Realm domains (and `http://localhost:3000` for development).
3. Set it as `NEXT_PUBLIC_MAPBOX_TOKEN` and rebuild the web app.

## Email: Resend

1. Add and verify your sending domain.
2. Create an API key: `RESEND_API_KEY`.
3. Set `SMTP_FROM` to an address on that domain, e.g. `Realm <no-reply@your-domain>`.
4. Optional: set `REALM_SAFETY_EMAIL` to an inbox you read. The gravest reports are emailed
   there as well as logged (see Moderation below).

## Push: Firebase Cloud Messaging

1. Create a Firebase project and add a **Web app**. Copy its config into the
   `NEXT_PUBLIC_FIREBASE_*` variables.
2. Under Project settings → Cloud Messaging → Web Push certificates, generate a key pair. Its
   public key is `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
3. Under Project settings → Service accounts, generate a private key (a JSON file). Put its
   contents (or their base64) in `FIREBASE_SERVICE_ACCOUNT` on the server. Never commit it.

Realm sends data-only messages. Its own service worker (`public/sw.js`) shows them, one per room
at a time. A message notifies members of Spaces of up to 50 people when they're away, unless
they muted it or blocked its author, at most once per room every two minutes.

## Moderation (no service connected)

Built to need no one at Realm reading messages (owner, 2026-10-04):
- **Automatic spam limits** (`backend/api/src/lib/spam.ts`): bursts, repeated text, and links from
  accounts under a day old or unverified.
- **Reports** go to each Space's moderators. A message hides itself after 2 reports (Spaces of 10
  or fewer) or 3 (bigger), until a moderator decides.
- **Spaces drop out of Explore** after 5 people report them.
- **Only the gravest reports reach Realm:** sexual content involving a minor. These hide the
  message at once, are logged at warn level, and are emailed to `REALM_SAFETY_EMAIL` if it's set.
- **A pluggable scanner** (`backend/api/src/lib/scanner.ts`) can be connected later for public
  Spaces only. A "hold" hides the message for that Space's moderators; it never queues work for
  Realm.
