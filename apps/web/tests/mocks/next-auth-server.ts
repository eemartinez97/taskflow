/**
 * Mock for `next-auth/next` - the server-side session accessor.
 *
 * Activate per test file:
 *   vi.mock("next-auth/next", () => import("../mocks/next-auth-server.js"))
 */

import { vi } from "vitest";
import type { Session } from "next-auth";
import type { getServerSession as GetServerSessionFn } from "next-auth/next";

import { mockSession } from "./next-auth";

export const getServerSession = vi.fn((): Promise<Session | null> =>
  Promise.resolve(mockSession),
) as unknown as typeof GetServerSessionFn;
