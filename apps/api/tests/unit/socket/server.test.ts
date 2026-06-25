import { beforeEach, describe, expect, vi, it } from "vitest";

vi.mock("../../../src/config/env.js");

import { getConnectedCount } from "../../../src/socket/server.js";
import { makeIoMock } from "../../mocks/socket.js";

describe("getConnectedCount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the number of connected sockets via Namespace.sockets.size", () => {
    expect(getConnectedCount(makeIoMock(5))).toBe(5);
  });

  it("returns 0 when no sockets are connected", () => {
    expect(getConnectedCount(makeIoMock(0))).toBe(0);
  });

  it("handles large connection counts without overflow", () => {
    expect(getConnectedCount(makeIoMock(10_000))).toBe(10_000);
  });

  it("uses Namespace.sockets.size - NOT the removed Namespace.connected", () => {
    // Mock has no `.connected` property - if getConnectedCount tried to use it the
    // test would return undefined, making the assertion fail
    expect(getConnectedCount(makeIoMock(3))).toBe(3);
  });
});
