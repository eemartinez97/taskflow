import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  presenceCursorSchema,
  presenceUserSchema,
  SOCKET_BOARD_ROOM_PREFIX,
  SOCKET_EVENTS,
} from "@taskflow/shared";

import {
  makePeer,
  makeSocketMock,
  mockAppServer,
  mockEmit,
  mockExcept,
  mockFetchSockets,
  mockIn,
  mockTo,
  setRoomPeers,
} from "../../mocks/socket";
import {
  announceOfflineIfLast,
  announceOnlineIfFirst,
  broadcastProfileNameUpdate,
  buildOnlineSync,
  createPresenceHelpers,
  PRESENCE_COLORS,
  registerPresenceHandlers,
  resolveColor,
} from "../../../src/socket/presence";
import { ANOTHER_UUID, db, VALID_ORG_ID, VALID_PROJECT_ID, VALID_USER } from "../../helpers";
import { mockDb } from "../../mocks/database-mock";
import { shouldDropPresencePacket } from "../../../src/socket/rate-limit";
import type * as sharedModule from "@taskflow/shared";
import { mockLogger } from "../../mocks/logger";

vi.mock("../../../src/socket/rate-limit");

vi.mock("@taskflow/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof sharedModule>();

  return {
    ...actual,
    // Schema validation belongs to the shared package's own tests; here we
    // only care that presence.ts honours success/failure.
    presenceCursorSchema: { safeParse: vi.fn() },
    presenceUserSchema: { safeParse: vi.fn() },
  };
});

const ROOM = `${SOCKET_BOARD_ROOM_PREFIX}${VALID_PROJECT_ID}`;
const cursorParse = vi.mocked(presenceCursorSchema.safeParse);
const userParse = vi.mocked(presenceUserSchema.safeParse);

const PRESENCE_USER = { userId: VALID_USER.id, name: "Alice", color: "#3B82F6" };

beforeEach(() => {
  vi.mocked(shouldDropPresencePacket).mockReturnValue(false);
  cursorParse.mockReturnValue({ success: true, data: { x: 1, y: 2 } } as never);
  userParse.mockReturnValue({ success: true, data: PRESENCE_USER } as never);
});

describe("resolveColor", () => {
  it("is deterministic for the same userId", () => {
    expect(resolveColor(VALID_USER.id)).toBe(resolveColor(VALID_USER.id));
  });

  it("always returns a color from the palette", () => {
    const palette = new Set<string>(PRESENCE_COLORS);

    for (const id of ["", "a", VALID_USER.id, ANOTHER_UUID, "x".repeat(200)]) {
      expect(palette.has(resolveColor(id))).toBe(true);
    }
  });

  it("spreads different users across the palette", () => {
    const colors = new Set(Array.from({ length: 50 }, (_, i) => resolveColor(`user-${String(i)}`)));

    expect(colors.size).toBeGreaterThan(1);
  });
});

