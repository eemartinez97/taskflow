import type { NextFunction, Request, Response } from "express";
import { vi } from "vitest";

import type { TRPCContext } from "../src/trpc/init.js";
import type { PrismaClient } from "@taskflow/database";
import { mockLogger } from "./mocks/logger.js";
import { mockDb } from "./mocks/database-mock.js";

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
