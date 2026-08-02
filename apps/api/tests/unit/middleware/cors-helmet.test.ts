import { describe, expect, it, vi } from "vitest";

const corsFactory = vi.fn(() => vi.fn());
const helmetFactory = vi.fn((_opts?: Record<string, unknown>) => vi.fn());

vi.mock("cors", () => ({ default: corsFactory }));
vi.mock("helmet", () => ({ default: helmetFactory }));
vi.mock("../../../src/config/env");

describe("corsMiddleware", () => {
  it("allows only the configured web origin, with credentials", async () => {
    await import("../../../src/middleware/cors");

    expect(corsFactory).toHaveBeenCalledWith({
      origin: "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
  });
});

describe("helmetMiddleware", () => {
  it("disables COEP and locks down the CSP", async () => {
    await import("../../../src/middleware/helmet");

    const options = (helmetFactory.mock.calls[0]?.[0] ?? []) as Record<string, unknown>;

    expect(options).toMatchObject({ crossOriginEmbedderPolicy: false });
    expect(options.contentSecurityPolicy).toMatchObject({
      directives: expect.objectContaining({
        defaultSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      }) as unknown,
    });
  });
});
