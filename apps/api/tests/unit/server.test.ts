import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app";
import { createSocketServer } from "../../src/socket/server";
import { bootstrap, shutdown, start } from "../../src/server";
import { mockLogger } from "../mocks/logger";

const listen = vi.fn((_port: number, cb: () => void) => {
  cb();
});
const on = vi.fn();
const close = vi.fn((cb: () => void) => {
  cb();
});

vi.mock("node:http", () => ({
  default: { createServer: vi.fn(() => ({ listen, on, close })) },
}));
const expressApp = vi.fn();
vi.mock("../../src/app", () => ({ createApp: vi.fn(() => expressApp) }));
vi.mock("../../src/socket/server", () => ({
  createSocketServer: vi.fn(() => ({
    path: vi.fn(() => "/socket.io"),
    close: vi.fn((cb: () => void) => {
      cb();
    }),
  })),
}));

describe("bootstrap", () => {
  it("wires Socket.IO and Express onto one HTTP server", () => {
    const { httpServer, io } = bootstrap();

    expect(createSocketServer).toHaveBeenCalledWith(httpServer);
    expect(createApp).toHaveBeenCalledWith(io);
    expect(on).toHaveBeenCalledWith("request", expect.any(Function));
  });

  it("forwards non-Socket.IO requests to Express", () => {
    bootstrap();
    const listener = on.mock.calls[0]?.[1] as (req: unknown, res: unknown) => void;

    const req = { url: "/healthz" };
    const res = {};
    listener(req, res);

    expect(expressApp).toHaveBeenCalledWith(req, res);
  });

  it("creates the Socket.IO server before registering the request guard - required so Engine.IO's own request listener is attached first", () => {
    bootstrap();

    const [socketServerCallOrder] = vi.mocked(createSocketServer).mock.invocationCallOrder;
    const [guardRegisteredCallOrder] = on.mock.invocationCallOrder;

    if (socketServerCallOrder === undefined || guardRegisteredCallOrder === undefined) {
      throw new Error("expected both mocks to have been called");
    }

    expect(socketServerCallOrder).toBeLessThan(guardRegisteredCallOrder);
  });

  it("does not forward Socket.IO requests to Express - Engine.IO already handled them", () => {
    bootstrap();
    const listener = on.mock.calls[0]?.[1] as (req: unknown, res: unknown) => void;

    listener({ url: "/socket.io/?EIO=4&transport=polling" }, {});

    expect(expressApp).not.toHaveBeenCalled();
  });
});

describe("start", () => {
  it("binds the configured port and logs once listening", () => {
    start();
    expect(listen).toHaveBeenCalledWith(8001, expect.any(Function));
    expect(mockLogger.info).toHaveBeenCalledWith({ port: 8001, env: "test" }, "API server started");
  });

  it("calls shutdown with SIGTERM when process receives SIGTERM", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    start();
    process.emit("SIGTERM");
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("calls shutdown with SIGINT when process receives SIGINT", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    start();
    process.emit("SIGINT");
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe("shutdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("closes Socket.IO first, then HTTP, then exits 0", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const deps = bootstrap();

    shutdown(deps, "SIGTERM");

    expect(mockLogger.info).toHaveBeenCalledWith(
      { signal: "SIGTERM" },
      "Shutdown signal received - draining connections",
    );
    expect(close).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);

    vi.useRealTimers();
  });

  it("force-exits with 1 if connections do not drain in 10s", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const deps = bootstrap();

    shutdown(deps, "SIGINT");
    vi.advanceTimersByTime(10_000);

    expect(mockLogger.error).toHaveBeenCalledWith("Forced shutdown after timeout");
    expect(exit).toHaveBeenCalledWith(1);

    vi.useRealTimers();
  });
});
