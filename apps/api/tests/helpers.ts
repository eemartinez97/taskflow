import type { NextFunction, Request, Response } from "express";
import EventEmitter from "node:events";
import { Registry } from "prom-client";
import { vi } from "vitest";

import type { Prisma, PrismaClient } from "@taskflow/database";
import type { SessionUser } from "@taskflow/shared";

import { type AppCollectors, createCollectors } from "../src/metrics";
import { mockDb, validateSessionToken } from "./mocks/database-mock";
import type { TRPCContext } from "../src/trpc/init";
import { mockLogger } from "./mocks/logger";

// Id fixtures

export const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
export const ANOTHER_UUID = "123e4567-e89b-12d3-a456-426614174000";

// Semantic aliases - use these instead of raw UUIDs so test intent is clear
export const VALID_ORG_ID = "00000001-0000-4000-8000-000000000001";
export const VALID_PROJECT_ID = "00000002-0000-4000-8000-000000000001";
export const VALID_BOARD_ID = "00000003-0000-4000-8000-000000000001";
export const VALID_COLUMN_ID = "00000004-0000-4000-8000-000000000001";
export const VALID_TASK_ID = "00000005-0000-4000-8000-000000000001";
export const VALID_COMMENT_ID = "00000006-0000-4000-8000-000000000001";
export const VALID_LABEL_ID = "00000007-0000-4000-8000-000000000001";

// Date fixtures
export const FIXED_DATE = new Date("2026-06-06T00:00:00.000Z");

// User fixtures
export const VALID_USER = {
  id: VALID_UUID,
  email: "alice@example.com",
} as const;

// Response shapes

/** Shape of every error JSON response from the API */
export interface ErrorBody {
  error: { message: string; code: string };
}

/** Shape of the /healthz and /readyz response */
export interface HealthResponseBody {
  status: string;
}

// Express mock factories

export interface MockRes {
  res: Response;
  statusMock: ReturnType<typeof vi.fn>;
  jsonMock: ReturnType<typeof vi.fn>;
}

export function makeMockRes(): MockRes {
  const jsonMock = vi.fn().mockReturnThis();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

  return {
    res: {
      status: statusMock,
      json: jsonMock,
      send: vi.fn().mockReturnThis(),
    } as unknown as Response,
    statusMock,
    jsonMock,
  };
}

export function makeMockReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: "127.0.0.1",
    cookies: {},
    headers: {},
    method: "GET",
    url: "/test",
    route: undefined,
    ...overrides,
  } as unknown as Request;
}

export function makeMockNext(): NextFunction {
  return vi.fn();
}

// tRPC context factory

/** Creates a typed tRPC context for unit-testing procedures and middleware */
export function makeCtx(user: { id: string; email: string } | null = null): TRPCContext {
  return {
    db: mockDb as unknown as PrismaClient,
    logger: mockLogger,
    user,
  };
}

// Error extraction helper

/**
 * Extracts the first argument passed to a mocked next() function as a typed error.
 * The cast through unknown is intentional: NextFunction's signature types the
 * argument as `string | undefined` but the middleware always passes an Error object.
 */
export function getNextError(
  next: ReturnType<typeof makeMockNext>,
): Error & { statusCode: number; code?: string } {
  return vi.mocked(next).mock.calls[0]?.[0] as unknown as Error & {
    statusCode: number;
    code?: string;
  };
}

/**
 * Pre-cast mockDb instance typed as PrismaClient.
 * Use this instead of repeating `mockDb as unknown as PrismaClient` in every test.
 *
 * For controlling mock behavior, use mockDb directly:
 *   mockDb.session.findUnique.mockResolvedValueOnce(...)
 *
 * For passing to functions that expect a real PrismaClient:
 *   import { db } from "../../helpers
 *   import { validateSessionToken } from './mocks/database-mock';
 *   await validateSessionToken(db, token)
 */
export const db = mockDb as unknown as PrismaClient;

/**
 * Prisma inferred type for a Session row with the user select shape
 * used by validateSessionToken.
 * Derived form the generated schema - never written by hand.
 */
type SessionWithUser = Prisma.SessionGetPayload<{
  include: {
    user: {
      select: { id: true; email: true; name: true };
    };
  };
}>;

/**
 * Builds a valid session row matching the select shape used by
 * validateSessionToken (user: { id, email, name }).
 *
 * Shared by auth.test.ts, session.test.ts, and any future test that
 * needs to mock a Prisma session lookup.
 */
export function makeValidSessionRow(
  token: string,
  name: string | null = "Alice",
  expiresOffset = 1000 * 60 * 60,
): SessionWithUser {
  return {
    id: "session-id-1",
    sessionToken: token,
    userId: VALID_USER.id,
    expires: new Date(Date.now() + expiresOffset),
    user: { id: VALID_USER.id, email: VALID_USER.email, name },
  };
}

/**
 * Builds a SessionUser — the value returned by validateSessionToken on success.
 *
 * Use this to set up the validateSessionToken mock in middleware and socket tests:
 *
 *   validateSessionToken.mockResolvedValueOnce(makeSessionUser());
 *   validateSessionToken.mockResolvedValueOnce(makeSessionUser({ name: null }));
 *   validateSessionToken.mockResolvedValueOnce(null); // expired / not found
 */

export function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: VALID_USER.id,
    email: VALID_USER.email,
    name: "Alice",
    image: null,
    ...overrides,
  };
}

// Re-export so tests can import validateSessionToken through helpers
export { validateSessionToken };

// Metrics helpers

/**
 * Named type aliases derived once here.
 * Test import these instead of writing
 * `ReturnType<typeof makeTestCollectors>["collectors"]` inline.
 */
export type TestRegistry = Registry;
export type TestCollectors = AppCollectors;

/**
 * Creates a fresh isolated Registry + collectors for each test.
 * Prevents cross-test metric pollution from the module-level singleton
 */
export function makeTestCollectors(): { registry: TestRegistry; collectors: TestCollectors } {
  const registry = new Registry();
  const collectors = createCollectors(registry);
  return { registry, collectors };
}

/**
 * Response mock backed by EventEmitter.
 * Use when the code under test listens to res.on("finish", ...).
 * Distinct from makeMockRes() which provides vi.fn() spies for
 * res.status().json() call assertions.
 */
export function makeMockResEE(statusCode = 200): Response & EventEmitter {
  const emitter = new EventEmitter() as EventEmitter & { statusCode: number };
  emitter.statusCode = statusCode;
  return emitter as unknown as Response & EventEmitter;
}
