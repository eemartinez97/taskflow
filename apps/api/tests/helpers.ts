import type { NextFunction, Request, Response } from "express";
import { vi } from "vitest";

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
