import { afterEach, vi } from "vitest";
import "./env";

vi.mock("pino", async () => await import("@/tests/mocks/pino"));
vi.mock("next/headers", async () => await import("@/tests/mocks/next-headers"));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
