# Self-hosting Realm

The owner's direction (2026-10-10): run Realm's services yourself wherever that's sensible, and
keep paying only for what can't be self-hosted well. This guide starts with voice and video; the
rest of the stack is added when you're ready to put Realm online.

| Part | Self-host? | With |
|---|---|---|
| Voice and video | **Yes** (ready below) | LiveKit, `infra/selfhost/livekit/` |
| Database | Yes (later) | PostgreSQL with automatic backups |
| Online, typing, rate limits, jobs | Yes (later) | Valkey (Redis-compatible) |
| Search | Yes (later) | Postgres first, Meilisearch when it outgrows it |
| Files | Possible (later) | MinIO or Garage. Cloudflare R2 has no download fees and may stay the better deal |
| Realm itself | Yes (later) | the web app, API, realtime gateway and worker, behind Caddy |
| Push notifications | No | Apple (APNs) and Google (FCM) require their own services; both free |
| Maps | No | Google Maps is a Google service |
| Sending email | Not worth it | self-sent email mostly lands in spam; Resend or Amazon SES |

What stays with you: renting the server, buying the domain, and every password and key. Once
the server accepts an SSH key from your PC, the setup itself can be done from here.

## Voice and video on your own server

LiveKit is open source. Realm only needs its address, an API key and a secret, so moving from
LiveKit Cloud (or the dev server on your PC) to your own is a settings change.

### 1. A server

- **Linux** (Ubuntu 24.04 is a safe pick) with a **public IP address**.
- Calls are mostly **bandwidth**, not processing: 2–4 CPU cores and 4 GB of memory carry a lot of
  voice. Pick a host with plenty of included traffic (Hetzner is popular for this).
- Not your home PC: home upload speeds and routers make calls unreliable for everyone else.

Install Docker on it (Docker's own install guide for Ubuntu).

### 2. A name

In your domain's DNS, point a name at the server's IP, e.g. `voice.yourdomain.com` (an A
record). Caddy uses it to get a certificate.

### 3. Open these ports (server firewall, and the host's if it has one)

| Port | For |
|---|---|
| TCP 80, 443 | HTTPS (Caddy) and the certificate check |
| TCP 7881 | media fallback for strict networks |
| UDP 3478 | the relay (TURN) for people behind firewalls |
| UDP 50000–60000 | the calls themselves |

### 4. Start it

Copy `infra/selfhost/livekit/` to the server, then in that folder:

```bash
cp .env.example .env
```

Edit `.env`: set `VOICE_DOMAIN`, and make a key and secret with the command in the file. Then:

```bash
docker compose up -d
```

Caddy fetches the certificate on its own. `docker compose logs -f livekit` shows it starting.

### 5. Point Realm at it

In Realm's `.env` (on the API's server):

```
LIVEKIT_URL=wss://voice.yourdomain.com
LIVEKIT_API_KEY=<the key from LIVEKIT_KEYS>
LIVEKIT_API_SECRET=<its secret>
```

In `frontend/web/.env.local`, so the browser may connect to it: `NEXT_PUBLIC_LIVEKIT_HOST=voice.yourdomain.com`.
Rebuild the web app, restart the API, and join a voice room.

### 6. Later

- **More people:** run several LiveKit servers sharing one Redis (the `redis:` lines in
  `livekit.yaml`); rooms spread across them.
- **Updates:** change the image version in `docker-compose.yml` (Realm is tested with v1.13.9),
  then `docker compose pull && docker compose up -d`.
- **Encryption:** calls aren't end-to-end encrypted yet; LiveKit supports it, and Realm will
  switch it on with its DM encryption work.

## On this PC (development)

No server needed: LiveKit for Windows runs as the `realm-voice` dev server (see
`docs/SERVICES.md`). It only answers this machine, with LiveKit's public dev-mode keys.
