import { beforeEach, describe, expect, it, vi } from "vitest";

import { HEX_COLOR_REGEX, SOCKET_EVENTS, SOCKET_ROOM_PREFIX } from "@taskflow/shared";

import {
  createPresenceHelpers,
  registerPresenceHandlers,
  resolveColor,
} from "../../../src/socket/presence";

import { makeSocketMock, mockAppServer, mockTo } from "../../mocks/socket";
import { mockEmit } from "../../mocks/socket";
import { VALID_USER } from "../../helpers";

const MOCK_CURSOR_PAYLOAD = { userId: VALID_USER.id, x: 100, y: 200 };

describe("resolveColor", () => {
  it("returns a valid 6-digit hex color", () => {
    expect(resolveColor("user-abc")).toMatch(HEX_COLOR_REGEX);
  });

  it("is deterministic - same userId always returns the same color", () => {
    expect(resolveColor("user-123")).toBe(resolveColor("user-123"));
  });

  it("two users with different ids may get different colors", () => {
    // We can't guarantee they differ (8-slot palette), but both must be valid
    expect(resolveColor("aaaa")).toMatch(HEX_COLOR_REGEX);
    expect(resolveColor("zzzz")).toMatch(HEX_COLOR_REGEX);
  });

  it("does not throw for an empty string userId", () => {
    expect(() => resolveColor("")).not.toThrow();
  });
});

