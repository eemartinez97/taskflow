import { beforeEach, describe, expect, vi, it, afterEach } from "vitest";

vi.mock("socket.io", () => import("../../mocks/socket-io-module"));
vi.mock("../../../src/config/env");

import type { Server as HttpServer } from "node:http";

import { HEX_COLOR_REGEX, SOCKET_EVENTS, SOCKET_ROOM_PREFIX } from "@taskflow/shared";

import {
  authenticateSocket,
  createSocketServer,
  getConnectedCount,
} from "../../../src/socket/server";
import { validateSessionToken, makeMockNext, VALID_USER, makeSessionUser } from "../../helpers";
import { getMockIoInstance, Server } from "../../mocks/socket-io-module";
import { makeIoMock, makeSocketMock } from "../../mocks/socket";
import { appCollectors } from "../../../src/metrics";

const fakeHttpServer = {} as HttpServer;

describe("authenticateSocket", () => {
  beforeEach(() => vi.resetAllMocks());

  function makeAuthSocket(cookie: string | undefined): ReturnType<typeof makeSocketMock>["socket"] {
    const { socket } = makeSocketMock();
    // @ts-expect-error: overwriting readonly handshake.headers for test purposes
    socket.handshake = { headers: { cookie }, query: {} };
    return socket;
  }

  it("calls next(UNAUTHORIZED) when no cookie header ir present", async () => {
    const next = makeMockNext();

    await authenticateSocket(makeAuthSocket(undefined), next);

    expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
    expect(validateSessionToken).not.toHaveBeenCalled();
  });

  it("calls next(UNAUTHORIZED) when cookie has no session token", async () => {
    const next = makeMockNext();

    await authenticateSocket(makeAuthSocket("theme=dark; lang=en"), next);

    expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
    expect(validateSessionToken).not.toHaveBeenCalled();
  });

  it("calls next() with no args on a valid session", async () => {
    validateSessionToken.mockResolvedValueOnce(makeSessionUser());
    const next = makeMockNext();

    await authenticateSocket(makeAuthSocket("next-auth.session-token=valid-token"), next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledOnce();
  });

  it("attaches userId, userEmail, userName, color to socket.data on success", async () => {
    validateSessionToken.mockResolvedValueOnce(makeSessionUser({ name: "Alice" }));
    const socket = makeAuthSocket("next-auth.session-token=data-token");

    await authenticateSocket(socket, makeMockNext());

    expect(socket.data.userId).toBe(VALID_USER.id);
    expect(socket.data.userEmail).toBe(VALID_USER.email);
    expect(socket.data.userName).toBe("Alice");
    expect(socket.data.color).toMatch(HEX_COLOR_REGEX);
  });

  it("resolves userName to null when user has no display name", async () => {
    validateSessionToken.mockResolvedValueOnce(makeSessionUser({ name: null }));
    const socket = makeAuthSocket(`next-auth.session-token=null-name-token`);

    await authenticateSocket(socket, makeMockNext());

    expect(socket.data.userName).toBeNull();
  });

  it("calls next(UNAUTHORIZED) when session is not found", async () => {
    validateSessionToken.mockResolvedValueOnce(null);
    const next = makeMockNext();

    await authenticateSocket(makeAuthSocket("next-auth.session-token=ghost"), next);

    expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
  });

  it("calls next(UNAUTHORIZED) when session is expired", async () => {
    // validateSessionToken already handles expiry internally and returns null
    validateSessionToken.mockResolvedValueOnce(null);
    const next = makeMockNext();

    await authenticateSocket(makeAuthSocket("next-auth.session-token=expired"), next);

    expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
  });

  it("calls next(UNAUTHORIZED) when Prisma throws", async () => {
    validateSessionToken.mockRejectedValueOnce(new Error("Connection refused"));
    const next = makeMockNext();

    await authenticateSocket(makeAuthSocket(`next-auth.session-token=any`), next);

    expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
  });

  it("reads __Secure- prefixed token (HTTPS origin)", async () => {
    const token = "secure-socket-token";
    validateSessionToken.mockResolvedValueOnce(makeSessionUser());
    const next = makeMockNext();

    await authenticateSocket(makeAuthSocket(`__Secure-next-auth.session-token=${token}`), next);

    expect(next).toHaveBeenCalledWith();
    expect(validateSessionToken).toHaveBeenCalledWith(expect.anything(), token);
  });
});

describe("createSocketServer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getMockIoInstance()._reset();
  });

  it("constructs Server with WEB_ORIGIN in CORS config", () => {
    createSocketServer(fakeHttpServer);
    expect(Server).toHaveBeenCalledWith(
      fakeHttpServer,
      expect.objectContaining({
        cors: expect.objectContaining({
          origin: "http://localhost:3000",
          credentials: true,
        }) as unknown,
      }),
    );
  });

  it("registers exactly one io.use() auth middleware", () => {
    createSocketServer(fakeHttpServer);
    expect(getMockIoInstance().use).toHaveBeenCalledOnce();
  });

  it("registers io.on('connection') handler", () => {
    createSocketServer(fakeHttpServer);
    expect(getMockIoInstance().on).toHaveBeenCalledWith("connection", expect.any(Function));
  });

  it("returns the io instance", () => {
    const result = createSocketServer(fakeHttpServer);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("use");
  });

  describe("io.use() wrapper - delegates to authenticateSocket", () => {
    it("calls next(UNAUTHORIZED) via the wrapper when no cookies is present", async () => {
      createSocketServer(fakeHttpServer);

      const inst = getMockIoInstance();
      const authWrapper = inst._useHandlers[0];
      if (!authWrapper) throw new Error("auth middleware not registered");

      const { socket } = makeSocketMock();
      // @ts-expect-error: overwriting handshake for test purposes
      socket.handshake = { headers: {}, query: {} };
      const next = makeMockNext();

      authWrapper(socket, next);
      // Two microtask ticks: one for the async function, one for the void wrapper
      await Promise.resolve();
      await Promise.resolve();

      expect(next).toHaveBeenCalledWith(new Error("UNAUTHORIZED"));
    });
  });

  describe("io.on('connection') handler", () => {
    it("joins projectId room when present in handshake query", () => {
      createSocketServer(fakeHttpServer);
      const [handler] = getMockIoInstance()._connectionHandlers;
      if (!handler) throw new Error("connection handler not registered");

      const { socket, joinMock } = makeSocketMock({ projectId: "proj-abc" });
      handler(socket);

      expect(joinMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-abc`);
    });

    it("skips join when projectId is absent", () => {
      createSocketServer(fakeHttpServer);
      const [handler] = getMockIoInstance()._connectionHandlers;
      if (!handler) throw new Error("connection handler not registered");

      const { socket, joinMock } = makeSocketMock();
      handler(socket);

      expect(joinMock).not.toHaveBeenCalled();
    });

    it("skips join when projectId is an empty string", () => {
      createSocketServer(fakeHttpServer);
      const [handler] = getMockIoInstance()._connectionHandlers;
      if (!handler) throw new Error("connection handler not registered");

      const { socket, joinMock } = makeSocketMock({ projectId: "" });
      handler(socket);

      expect(joinMock).not.toHaveBeenCalled();
    });

    it("registers 3 presence handlers per connection", () => {
      createSocketServer(fakeHttpServer);
      const [handler] = getMockIoInstance()._connectionHandlers;
      if (!handler) throw new Error("connection handler not registered");

      const { socket, onMock } = makeSocketMock();
      handler(socket);

      expect(onMock).toHaveBeenCalledTimes(4);

      const registeredEvents = vi.mocked(onMock).mock.calls.map(([event]) => event);
      expect(registeredEvents).toContain(SOCKET_EVENTS.TASK_TYPING);
      expect(registeredEvents).toContain(SOCKET_EVENTS.PRESENCE_CURSOR);
      expect(registeredEvents).toContain("disconnecting");
      expect(registeredEvents).toContain("disconnect");
    });
  });
});

describe("getConnectedCount", () => {
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

describe("socket connection - metrics tracking", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    getMockIoInstance()._reset();
  });

  it("increments socketConnectedClients gauge on connection", () => {
    // Import is already mocked via vi.mock("socket.io") above
    // We just verify the connection handler calls appCollectors.socketConnectedClients.inc
    const incSpy = vi.spyOn(appCollectors.socketConnectedClients, "inc");

    createSocketServer(fakeHttpServer);
    const [handler] = getMockIoInstance()._connectionHandlers;
    if (!handler) throw new Error("connection handler not registered");

    const { socket } = makeSocketMock();
    handler(socket);

    expect(incSpy).toHaveBeenCalledOnce();
  });

  it("decrements socketConnectedClients gauge on disconnect", () => {
    const decSpy = vi.spyOn(appCollectors.socketConnectedClients, "dec");

    createSocketServer(fakeHttpServer);
    const [handler] = getMockIoInstance()._connectionHandlers;
    if (!handler) throw new Error("connection handler not registered");

    const { socket, handlers } = makeSocketMock();
    handler(socket);

    // Simulate disconnect event
    handlers.disconnect?.();

    expect(decSpy).toHaveBeenCalledOnce();
  });
});
