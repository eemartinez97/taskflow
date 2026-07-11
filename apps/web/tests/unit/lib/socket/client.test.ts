import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => import("@/tests/mocks/socket-io-client"));

import { io } from "@/tests/mocks/socket-io-client";
import { createSocket } from "@/lib/socket/client";

afterEach(() => vi.unstubAllGlobals());

describe("createSocket", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null on the server (window is undefined)", () => {
    vi.stubGlobal("window", undefined);
    expect(createSocket("proj-1")).toBeNull();
  });

  it("calls io() in the browser", () => {
    expect(createSocket("proj-1")).not.toBeNull();
    expect(io).toHaveBeenCalledOnce();
  });

  it("passes projectId in the query object", () => {
    createSocket("my-project");
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ query: { projectId: "my-project" } }),
    );
  });

  it("passes withCredentials: true for cookie forwarding", () => {
    createSocket("proj-1");
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ withCredentials: true }),
    );
  });

  it("passes autoConnect: false so connect() is explicit", () => {
    createSocket("proj-1");
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ autoConnect: false }),
    );
  });

  it("connects to NEXT_PUBLIC_SOCKET_URL", () => {
    createSocket("proj-1");
    // The first argument is the URL from publicEnv
    expect(io).toHaveBeenCalledWith(expect.stringContaining("localhost:8000"), expect.anything());
  });

  it("each call with different projectId passes that projectId in the query", () => {
    const calls = vi.mocked(io).mock.calls as unknown as [string, Record<string, unknown>][];

    createSocket("project-A");
    expect(calls[0]?.[1]).toMatchObject({
      query: { projectId: "project-A" },
    });

    createSocket("project-B");
    expect(calls[1]?.[1]).toMatchObject({
      query: { projectId: "project-B" },
    });
  });
});