describe("registerPresenceHandlers", () => {
  it("registers exactly the three expected listeners", () => {
    const { socket, handlerNames } = makeSocketMock({ rooms: [ROOM] });

    registerPresenceHandlers(mockAppServer, socket);

    expect(handlerNames().sort()).toEqual(
      [
        SOCKET_EVENTS.TASK_TYPING,
        SOCKET_EVENTS.PRESENCE_CURSOR,
        SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE,
        "disconnecting",
      ].sort(),
    );
  });

  it("relays task:typing to each project room with the server-side userId", () => {
    const { socket, fire, broadcastToMock } = makeSocketMock({ rooms: [ROOM] });
    registerPresenceHandlers(mockAppServer, socket);

    fire(SOCKET_EVENTS.TASK_TYPING, { taskId: "t1", userId: "SPOOFED" });

    expect(broadcastToMock).toHaveBeenCalledWith(ROOM);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_TYPING, {
      taskId: "t1",
      userId: VALID_USER.id, // never trusts the client-supplied id
    });
  });

  it("drops malformed presence:cursor packets silently", () => {
    cursorParse.mockReturnValue({ success: false, error: {} } as never);
    const { socket, fire } = makeSocketMock({ rooms: [ROOM] });
    registerPresenceHandlers(mockAppServer, socket);

    fire(SOCKET_EVENTS.PRESENCE_CURSOR, { junk: true });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("relays a valid presence:cursor packet", () => {
    const { socket, fire, broadcastToMock } = makeSocketMock({ rooms: [ROOM] });
    registerPresenceHandlers(mockAppServer, socket);

    fire(SOCKET_EVENTS.PRESENCE_CURSOR, { x: 1, y: 2 });

    expect(broadcastToMock).toHaveBeenCalledWith(ROOM);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_CURSOR, { x: 1, y: 2 });
  });

  it("drops rate-limited cursor packets and logs at debug level", () => {
    vi.mocked(shouldDropPresencePacket).mockReturnValue(true);
    const { socket, fire } = makeSocketMock({ rooms: [ROOM] });
    registerPresenceHandlers(mockAppServer, socket);

    fire(SOCKET_EVENTS.PRESENCE_CURSOR, { x: 1, y: 2 });

    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      { room: ROOM, userId: VALID_USER.id },
      "Presence packet dropped (rate limit)",
    );
  });

  it("broadcasts presence:leave for every project room on disconnecting", async () => {
    const secondRoom = `${SOCKET_BOARD_ROOM_PREFIX}other`;
    const { socket, fire } = makeSocketMock({ rooms: [ROOM, secondRoom] });
    registerPresenceHandlers(mockAppServer, socket);

    fire("disconnecting");
    await vi.waitFor(() => {
      expect(mockExcept).toHaveBeenCalledTimes(2);
    });

    expect(mockTo).toHaveBeenCalledWith(ROOM);
    expect(mockTo).toHaveBeenCalledWith(secondRoom);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_LEAVE, {
      userId: VALID_USER.id,
    });
  });
});

describe("announceOnlineIfFirst", () => {
  it("broadcasts presence:online to every org room on the first socket", async () => {
    const { socket } = makeSocketMock();
    setRoomPeers([]); // personal room empty -> first socket

    await announceOnlineIfFirst(mockAppServer, socket, [VALID_ORG_ID, ANOTHER_UUID]);

    expect(mockTo).toHaveBeenCalledWith(`org:${VALID_ORG_ID}`);
    expect(mockTo).toHaveBeenCalledWith(`org:${ANOTHER_UUID}`);
    expect(mockExcept).toHaveBeenCalledWith(socket.id);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_ONLINE, {
      userId: VALID_USER.id,
    });
  });

  it("stays silent when another socket of the same user is already online", async () => {
    const { socket } = makeSocketMock();
    setRoomPeers([makePeer({ id: "other-tab", userId: VALID_USER.id })]);

    await announceOnlineIfFirst(mockAppServer, socket, [VALID_ORG_ID]);

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("emits nothing when the user has no orgs", async () => {
    const { socket } = makeSocketMock();
    setRoomPeers([]); // first socket, but no orgs to notify

    await announceOnlineIfFirst(mockAppServer, socket, []);

    expect(mockTo).not.toHaveBeenCalled();
  });
});

describe("announceOfflineIfLast", () => {
  it("broadcasts presence:offline (excluding self) on the last socket", async () => {
    const { socket } = makeSocketMock();
    setRoomPeers([]); // no other socket of this user -> last socket

    await announceOfflineIfLast(mockAppServer, socket, [VALID_ORG_ID]);

    expect(mockTo).toHaveBeenCalledWith(`org:${VALID_ORG_ID}`);
    expect(mockExcept).toHaveBeenCalledWith(socket.id);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_OFFLINE, {
      userId: VALID_USER.id,
    });
  });

  it("stays silent while another tab of the same user is still connected", async () => {
    const { socket } = makeSocketMock();
    setRoomPeers([makePeer({ id: "other-tab", userId: VALID_USER.id })]);

    await announceOfflineIfLast(mockAppServer, socket, [VALID_ORG_ID]);

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("buildOnlineSync", () => {
  it("emits the deduped set of online users, excluding self", async () => {
    const { socket, emitMock } = makeSocketMock();
    setRoomPeers([
      makePeer({ id: "a", userId: ANOTHER_UUID }),
      makePeer({ id: "b", userId: ANOTHER_UUID }), // same user, different tab
      makePeer({ id: socket.id }), // self must be filtered out
    ]);

    await buildOnlineSync(mockAppServer, socket, [VALID_ORG_ID]);

    expect(emitMock).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_ONLINE_SYNC, {
      userIds: [ANOTHER_UUID],
    });
  });

  it("emits an empty roster when no orgs are provided", async () => {
    const { socket, emitMock } = makeSocketMock();

    await buildOnlineSync(mockAppServer, socket, []);

    expect(emitMock).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_ONLINE_SYNC, { userIds: [] });
  });
});

describe("PRESENCE_CURSOR_LEAVE handler", () => {
  it("relays cursor leave to every project room with server-side userId", () => {
    const { socket, fire, broadcastToMock } = makeSocketMock({ rooms: [ROOM] });
    registerPresenceHandlers(mockAppServer, socket);

    fire(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE);

    expect(broadcastToMock).toHaveBeenCalledWith(ROOM);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE, {
      userId: VALID_USER.id,
    });
  });

  it("relays to multiple board rooms", () => {
    const secondRoom = `${SOCKET_BOARD_ROOM_PREFIX}other`;
    const { socket, fire, broadcastToMock } = makeSocketMock({ rooms: [ROOM, secondRoom] });
    registerPresenceHandlers(mockAppServer, socket);

    fire(SOCKET_EVENTS.PRESENCE_CURSOR_LEAVE);

    expect(broadcastToMock).toHaveBeenCalledWith(ROOM);
    expect(broadcastToMock).toHaveBeenCalledWith(secondRoom);
    expect(mockEmit).toHaveBeenCalledTimes(2);
  });
});

describe("createPresenceHelpers", () => {
  it("joinBoardRoom broadcasts presence:join and syncs roster on valid payload", async () => {
    const { socket, broadcastToMock, emitMock } = makeSocketMock({ rooms: [] });
    setRoomPeers([
      makePeer({ id: "peer-1", userId: ANOTHER_UUID }),
      makePeer({ id: socket.id, userId: VALID_USER.id }),
    ]);

    const { joinBoardRoom } = createPresenceHelpers(mockAppServer, socket);

    await joinBoardRoom(VALID_PROJECT_ID);

    expect(broadcastToMock).toHaveBeenCalledWith(ROOM);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_JOIN, PRESENCE_USER);
    expect(emitMock).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_SYNC, {
      users: [expect.objectContaining({ userId: ANOTHER_UUID })],
    });
  });

  it("joinBoardRoom returns early when presence payload is invalid", async () => {
    userParse.mockReturnValue({ success: false, error: {} } as never);
    const { socket, broadcastToMock, emitMock } = makeSocketMock({ rooms: [] });
    setRoomPeers([]);

    const { joinBoardRoom } = createPresenceHelpers(mockAppServer, socket);

    await joinBoardRoom(VALID_PROJECT_ID);

    expect(broadcastToMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_SYNC, expect.anything());
  });
});

