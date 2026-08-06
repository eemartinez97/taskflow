import { afterEach, vi } from "vitest";
import type * as NextServer from "next/server";
import "./env";

vi.mock("pino", async () => await import("@/tests/mocks/pino"));
vi.mock("next/headers", async () => await import("@/tests/mocks/next-headers"));

// `connection()` requires a live Next.js request-scope (AsyncLocalStorage)
// that doesn't exist when a route handler is invoked directly in a vitest
// node environment - stub it out, keep everything else (NextRequest,
// NextResponse, ...) real.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof NextServer>("next/server");
  return { ...actual, connection: vi.fn().mockResolvedValue(undefined) };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
