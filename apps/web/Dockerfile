# syntax=docker/dockerfile:1

FROM node:24.16-bookworm-slim AS base
ENV CI=true
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate
WORKDIR /repo

# ---- deps: install the whole workspace -------------------------------------
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

# ---- build: generate the Prisma client, then `next build` ------------------
FROM deps AS build
COPY . .
# prisma.config.ts resolves DATABASE_URL at config-load time, so even
# `prisma generate` needs it - same build-time placeholder used below for
# `next build`, declared early since this RUN comes before the others.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=taskflow"
RUN pnpm --filter @taskflow/database db:generate

# NEXT_PUBLIC_* are inlined into the client bundle at build time - real
# per-deployment values are build ARGs, not runtime env (see .env.example).
# The other vars below only need to satisfy apps/web's Zod schemas well
# enough for `next build`'s page-data-collection step to import every route
# module without throwing - they are NOT baked into the runtime image; the
# `web` service in docker-compose.yml supplies the real secrets at
# container start, and Next re-reads process.env for server code on every
# request rather than freezing these at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}
ENV NODE_ENV=production
# next.config.ts only sets output:"standalone" when this is "true" - local
# dev/build (and E2E's `next build && next start`) must stay on the plain
# build, since standalone breaks `next start` entirely.
ENV NEXT_STANDALONE_BUILD=true

# ARG, not ENV, for the placeholders below: they're secret-shaped (even
# though they're dummy values) and ARG doesn't persist in the image's
# inspectable config the way ENV does. `build` is a discarded intermediate
# stage anyway - only `runner`, which never sets or copies these, gets
# tagged/shipped.
ARG NEXTAUTH_SECRET="docker-build-time-placeholder-not-a-real-secret"
ARG NEXTAUTH_URL="http://localhost:3000"
ARG RESEND_API_KEY="re_docker_build_time_placeholder"
ARG EMAIL_FROM="TaskFlow <noreply@example.com>"

RUN pnpm --filter @taskflow/web build

# ---- runner: minimal runtime image -----------------------------------------
FROM node:24.16-bookworm-slim AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN groupadd --system --gid 1001 taskflow \
  && useradd --system --uid 1001 --gid taskflow taskflow
WORKDIR /repo
# No apps/web/public directory exists in this project (no static assets
# served that way yet) - if one is added later, copy it here too, the same
# way the official Next.js standalone Dockerfile does.
COPY --from=build --chown=taskflow:taskflow /repo/apps/web/.next/standalone ./
COPY --from=build --chown=taskflow:taskflow /repo/apps/web/.next/static ./apps/web/.next/static
USER taskflow
WORKDIR /repo/apps/web
EXPOSE 3000
# Node 24 ships a global fetch - no curl/wget needed on this slim image.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["node", "-e", "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