describe("createPresenceHelpers - joinProjectRoom", () => {
  beforeEach(() => vi.clearAllMocks());

  it("joins the correct room", () => {
    const { socket, joinMock } = makeSocketMock();
    const { joinProjectRoom } = createPresenceHelpers(mockAppServer, socket);

    joinProjectRoom("proj-1");

    expect(joinMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-1`);
  });

  it("broadcast presence:join with userId, name, and color", () => {
    const data = { userName: "Alice", color: "#EF4444" };
    const { socket, broadcastToMock } = makeSocketMock(data);
    const { joinProjectRoom } = createPresenceHelpers(mockAppServer, socket);

    joinProjectRoom("proj-1");

    expect(broadcastToMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-1`);
    expect(mockEmit).toHaveBeenCalledWith(
      SOCKET_EVENTS.PRESENCE_JOIN,
      expect.objectContaining({
        userId: socket.data.userId,
        name: data.userName,
        color: data.color,
      }),
    );
  });

  it("does not emit when color is invalid (safeParse fails)", () => {
    const { socket } = makeSocketMock({ color: "not-a-hex-color" });
    const { joinProjectRoom } = createPresenceHelpers(mockAppServer, socket);

    joinProjectRoom("proj-bad");

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("createPresenceHelpers - leaveProjectRoom", () => {
  it("broadcast presence:leave then leaves the room", () => {
    const { socket, broadcastToMock, leaveMock } = makeSocketMock();
    const { leaveProjectRoom } = createPresenceHelpers(mockAppServer, socket);

    leaveProjectRoom("proj-2");

    expect(broadcastToMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-2`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_LEAVE, {
      userId: socket.data.userId,
    });
    expect(leaveMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-2`);
  });
});

describe("registerPresenceHandlers - task:typing", () => {
  it("delays task:typing with userId to all project rooms", () => {
    const { socket, handlers, rooms, broadcastToMock } = makeSocketMock();
    rooms.add(`${SOCKET_ROOM_PREFIX}proj-A`);
    rooms.add(`${SOCKET_ROOM_PREFIX}proj-B`);

    registerPresenceHandlers(mockAppServer, socket);
    handlers[SOCKET_EVENTS.TASK_TYPING]?.({ taskId: "task-1", projectId: "proj-A" });

    expect(broadcastToMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-A`);
    expect(broadcastToMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-B`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_TYPING, {
      taskId: "task-1",
      userId: socket.data.userId,
    });
  });

  it("does not relay when socket is in no project rooms", () => {
    const { socket, handlers } = makeSocketMock();

    registerPresenceHandlers(mockAppServer, socket);
    handlers[SOCKET_EVENTS.TASK_TYPING]?.({ taskId: "t-1", projectId: "any" });

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("registerPresenceHandler - presence:cursor", () => {
  it("relays a valid cursor payload to project rooms", () => {
    const { socket, handlers, rooms, broadcastToMock } = makeSocketMock();
    rooms.add(`${SOCKET_ROOM_PREFIX}proj-C`);

    registerPresenceHandlers(mockAppServer, socket);
    handlers[SOCKET_EVENTS.PRESENCE_CURSOR]?.(MOCK_CURSOR_PAYLOAD);

    expect(broadcastToMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-C`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_CURSOR, MOCK_CURSOR_PAYLOAD);
  });

  it("silently drops a malformed cursor payload", () => {
    const { socket, handlers } = makeSocketMock();

    registerPresenceHandlers(mockAppServer, socket);
    // x and y missing - presenceCursorSchema.safeParse fails
    handlers[SOCKET_EVENTS.PRESENCE_CURSOR]?.({ userId: VALID_USER.id });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("drops packets after 30/s rate limit is exceeded", () => {
    const { socket, handlers, rooms } = makeSocketMock();
    rooms.add(`${SOCKET_ROOM_PREFIX}proj-rl`);

    registerPresenceHandlers(mockAppServer, socket);

    for (let i = 0; i < 31; i++) {
      handlers[SOCKET_EVENTS.PRESENCE_CURSOR]?.(MOCK_CURSOR_PAYLOAD);
    }

    // 30 allowed, 31st dropped
    expect(mockEmit).toHaveBeenCalledTimes(30);
  });
});

describe("registerPresenceHandlers - disconnecting", () => {
  it("registers 'disconnecting' - NOT 'disconnect'", () => {
    const { socket, onMock } = makeSocketMock();

    registerPresenceHandlers(mockAppServer, socket);

    const registeredEvents = vi.mocked(onMock).mock.calls.map(([event]) => event);
    expect(registeredEvents).toContain("disconnecting");
    expect(registeredEvents).not.toContain("disconnect");
  });

  it("broadcast presence:leave to all project rooms", () => {
    const { socket, handlers, rooms, broadcastToMock } = makeSocketMock();
    rooms.add(`${SOCKET_ROOM_PREFIX}proj-A`);
    rooms.add(`${SOCKET_ROOM_PREFIX}proj-B`);

    registerPresenceHandlers(mockAppServer, socket);
    handlers.disconnecting?.();

    expect(broadcastToMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-A`);
    expect(broadcastToMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-B`);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_LEAVE, {
      userId: socket.data.userId,
    });
  });

  it("does not emit when socket has no project rooms", () => {
    const { socket, handlers } = makeSocketMock();

    registerPresenceHandlers(mockAppServer, socket);
    handlers.disconnecting?.();

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("ignores not-project rooms", () => {
    const { socket, handlers, rooms, broadcastToMock } = makeSocketMock();
    rooms.add("admin:internal");
    rooms.add(`${SOCKET_ROOM_PREFIX}proj-C`);

    registerPresenceHandlers(mockAppServer, socket);
    handlers.disconnecting?.();

    expect(broadcastToMock).not.toHaveBeenCalledWith("admin:internal");
    expect(broadcastToMock).toHaveBeenCalledWith(`${SOCKET_ROOM_PREFIX}proj-C`);
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });
});

describe("registerPresenceHandlers - event registration", () => {
  it("registers exactly 3 handlers: task:typing, presence:cursor, disconnecting", () => {
    const { socket, onMock } = makeSocketMock();

    registerPresenceHandlers(mockAppServer, socket);

    expect(onMock).toHaveBeenCalledTimes(3);
    expect(onMock).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_TYPING, expect.any(Function));
    expect(onMock).toHaveBeenCalledWith(SOCKET_EVENTS.PRESENCE_CURSOR, expect.any(Function));
    expect(onMock).toHaveBeenCalledWith("disconnecting", expect.any(Function));
  });
});

describe("mockAppServer shape (used by createPresenceHelpers via io.to)", () => {
  it("mockServerTo delegates to mockEmit", () => {
    mockAppServer.to("any-room").emit(SOCKET_EVENTS.TASK_DELETED, { taskId: "task-1" });

    expect(mockTo);
    expect(mockEmit).toHaveBeenCalledWith(SOCKET_EVENTS.TASK_DELETED, { taskId: "task-1" });
  });
});
