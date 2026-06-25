import { type Server } from "socket.io";
import { vi, type MockInstance } from "vitest";
import type { AppServer, AppSocket } from "../../src/socket/presence.js";
import { type SocketData } from "../../src/socket/events.js";
import { VALID_USER } from "../helpers.js";

/**
 * Minimal Socket.IO server mock.
 * Only `to().emit()` is needed — the real Server has ~50 methods.
 *
 * Explicit type annotation on mockEmit is required:
 * vi.fn() without annotation infers a deep internal vitest type
 * (`Procedure` from @vitest/spy) that TypeScript cannot name in
 * declaration files, causing "inferred type cannot be named" errors
 * under `declaration: true` + `isolatedModules: true`.
 *
 * Usage in test files:
 *   import { mockIo, mockEmit } from "../../mocks/socket.js";
 *
 *   beforeEach(() => vi.clearAllMocks());
 *
 *   expect(mockIo.to).toHaveBeenCalledWith("project:abc");
 *   expect(mockEmit).toHaveBeenCalledWith("task:created", { task });
 */
export const mockEmit: MockInstance<(event: string, payload: unknown) => boolean> = vi.fn();

export const mockTo: MockInstance<(room: string) => { emit: typeof mockEmit }> = vi
  .fn()
  .mockReturnValue({ emit: mockEmit });

// Server mocks (two type casts, one underlying spy)

const _ioBase = { to: mockTo };

/** Used by task/comment tests (injected as `io` into service functions). */
export const mockIo = _ioBase as unknown as Server;

/** Used by presence/server tests (typed as AppServer) */
export const mockAppServer = _ioBase as unknown as AppServer;

// AppSocket mock factory

type HandlerStore = Record<string, ((...args: unknown[]) => void) | undefined>;

export interface MockSocketResult {
  socket: AppSocket;
  handlers: HandlerStore;
  rooms: Set<string>;
  /** vi.fn() for socket.join - use this in assertions, not socket.join */
  joinMock: MockInstance<(room: string) => Promise<void>>;
  /** vi.fn() for socket.leave - use this in assertions, not socket.leave */
  leaveMock: MockInstance<(room: string) => Promise<void>>;
  /**
   * vi.fn() for socket.broadcast.to - use this in assertions.
   * Same reference as socket.broadcast.to internally.
   */
  broadcastToMock: MockInstance<(room: string) => { emit: typeof mockEmit }>;
  /** vi.fn() for socket.on - use this or registeredEvents() in assertions */
  onMock: MockInstance<(event: string, fn: (...args: unknown[]) => void) => AppSocket>;
}

export function makeSocketMock(
  opts: Partial<SocketData & { projectId?: string }> = {},
): MockSocketResult {
  const data: SocketData = {
    userId: opts.userId ?? VALID_USER.id,
    userEmail: opts.userEmail ?? "user@example.com",
    userName: opts.userName ?? "Alice",
    color: opts.color ?? "#3B82F6",
  };

  const rooms = new Set([`socket-${data.userId}`]);
  const handlers: HandlerStore = {};

  const joinMock = vi.fn((room: string) => {
    rooms.add(room);
    return Promise.resolve();
  });

  const leaveMock = vi.fn((room: string) => {
    rooms.add(room);
    return Promise.resolve();
  });

  const broadcastToMock: MockInstance<(room: string) => { emit: typeof mockEmit }> = vi
    .fn()
    .mockReturnValue({ emit: mockEmit });

  const onMock: MockInstance<(event: string, fn: (...args: unknown[]) => void) => AppSocket> =
    vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      handlers[event] = fn;
      return socket;
    });

  const socket = {
    id: `socket-${data.userId}`,
    data,
    rooms,
    handshake: { query: opts.projectId ? { projectId: opts.projectId } : {} },
    join: joinMock,
    leave: leaveMock,
    to: vi.fn().mockReturnValue({ emit: mockEmit }),
    broadcast: { to: broadcastToMock },
    on: onMock,
  } as unknown as AppSocket;

  return { socket, handlers, rooms, joinMock, leaveMock, broadcastToMock, onMock };
}

// makeIoMock

export interface IoMock {
  io: AppServer;
  /** Direct reference to the spy - avoids unbound-method limit error in tests */
  ofSpy: ReturnType<typeof vi.fn>;
}

/**
 * Builds a minimal AppServer mock with a controllable socket count.
 *
 * Parameter intentionally omitted from the arrow function - it is unused
 * and omitting avoids the `no-unused-vars` lint warning.
 */

export function makeIoMock(size: number): AppServer {
  return {
    of: () => ({ sockets: { size } }),
  } as unknown as AppServer;
}
