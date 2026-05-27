# syntax=docker/dockerfile:1

# ---- Base: pnpm on top of Node 22 Alpine ----
FROM node:22-alpine AS base
RUN npm install -g pnpm@11

# ---- Deps: install all workspace dependencies ----
# Only manifest files are copied here so this expensive layer is invalidated
# only when a package.json / lockfile changes, not when source code changes.
FROM base AS deps
WORKDIR /app

# 1. Root workspace config — pnpm needs these to understand the monorepo layout
COPY package.json          ./
COPY pnpm-workspace.yaml   ./
COPY pnpm-lock.yaml        ./
COPY .npmrc                ./

# 2. Every workspace manifest — pnpm-workspace.yaml declares "apps/*" and
#    "packages/*", so pnpm looks for a package.json in every matching dir.
#    A missing manifest causes `pnpm install --frozen-lockfile` to fail.
COPY apps/web/package.json     ./apps/web/
COPY apps/worker/package.json  ./apps/worker/
COPY packages/database/package.json  ./packages/database/
COPY packages/cache/package.json     ./packages/cache/
COPY packages/queue/package.json     ./packages/queue/

# 3. Install all deps (including devDependencies — tsc is needed in builder)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Builder: compile workspace packages then build Next.js ----
FROM base AS builder
WORKDIR /app

# 4. Bring the installed virtual store and manifests from the deps stage.
#    Docker COPY preserves symlinks; pnpm's .pnpm/ virtual store and all
#    workspace node_modules/.bin symlinks remain intact.
COPY --from=deps /app ./

# 5. Root TypeScript config — MUST be copied before any `tsc` invocation.
#    Every package tsconfig extends "../../tsconfig.json" (i.e. /app/tsconfig.json).
#    Without this file tsc exits with a "Cannot read file" error (exit code ≠ 0),
#    which pnpm propagates, causing the filter build commands to fail.
COPY tsconfig.json ./

# 6. Workspace source code.
#    .dockerignore excludes node_modules/, dist/, and .next/ from the build
#    context, so these COPY commands add only source files and config.
#    Docker merges them with the existing dirs from step 4 — the pnpm
#    virtual store and per-package node_modules/ are preserved.
COPY packages   ./packages
COPY apps/web   ./apps/web

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=$NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY

# 7. Build internal packages in dependency order.
#    Each produces a dist/ that the Next.js bundler and runtime both need.
RUN pnpm --filter @studyhub/database build && \
    pnpm --filter @studyhub/cache build && \
    pnpm --filter @studyhub/queue build

# 8. Build the Next.js app.
#    NEXT_TELEMETRY_DISABLED prevents network calls during build.
ENV NEXT_TELEMETRY_DISABLED=1
RUN NODE_OPTIONS="--max-old-space-size=1536" pnpm --filter @studyhub/web build

# ---- Runner: minimal production image ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# 9. Copy the full monorepo build.
#    The pnpm virtual store (.pnpm/) plus all workspace symlinks must be
#    intact; symlink targets are relative paths within /app so they resolve
#    correctly after the copy.
COPY --from=builder --chown=nextjs:nodejs /app ./

USER nextjs

EXPOSE 3000

# 10. With shamefully-hoist=false, the next binary lives in the web
#     workspace's own node_modules/.bin/, not at the monorepo root.
WORKDIR /app/apps/web
CMD ["node_modules/.bin/next", "start"]
