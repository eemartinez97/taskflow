import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { SOCKET_ROOM_PREFIX, SOCKET_USER_ROOM_PREFIX } from "@taskflow/shared";

import { appCollectors } from "../../../src/metrics";
import {
  announceOfflineIfLast,
  announceOnlineIfFirst,
  broadcastPresenceHeartbeat,
  buildOnlineSync,
  createPresenceHelpers,
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  registerPresenceHandlers,
  resolveColor,
} from "../../../src/socket/presence";
import {
  authenticateSocket,
  createSocketServer,
  getConnectedCount,
} from "../../../src/socket/server";
import { makeSessionUser, VALID_ORG_ID, VALID_PROJECT_ID, VALID_USER } from "../../helpers";
import type * as presenceModule from "../../../src/socket/presence";
vi.mock("socket.io", () => import("../../mocks/socket-io-module"));
import { getMockIoInstance } from "../../mocks/socket-io-module";
import { makeIoMock, makeSocketMock } from "../../mocks/socket";
import { getSessionUser } from "../../../src/utils/auth";
import { mockLogger } from "../../mocks/logger";
import { findUserOrgIds } from "../../../src/socket/presence-repo";

vi.mock("../../../src/utils/auth");

const joinBoardRoom = vi.fn();

vi.mock("../../../src/socket/presence", async (importOriginal) => {
  const actual = await importOriginal<typeof presenceModule>();

  return {
    ...actual,
    // resolveColor stays real - authenticateSocket depends on it
    createPresenceHelpers: vi.fn(() => ({ joinBoardRoom })),
    registerPresenceHandlers: vi.fn(),
    announceOnlineIfFirst: vi.fn(),
    announceOfflineIfLast: vi.fn(),
    buildOnlineSync: vi.fn(),
    broadcastPresenceHeartbeat: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("../../../src/socket/presence-repo", () => ({
  findUserOrgIds: vi.fn(() => [VALID_ORG_ID]),
}));

const inst = getMockIoInstance();
const httpServer = {} as HttpServer;

// createSocketServer starts a real, unref'd setInterval (the presence
// heartbeat) on every call with no way to stop it from the outside. Most
// tests below call it with real timers active, so left untracked each one
// leaks a live 15s interval into the test worker for the rest of the run -
// a late unrelated test can then observe a stray broadcastPresenceHeartbeat
// call from a stale interval's closure. Capture every interval this file
// creates and clear it in afterEach; the two "presence heartbeat" tests use
// vi.useFakeTimers() themselves, which discards their fake interval on
// vi.useRealTimers() and never goes through this real setInterval at all.
const realSetInterval = global.setInterval;
let createdIntervals: NodeJS.Timeout[] = [];

beforeEach(() => {
  inst._reset();
  joinBoardRoom.mockReset();
  appCollectors.socketConnectedClients.reset();

  createdIntervals = [];
  vi.spyOn(global, "setInterval").mockImplementation((...args: Parameters<typeof setInterval>) => {
    const id = Reflect.apply(realSetInterval, global, args);
    createdIntervals.push(id);
    return id;
  });
});

afterEach(() => {
  for (const id of createdIntervals) clearInterval(id);
});

describe("authenticateSocket", () => {
  it("attaches identity and color to socket.data on success", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(makeSessionUser());
    const { socket } = makeSocketMock({ cookie: "next-auth.session-token=abc" });
    const next = vi.fn();

    await authenticateSocket(socket, next);

    expect(getSessionUser).toHaveBeenCalledWith("next-auth.session-token=abc");
    expect(socket.data).toEqual({
      userId: VALID_USER.id,
      userEmail: VALID_USER.email,
      userName: "Alice",
      color: resolveColor(VALID_USER.id),
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("keeps a null display name", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(makeSessionUser({ name: null }));
    const { socket } = makeSocketMock({ cookie: "c=1" });

    await authenticateSocket(socket, vi.fn());

    expect(socket.data.userName).toBeNull();
  });

  it("rejects handshakes without a valid session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    const next = vi.fn();

    await authenticateSocket(makeSocketMock().socket, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "UNAUTHORIZED" }));
  });

  it("logs and rejects when session verification throws", async () => {
    const boom = new Error("jose exploded");
    vi.mocked(getSessionUser).mockRejectedValue(boom);
    const next = vi.fn();

    await authenticateSocket(makeSocketMock().socket, next);

    expect(mockLogger.error).toHaveBeenCalledWith({ err: boom }, "Socket auth error");
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "UNAUTHORIZED" }));
  });
});

