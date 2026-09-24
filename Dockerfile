# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN npm install -g pnpm@9.15.9
WORKDIR /app
# Every workspace manifest, so the frozen lockfile matches in both stages.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/e2e/package.json apps/e2e/

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @deal-city/web build && pnpm --filter @deal-city/server build

FROM base AS deps
# The server bundle inlines the workspace packages and zod; only its own dependencies stay external.
RUN pnpm install --frozen-lockfile --prod --filter @deal-city/server

# A clean Node image: no pnpm, npm, corepack or package caches, only what the server runs.
FROM node:24-alpine AS runtime
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /root/.npm
ENV NODE_ENV=production PORT=3000 WEB_DIST=/app/web
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/server/node_modules apps/server/node_modules
COPY apps/server/package.json apps/server/
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist web
USER node
WORKDIR /app/apps/server
EXPOSE 3000
# Probe every second while starting, so Caddy (depends_on: service_healthy) starts sooner.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=1s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "dist/main.js"]
