import type { NextFunction, Request, Response } from "express";
import { vi } from "vitest";

import type { TRPCContext } from "../src/trpc/init.js";
import type { PrismaClient } from "@taskflow/database";
import { mockLogger } from "./mocks/logger.js";
import { mockDb } from "./mocks/database-mock.js";

// Common fixtures

export const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
export const ANOTHER_UUID = "123e4567-e89b-12d3-a456-426614174000";
export const VALID_USER = { id: VALID_UUID, email: "alice@example.com" } as const;
export const VALID_ORG_ID = ANOTHER_UUID;

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
 * Extracts a call argument from a vi.fn() mock as `unknown`.
 *
 * WHY a structural interface instead of `ReturnType<typeof vi.fn>`:
 * - Our mocks are typed as MockInstance<(...args: unknown[]) => unknown>.
 * - vi.fn() returns Mock<(...args: any[]) => any>.
 * - `unknown[]` is not assignable to `any[]` under strict mode, so
 *   passing our mocks to `ReturnType<typeof vi.fn>` causes a type error.
 * - Accepting only `{ mock: { calls: unknown[][] } }` (the minimal interface
 *   we actually use) satisfies both types without casting.
 *
 * WHY `unknown` return and not a generic T:
 * - vi.fn() already types all call arguments as `unknown[]`.
 * - A generic <T> would only appear in the return type (not the params),
 *   triggering @typescript-eslint/no-unnecessary-type-parameters.
 * - Callers use `expect(arg).toMatchObject(...)` which accepts `unknown`,
 *   so no cast is needed at the call site either.
 *
 * Usage:
 *   expect(mockDb.project.create).toHaveBeenCalledOnce();
 *   const arg = getMockArg(mockDb.project.create);
 *   expect(arg).toMatchObject({ data: { orgId: VALID_ORG_ID } });
 */
interface HasMockCalls {
  mock: { calls: unknown[][] };
}

export function getMockArg(mockFn: HasMockCalls, callIndex = 0, argIndex = 0): unknown {
  return mockFn.mock.calls[callIndex]?.[argIndex];
}
