# syntax=docker/dockerfile:1

# Prisma's WASM query compiler warns without libssl present, and would
# silently fall back to a guessed OpenSSL version - see Paso 0 spike notes.
ARG OPENSSL_PKG="openssl"

FROM node:24.16-bookworm-slim AS base
ARG OPENSSL_PKG
ENV CI=true
RUN apt-get update && apt-get install -y --no-install-recommends ${OPENSSL_PKG} \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate
WORKDIR /repo

# ---- deps: install the whole workspace (build tools live in devDependencies
# of packages this app doesn't run, e.g. typescript/eslint) -------------------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/mail/package.json packages/mail/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# ---- build: generate the Prisma client, then bundle apps/api with esbuild --
FROM deps AS build
COPY . .
# prisma.config.ts resolves DATABASE_URL at config-load time, so even
# `prisma generate` needs it - build-time placeholder only, discarded with
# this intermediate stage (never baked into `runner`).
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=taskflow"
RUN pnpm --filter @taskflow/database db:generate
RUN pnpm --filter @taskflow/api build

# ---- migrator: applies migrations against DATABASE_URL, then exits --------
# Reuses `build` (has the Prisma CLI + generated client) - avoids a 3rd
# from-scratch stage just for `prisma migrate deploy`.
FROM build AS migrator
WORKDIR /repo/packages/database
CMD ["pnpm", "db:migrate:deploy"]

# ---- prod-deps: fresh --prod install for the runtime image -----------------
# `pnpm prune --prod` on the `deps`/`build` tree was tried first and
# silently dropped legitimate prod-dependency symlinks (e.g. zod) in this
# workspace shape - a clean --prod install from the lockfile is what pnpm's
# own Docker guidance recommends and is what's actually verified to work.
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/mail/package.json packages/mail/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile --prod

# ---- runner: minimal runtime image -----------------------------------------
FROM node:24.16-bookworm-slim AS runner
ARG OPENSSL_PKG
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends ${OPENSSL_PKG} \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 taskflow \
  && useradd --system --uid 1001 --gid taskflow taskflow
WORKDIR /repo
COPY --from=prod-deps --chown=taskflow:taskflow /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=taskflow:taskflow /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=taskflow:taskflow /repo/apps/api/dist ./apps/api/dist
USER taskflow
EXPOSE 8000
# Node 24 ships a global fetch - no curl/wget needed on this slim image.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["node", "-e", "fetch('http://localhost:8000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/api/dist/main.js"]