describe("createSocketServer", () => {
  it("configures CORS and connection state recovery", () => {
    createSocketServer(httpServer);

    expect(Server).toHaveBeenCalledWith(httpServer, {
      cors: { origin: "http://localhost:3000", credentials: true },
      connectionStateRecovery: {},
    });
  });

  it("registers the handshake auth middleware", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(makeSessionUser());
    createSocketServer(httpServer);

    const { socket } = makeSocketMock({ cookie: "c=1" });
    const next = vi.fn();
    inst._useHandlers[0]?.(socket, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith();
    });
  });

  it("joins the personal room and registers presence handlers on connection", () => {
    const io = createSocketServer(httpServer);
    const { socket, joinMock } = makeSocketMock();

    inst._connectionHandlers[0]?.(socket);

    expect(joinMock).toHaveBeenCalledWith(`${SOCKET_USER_ROOM_PREFIX}${VALID_USER.id}`);
    expect(createPresenceHelpers).toHaveBeenCalledWith(io, socket);
    expect(registerPresenceHandlers).toHaveBeenCalledWith(io, socket);
  });

  it("joins the project room when the handshake carries a projectId", () => {
    createSocketServer(httpServer);
    const { socket, joinMock } = makeSocketMock({ projectId: VALID_PROJECT_ID });
    inst._connectionHandlers[0]?.(socket);
    expect(joinMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}${VALID_PROJECT_ID}`);
  });

  it.each([
    ["no projectId in the query", {}],
    ["an empty projectId", { projectId: "" }],
  ])("does not join a project room with %s", (_name, opts) => {
    createSocketServer(httpServer);
    const { socket, joinMock } = makeSocketMock(opts);
    inst._connectionHandlers[0]?.(socket);
    expect(joinMock).not.toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}${VALID_PROJECT_ID}`);
  });

  it("tracks the connected-clients gauge", async () => {
    createSocketServer(httpServer);
    const { socket, fire } = makeSocketMock();

    inst._setConnectedCount(1);
    inst._connectionHandlers[0]?.(socket);
    expect((await appCollectors.socketConnectedClients.get()).values[0]?.value).toBe(1);

    inst._setConnectedCount(0);
    fire("disconnect");
    expect((await appCollectors.socketConnectedClients.get()).values[0]?.value).toBe(0);
  });

  it("logs connect and disconnect at debug level", () => {
    createSocketServer(httpServer);
    const { socket, fire } = makeSocketMock();

    inst._connectionHandlers[0]?.(socket);
    fire("disconnect");

    expect(mockLogger.debug).toHaveBeenCalledWith(
      { userId: VALID_USER.id, socketId: socket.id },
      "Socket connected",
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      { userId: VALID_USER.id, socketId: socket.id },
      "Socket disconnected",
    );
  });
});

describe("presence heartbeat", () => {
  it("re-broadcasts the presence roster on an unref'd interval", () => {
    vi.useFakeTimers();
    const io = createSocketServer(httpServer);

    expect(broadcastPresenceHeartbeat).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PRESENCE_HEARTBEAT_INTERVAL_MS);

    expect(broadcastPresenceHeartbeat).toHaveBeenCalledWith(io);
    vi.useRealTimers();
  });

  it("logs instead of throwing when the heartbeat rejects", async () => {
    const boom = new Error("adapter exploded");
    vi.mocked(broadcastPresenceHeartbeat).mockRejectedValueOnce(boom);
    vi.useFakeTimers();
    createSocketServer(httpServer);

    vi.advanceTimersByTime(PRESENCE_HEARTBEAT_INTERVAL_MS);
    vi.useRealTimers();

    await vi.waitFor(() => {
      expect(mockLogger.error).toHaveBeenCalledWith({ err: boom }, "Presence heartbeat failed");
    });
  });
});

describe("getConnectedCount", () => {
  it.each([0, 1, 42])("reports %i sockets on the default namespace", (size) => {
    expect(getConnectedCount(makeIoMock(size))).toBe(size);
  });
});

describe("global org presence", () => {
  it("joins the user's org rooms and announces online + sync on connection", async () => {
    const io = createSocketServer(httpServer);
    const { socket, joinMock } = makeSocketMock();

    inst._connectionHandlers[0]?.(socket);

    await vi.waitFor(() => {
      expect(findUserOrgIds).toHaveBeenCalledWith(expect.anything(), VALID_USER.id);
      expect(joinMock).toHaveBeenCalledWith(`org:${VALID_ORG_ID}`);
      expect(announceOnlineIfFirst).toHaveBeenCalledWith(io, socket, [VALID_ORG_ID]);
      expect(buildOnlineSync).toHaveBeenCalledWith(io, socket, [VALID_ORG_ID]);
    });
  });

  it("announces offline on disconnecting", async () => {
    const io = createSocketServer(httpServer);
    const { socket, fire, handlerNames } = makeSocketMock();

    inst._connectionHandlers[0]?.(socket);
    await vi.waitFor(() => {
      expect(handlerNames()).toContain("disconnecting");
    });

    fire("disconnecting");

    expect(announceOfflineIfLast).toHaveBeenCalledWith(io, socket, [VALID_ORG_ID]);
  });
});
