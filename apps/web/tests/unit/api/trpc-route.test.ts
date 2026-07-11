import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@taskflow/api/trpc", () => import("@/tests/mocks/taskflow-api"));
vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database"));
vi.mock("pino", () => import("@/tests/mocks/pino"));
vi.mock("server-only");
vi.mock("@/lib/auth/server-session", () => ({
  getServerSessionFromHeaders: vi.fn().mockResolvedValue(null),
}));
vi.mock("@trpc/server/adapters/fetch", () => ({
  fetchRequestHandler: vi.fn(),
}));

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { GET, POST } from "@/app/api/trpc/[trpc]/route";
import { mockPinoLogger } from "@/tests/mocks/pino";

// -- Types --

type FetchOpts = Parameters<typeof fetchRequestHandler>[0];

// -- Constants --

const BASE_URL = "http://localhost:3000/api/trpc/auth.me";
const DEFAULT_RESPONSE = new Response(JSON.stringify({ ok: true }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

// -- Captured-opts closure (replaces mutable module-level state) --

let capturedOpts: FetchOpts | undefined;

function getOpts(): FetchOpts {
  if (!capturedOpts) throw new Error("fetchRequestHandler was not called");
  return capturedOpts;
}

async function callCreateContext(): Promise<unknown> {
  const { createContext } = getOpts();
  if (typeof createContext !== "function") throw new Error("createContext ist not a function");
  return (createContext as () => Promise<unknown>)();
}

// -- Setup --
beforeEach(() => {
  vi.clearAllMocks();
  capturedOpts = undefined;

  vi.mocked(fetchRequestHandler).mockImplementation((opts) => {
    capturedOpts = opts;
    return Promise.resolve(DEFAULT_RESPONSE);
  });
});

afterEach(() => vi.unstubAllEnvs());

// -- Handler exports --

describe("exports", () => {
  it("GET and POST are the same function reference", () => {
    expect(GET).toBe(POST);
  });

  it("GET is callable and returns a Response", async () => {
    const res = await GET(new Request(BASE_URL));
    expect(res).toBeInstanceOf(Response);
  });
});

// -- fetchRequestHandler call shape --

describe("fetchRequestHandler arguments", () => {
  beforeEach(async () => {
    await GET(new Request(BASE_URL));
  });

  it("receives endpoint '/api/trpc'", () => {
    expect(getOpts().endpoint).toBe("/api/trpc");
  });

  it("receives the original Request object", async () => {
    const req = new Request(BASE_URL);
    await GET(req);
    expect(getOpts().req).toBe(req);
  });

  it("receives a router and a createContext factory", () => {
    expect(typeof getOpts().router).toBe("object");
    expect(typeof getOpts().createContext).toBe("function");
  });
});

// -- createContext --

describe("createContext", () => {
  it("returns a context with db, logger, and user", async () => {
    await GET(new Request(BASE_URL));
    const ctx = (await callCreateContext()) as Record<string, unknown>;
    expect(ctx.db).toBeDefined();
    expect(ctx.logger).toBeDefined();
    expect(ctx).toHaveProperty("user");
  });

  it("sets user to null when no session is found", async () => {
    await GET(new Request(BASE_URL));
    const ctx = (await callCreateContext()) as { user: unknown };
    expect(ctx.user).toBeNull();
  });
});

// -- onError conditional --

describe("onError — conditional by NODE_ENV", () => {
  it("is NOT included in test env (NODE_ENV=test)", async () => {
    await GET(new Request(BASE_URL));
    expect(getOpts()).not.toHaveProperty("onError");
  });

  describe("development mode", () => {
    /**
     * Re-mock fetchRequestHandler after vi.resetModules() so the freshly imported
     * route file sees the same mock (vi.mock factories are hoisted and persist,
     * but the mock fn reference needs to be re-registered post-reset).
     */
    function setupDevMock(
      opts: {
        triggerOnError?: boolean;
        onErrorPayload?: { path?: string; error: Error; type: string };
      } = {},
    ): void {
      vi.mocked(fetchRequestHandler).mockImplementationOnce((o) => {
        capturedOpts = o;
        if (opts.triggerOnError && opts.onErrorPayload) {
          const onError = o.onError;
          if (typeof onError === "function") {
            (onError as (x: typeof opts.onErrorPayload) => void)(opts.onErrorPayload);
          }
        }
        return Promise.resolve(DEFAULT_RESPONSE);
      });
    }

    beforeEach(() => {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "development");
    });

    it("onError IS included in development mode", async () => {
      setupDevMock();
      const { GET: devGET } = (await import("@/app/api/trpc/[trpc]/route")) as {
        GET: (req: Request) => Promise<Response>;
      };
      await devGET(new Request(BASE_URL));
      expect(typeof getOpts().onError).toBe("function");
    });

    it("onError calls logger.error with path and error", async () => {
      const testError = new Error("db failure");
      setupDevMock({
        triggerOnError: true,
        onErrorPayload: { path: "auth.me", error: testError, type: "query" },
      });

      const { GET: devGET } = (await import("@/app/api/trpc/[trpc]/route")) as {
        GET: (req: Request) => Promise<Response>;
      };
      await devGET(new Request(BASE_URL));

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        { path: "auth.me", err: testError },
        "tRPC error",
      );
    });

    it("onError does NOT call console.error (uses pino, not console)", async () => {
      const consoleSpy = vi.spyOn(console, "error");
      setupDevMock({
        triggerOnError: true,
        onErrorPayload: { path: "auth.me", error: new Error("x"), type: "query" },
      });

      const { GET: devGET } = (await import("@/app/api/trpc/[trpc]/route")) as {
        GET: (req: Request) => Promise<Response>;
      };
      await devGET(new Request(BASE_URL));

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
