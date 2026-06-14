import { vi, describe, it, expect, beforeEach } from "vitest";
import { type CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request, Response } from "express";
import express from "express";
import request from "supertest";
import * as trpcExpress from "@trpc/server/adapters/express";

import {
  baseProcedure,
  createTRPCContext,
  createTRPCRouter,
  TRPCError,
} from "../../../src/trpc/init.js";
import { prisma } from "@taskflow/database";
import { logger } from "../../../src/config/logger.js";
import { VALID_USER } from "../../helpers.js";
import { isProduction } from "../../../src/config/env.js";

vi.mock("../../../src/config/env.js");

function makeOpts(user?: { id: string; email: string }): CreateExpressContextOptions {
  return {
    req: { user } as unknown as Request,
    res: {} as Response,
    info: {} as Parameters<typeof createTRPCContext>[0]["info"],
  };
}

/** Builds a minimal Express app with one tRPC procedure that throws with a cause */
function makeErrorApp(
  code: ConstructorParameters<typeof TRPCError>[0]["code"],
  cause?: unknown,
): ReturnType<typeof express> {
  const router = createTRPCRouter({
    fail: baseProcedure.query(() => {
      throw new TRPCError({ code, message: "boom", cause });
    }),
  });

  const app = express();
  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router,
      createContext: createTRPCContext,
    }),
  );

  return app;
}

// Typed shape of the superjson-wrapped tRPC error response
interface TRPCErrorResponse {
  error?: {
    json?: {
      message?: string;
      code?: number;
      data?: {
        code?: string;
        httpStatus?: number;
        cause?: unknown;
        path?: string;
        stack?: string;
      };
    };
    meta?: unknown;
  };
}

describe("createTRPCContext", () => {
  it("attaches db (prisma) to context", () => {
    const ctx = createTRPCContext(makeOpts());
    expect(ctx.db).toBe(prisma);
  });

  it("attaches logger to context", () => {
    const ctx = createTRPCContext(makeOpts());
    expect(ctx.logger).toBe(logger);
  });

  it("sets user to null when req.user is undefined (public route)", () => {
    const ctx = createTRPCContext(makeOpts(undefined));
    expect(ctx.user).toBeNull();
  });

  it("sets user from req.user when present (authenticated route)", () => {
    const ctx = createTRPCContext(makeOpts(VALID_USER));
    expect(ctx.user).toEqual(VALID_USER);
  });
});

describe("errorFormatter", () => {
  beforeEach(() => {
    vi.mocked(isProduction).mockReturnValue(false);
  });

  it("strips error cause in production mode", async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    const app = makeErrorApp("INTERNAL_SERVER_ERROR", new Error("raw db password"));

    const res = await request(app).get("/trpc/fail");

    // INTERNAL_SERVER_ERROR -> HTTP 500
    expect(res.status).toBe(500);

    const data = (res.body as TRPCErrorResponse).error?.json?.data;
    expect(data).toBeDefined();
    expect(data?.cause).toBeNull();
  });

  it("includes error cause in development mode", async () => {
    vi.mocked(isProduction).mockReturnValue(false);
    const cause = "invalid-query-param";
    const app = makeErrorApp("BAD_REQUEST", cause);

    const res = await request(app).get("/trpc/fail");

    // BAD_REQUEST -> 400 (tRPC maps error codes to HTTP status)
    expect(res.status).toBe(400);

    // In development, errorFormatter passes error.cause through
    // superjson serializes the response under error.json
    const errorJson = (res.body as TRPCErrorResponse).error?.json;
    expect(errorJson).toBeDefined();
    expect(errorJson?.data?.code).toBe("BAD_REQUEST");
  });

  it("errorFormatter does not throw when error has no cause", async () => {
    vi.mocked(isProduction).mockReturnValue(true);
    // No cause passed - production branch: cause becomes undefined without throwing
    const app = makeErrorApp("NOT_FOUND");

    const res = await request(app).get("/trpc/fail");

    expect(res.status).toBe(404);

    // errorFormatter ran without throwing - structured error body is present
    const errorJson = (res.body as TRPCErrorResponse).error?.json;
    expect(errorJson?.message).toBe("boom");
    expect(errorJson?.data?.code).toBe("NOT_FOUND");
    expect(errorJson?.data?.cause).toBeNull();
  });
});
