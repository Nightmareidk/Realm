# Realm

Communities, real-time chat, posts, and clips — one place for your people.

> **Status:** Phase 1 — accounts and the signed-in app are in; Spaces, messages and the feed are next. Web first; native apps later.
> Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before contributing.

## Repository

| Path | What |
|---|---|
| **`frontend/`** | Everything people see |
| `frontend/web` | Next.js: landing page, download portal, and the web app |
| `frontend/design-tokens` | Design tokens → CSS variables (web) and TS (native, later) |
| **`backend/`** | Everything that runs on servers |
| `backend/api` | Fastify REST API (`/v1`) |
| `backend/db` | Drizzle schema, migrations, seed |
| `backend/server-core` | Server-only shared code (config, IDs, crypto, rate limits, events, mail) |
| `backend/gateway`, `backend/worker` | Realtime gateway and background jobs (coming next) |
| **`shared/`** | Used by both sides |
| `shared/contracts` | Zod schemas, permissions, gateway protocol: the contract every client and server follows |
| `shared/tsconfig` | Shared TypeScript settings |
| `docs/` | Architecture, data model, API, E2EE design, roadmap |

## Local development

Requirements: Node 24+ and pnpm 12. Docker is optional.

**Quickest (no Docker).** The API runs on an embedded Postgres (PGlite) that keeps its data in
`.data/` (git-ignored) and applies migrations on start; rate limits and sessions use in-memory
stores; emails, with their codes and links, are printed in the API's console.

```bash
pnpm install
cp .env.example .env   # then set DATABASE_URL=pglite:.data/pglite and remove REDIS_URL and SMTP_HOST
pnpm dev               # web :3000 · api :4000
```

**Full stack (Docker).** Real Postgres, Valkey, MinIO and Mailpit, as in production:

```bash
pnpm install
cp .env.example .env
pnpm infra:up          # Postgres, Valkey, MinIO, Mailpit
pnpm db:migrate && pnpm db:seed
pnpm dev               # web :3000 · api :4000 · gateway :4001
```

Mail sent in development then appears at http://localhost:8025.

The browser talks to the API through the web app (`/api/*` is proxied to `REALM_API_URL`, by
default http://localhost:4000), so the session cookie is first-party. `REALM_WEB_ORIGIN` must be
the address you open the web app at: the API refuses changes coming from any other origin.

Checks: `pnpm typecheck` · `pnpm lint` · `pnpm test`. Database tests run on an in-memory Postgres (PGlite) and don't need Docker.

## Principles

- The web app is **a client**, not the backend. All data flows through the versioned API so native apps reuse it.
- Never claim encryption we don't have. See [docs/E2EE.md](docs/E2EE.md).
- Security, accessibility, and performance are features, not polish.
