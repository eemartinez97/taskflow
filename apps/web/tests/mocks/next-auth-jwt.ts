/**
 * Mock for `next-auth/jwt` - used by proxy.test.ts to control whether a
 * request is treated as authenticated without decoding a real JWT.
 *
 * Activate per test file:
 *   vi.mock("next-auth/jwt", () => import("@/tests/mocks/next-auth-jwt"));
 */
import { type JWT } from "next-auth/jwt";
import { vi } from "vitest";

/** Returns `null` by default; override per test with `mockResolvedValueOnce`. */
export const getToken = vi.fn(async (): Promise<JWT | null> => Promise.resolve(null));
