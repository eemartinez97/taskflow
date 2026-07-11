/**
 * Mock for `@taskflow/api/trpc` - prevents importing the full Express/
 * Socket.IO/pino chain into the Next.js test bundle.
 *
 * Active per test file:
 *   vi.mock("@taskflow/api/trpc", () => import("@/mocks/taskflow-api"));
 */
import type { Server } from "socket.io";
import { vi } from "vitest";

// Minimal router shaper that satisfies tRPC type checks
const mockRouterDef = {
  _def: {
    procedures: {},
    record: {},
    inputs: [],
    meta: undefined,
    errorShape: undefined,
    transformer: undefined,
  },
};

export const createAppRouter = vi.fn((_io: Server) => mockRouterDef);
export const appRouter = mockRouterDef;

// createCallerFactory: returns a function that returns a callable proxy
export const createCallerFactory = vi.fn(
  (_router: unknown) =>
    (_ctx: unknown): Record<string, unknown> => ({}),
);

export interface TRPCContext {
  db: unknown;
  logger: unknown;
  user: { id: string; email: string } | null;
}

export type AppRouter = typeof appRouter;
