/**
 * Shared mock for pino-http.
 * Used by tests that create an Express app (health, tRPC HTTP, etc.)
 * but don't want pino-http to require a real Pino logger internals.
 *
 * Usage:
 *   vi.mock("pino-http", () => import("../../mocks/http));
 */

import { vi } from "vitest";
import type { NextFunction, Response, Request } from "express";

export const pinoHttp = vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => {
  next();
});

export default pinoHttp;
