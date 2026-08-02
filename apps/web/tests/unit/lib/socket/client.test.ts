import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => import("@/tests/mocks/socket-io-client"));

import { io } from "socket.io-client";
import { createSocket } from "@/lib/socket/client";

describe("createSocket", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when running on the server", () => {
    vi.stubGlobal("window", undefined);
    expect(createSocket("proj-1")).toBeNull();
  });

  it("creates a socket with autoConnect false and websocket/polling transports", () => {
    createSocket("proj-1");
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ autoConnect: false, withCredentials: true }),
    );
  });

  it("includes projectId and boardId in the handshake query when provided", () => {
    createSocket("proj-1", "board-1");
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ query: { projectId: "proj-1", boardId: "board-1" } }),
    );
  });

  it("omits the query object entirely when no ids are provided", () => {
    createSocket();
    const [, options] = vi.mocked(io).mock.calls.at(-1) ?? [];
    expect(options).not.toHaveProperty("query");
  });
});
