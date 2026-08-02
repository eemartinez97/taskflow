import { inject } from "vitest";

// Must run before @taskflow/database instantiates its PrismaClient singleton.
process.env.DATABASE_URL = inject("databaseUrl");
process.env.NODE_ENV = "test";
process.env.NEXTAUTH_SECRET = "test-secret-value-at-least-16-chars";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.API_PORT = "8001";
process.env.API_LOG_LEVEL = "silent";
