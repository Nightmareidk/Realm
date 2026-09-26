# Realm

Communities, real-time chat, posts, and clips — one place for your people.

> **Status:** Phase 0/1 — foundations. Web first; native apps later.
> Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before contributing.

## Repository

| Path | What |
|---|---|
| `apps/web` | Next.js — landing page, download portal, and the web app |
| `apps/api` | Fastify REST API (`/v1`) |
| `apps/gateway` | WebSocket realtime gateway |
| `apps/worker` | Background jobs |
| `packages/contracts` | Shared Zod schemas, permissions, gateway protocol — used by every client |
| `packages/db` | Drizzle schema, migrations, seed |
| `packages/server-core` | Server-only shared code |
| `packages/design-tokens` | Design tokens → CSS variables (web) and TS (native, later) |
| `docs/` | Architecture, data model, API, E2EE design, roadmap |

## Local development

Requirements: Node 24+, pnpm 12, Docker Desktop.

```bash
pnpm install
cp .env.example .env
pnpm infra:up          # Postgres, Valkey, MinIO, Mailpit
pnpm db:migrate && pnpm db:seed
pnpm dev               # web :3000 · api :4000 · gateway :4001
```

Mail sent in development appears at http://localhost:8025.

Checks: `pnpm typecheck` · `pnpm lint` · `pnpm test`. Database tests run on an in-memory Postgres (PGlite) and don't need Docker.

## Principles

- The web app is **a client**, not the backend. All data flows through the versioned API so native apps reuse it.
- Never claim encryption we don't have. See [docs/E2EE.md](docs/E2EE.md).
- Security, accessibility, and performance are features, not polish.