describe("broadcastProfileNameUpdate", () => {
  it("updates socket.data.userName on every live socket in the user's personal room", async () => {
    const staleSocket = makePeer({ id: "tab-1", userId: VALID_USER.id, userName: "Old Name" });
    mockFetchSockets.mockResolvedValueOnce([staleSocket]);
    mockDb.membership.findMany.mockResolvedValueOnce([]);

    await broadcastProfileNameUpdate(mockAppServer, db, VALID_USER.id, "New Name");

    expect(mockIn).toHaveBeenCalledWith(`user:${VALID_USER.id}`);
    expect(staleSocket.data.userName).toBe("New Name");
  });

  it("broadcasts presence:user-updated to every org the user belongs to", async () => {
    mockFetchSockets.mockResolvedValueOnce([]);
    mockDb.membership.findMany.mockResolvedValueOnce([
      { orgId: VALID_ORG_ID },
      { orgId: ANOTHER_UUID },
    ]);

    await broadcastProfileNameUpdate(mockAppServer, db, VALID_USER.id, "New Name");

    expect(mockTo).toHaveBeenCalledWith(`org:${VALID_ORG_ID}`);
    expect(mockTo).toHaveBeenCalledWith(`org:${ANOTHER_UUID}`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_USER_UPDATED, {
      userId: VALID_USER.id,
      name: "New Name",
    });
  });

  it("emits nothing when the user belongs to no orgs", async () => {
    mockFetchSockets.mockResolvedValueOnce([]);
    mockDb.membership.findMany.mockResolvedValueOnce([]);

    await broadcastProfileNameUpdate(mockAppServer, db, VALID_USER.id, "New Name");

    expect(mockTo).not.toHaveBeenCalled();
  });
});
