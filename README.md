# TaskFlow

> Project management SaaS with real-time collaboration, role-based access control, and Kanban boards.

## Monorepo structure

| Path                | Description                                    |
| ------------------- | ---------------------------------------------- |
| `apps/web`          | Next.js 16 web app                             |
| `apps/api`          | Express 5 + Socket.IO API                      |
| `packages/shared`   | Zod schemas + domain types                     |
| `packages/database` | Prisma 7 schema + migrations                   |
| `packages/ui`       | Design system primitives                       |
| `packages/config`   | Shared ESLint / TS / Tailwind / Vitest configs |

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in values
cp .env.example .env

# 3. Start Postgres
docker compose up -d postgres

# 4. Run migrations and seed
pnpm --filter @taskflow/database migrate:deploy
pnpm --filter @taskflow/database seed

# 5. Start all apps in dev mode
pnpm dev
```
