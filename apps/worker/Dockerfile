# syntax=docker/dockerfile:1

# ---- Base: pnpm on top of Node 22 Alpine ----
FROM node:22-alpine AS base
RUN npm install -g pnpm@11

# ---- Deps: install all workspace dependencies ----
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

COPY apps/web/package.json    ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/database/package.json ./packages/database/
COPY packages/cache/package.json    ./packages/cache/
COPY packages/queue/package.json    ./packages/queue/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Builder: compile packages and the worker ----
FROM base AS builder
WORKDIR /app

COPY --from=deps /app ./

COPY tsconfig.json ./

COPY packages        ./packages
COPY apps/worker     ./apps/worker

# Build internal packages (their dist/ is required at worker runtime because
# Node resolves exports.require → ./dist/index.js for each workspace package)
RUN pnpm --filter @studyhub/database build && \
    pnpm --filter @studyhub/cache build && \
    pnpm --filter @studyhub/queue build

# Compile the worker TypeScript to dist/
RUN pnpm --filter @studyhub/worker build

# ---- Runner: minimal production image (no HTTP server, no exposed ports) ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 worker

COPY --from=builder --chown=worker:nodejs /app ./

USER worker

# No EXPOSE — the worker consumes from RabbitMQ; it binds no ports
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
