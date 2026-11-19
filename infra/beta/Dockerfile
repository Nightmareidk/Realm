# Realm's beta server images, built on the server from the repo root:
#   docker compose -f infra/beta/docker-compose.yml build
# One image holds the API, the live connection (gateway) and the job worker; the other the website.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable
WORKDIR /repo

# Everything except the phone app (see .dockerignore), with the exact package versions from the
# lockfile. Install scripts stay limited to the list in pnpm-workspace.yaml.
FROM base AS source
COPY . .
RUN pnpm install --frozen-lockfile --filter "@realm/api..." --filter "@realm/web..." --filter "@realm/db..."

# ── The API, gateway and worker ──────────────────────────────────────────────────────────────
FROM source AS api
RUN pnpm --filter @realm/api build
ENV NODE_ENV=production
USER node
# The same image runs as the API (default), the gateway or the worker (see docker-compose.yml).
CMD ["node", "backend/api/dist/server.js"]

# ── The website ──────────────────────────────────────────────────────────────────────────────
FROM source AS web
# These are read while building: the API address the website forwards /api to (on this server),
# and the public addresses its security policy allows. None of them is secret.
ARG REALM_API_URL=http://127.0.0.1:4000
ARG NEXT_PUBLIC_REALM_GATEWAY_URL
ARG NEXT_PUBLIC_LIVEKIT_HOST
ARG REALM_STORAGE_ORIGIN
# Public map keys: lock them to Realm's web address in the map service's own settings.
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY
ARG NEXT_PUBLIC_GOOGLE_MAP_ID
ENV REALM_API_URL=$REALM_API_URL \
    NEXT_PUBLIC_REALM_GATEWAY_URL=$NEXT_PUBLIC_REALM_GATEWAY_URL \
    NEXT_PUBLIC_LIVEKIT_HOST=$NEXT_PUBLIC_LIVEKIT_HOST \
    REALM_STORAGE_ORIGIN=$REALM_STORAGE_ORIGIN \
    NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY \
    NEXT_PUBLIC_GOOGLE_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAP_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @realm/web build && chown -R node:node /repo/frontend/web/.next
ENV NODE_ENV=production
USER node
WORKDIR /repo/frontend/web
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3000"]
