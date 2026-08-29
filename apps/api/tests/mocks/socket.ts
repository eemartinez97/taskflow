import { type MockInstance, vi } from "vitest";

import type { AppServer, AppSocket, SocketData } from "../../src/socket/events";
import { VALID_USER } from "../helpers";

/**
 * Explicit type annotations on every vi.fn() are required: an un-annotated
 * vi.fn() infers `Procedure` from @vitest/spy, which TypeScript cannot name
 * in declaration files (declaration:true + isolatedModules:true).
 */
export type EmitMock = MockInstance<(event: string, payload: unknown) => boolean>;

/** Shape of the objects returned by io.in(room).fetchSockets(). */
export interface RemoteSocketLike {
  id: string;
  data: SocketData;
  /** Own emit mock per peer - broadcastPresenceHeartbeat emits per-recipient, not room-wide. */
  emit: EmitMock;
}

// ---------------------------------------------------------------- Helpers

const DEFAULT_SOCKET_DATA: SocketData = {
  userId: VALID_USER.id,
  userEmail: "user@example.com",
  userName: "Sofia",
  color: "#3B82F6",
};

/** Centralized default SocketData to ensure consistency across peers and sockets */
function getDefaultSocketData(overrides: Partial<SocketData> = {}): SocketData {
  return {
    ...DEFAULT_SOCKET_DATA,
    ...overrides,
  };
}

// ---------------------------------------------------------------- emit chain

export const mockEmit: EmitMock = vi.fn();

/** Shape helpers to reduce verbosity in MockInstance typings */
interface EmitChain {
  emit: EmitMock;
}
type ExceptChain = EmitChain & { except: MockInstance<(id: string) => EmitChain> };

/** io.to(room).except(id).emit(...) - used by emitLeaveIfLastSocket. */
export const mockExcept: MockInstance<(id: string) => EmitChain> = vi.fn();

/** io.to(room).emit(...) and io.to(room).except(...) */
export const mockTo: MockInstance<(room: string) => ExceptChain> = vi.fn();

/** io.in(room).fetchSockets() */
export const mockFetchSockets: MockInstance<() => Promise<RemoteSocketLike[]>> = vi.fn();

export const mockIn: MockInstance<(room: string) => { fetchSockets: typeof mockFetchSockets }> =
  vi.fn();

/** io.of("/").sockets.size (getConnectedCount) and io.of("/").adapter.rooms (broadcastPresenceHeartbeat). */
export const mockOf: MockInstance<
  (ns: string) => { sockets: { size: number }; adapter: { rooms: Map<string, Set<string>> } }
> = vi.fn();

const _ioBase = { to: mockTo, in: mockIn, of: mockOf };

/** Injected as `io` into service/router functions (typed as AppServer). */
export const mockIo = _ioBase as unknown as AppServer;

/** Alias kept for presence/server tests that import it by name. */
export const mockAppServer = _ioBase as unknown as AppServer;

function defaultSocketMockState(): {
  sockets: { size: number };
  adapter: { rooms: Map<string, Set<string>> };
} {
  return { sockets: { size: 0 }, adapter: { rooms: new Map() } };
}

/**
 * Backing state for mockOf's return value. setSocketCount and setAdapterRooms
 * each only care about one half of this shape - merging (not replacing) means
 * calling one after the other doesn't silently drop the other's configuration.
 */
let socketMockState = defaultSocketMockState();

/**
 * Re-applies every chained return value. `vi.resetAllMocks()` (run globally in
 * tests/setup.ts) strips `.mockReturnValue()`, so this must run after it.
 */
export function armSocketMocks(): void {
  mockEmit.mockReturnValue(true);
  mockExcept.mockReturnValue({ emit: mockEmit });
  mockTo.mockReturnValue({ emit: mockEmit, except: mockExcept });
  mockFetchSockets.mockResolvedValue([]);
  mockIn.mockReturnValue({ fetchSockets: mockFetchSockets });
  socketMockState = defaultSocketMockState();
  mockOf.mockReturnValue(socketMockState);
}

/** Controls what io.in(room).fetchSockets() resolves with. */
export function setRoomPeers(peers: RemoteSocketLike[]): void {
  mockFetchSockets.mockResolvedValue(peers);
}

/** Controls the socket count for io.of("/").sockets.size - preserves any adapter rooms already set. */
export function setSocketCount(size: number): void {
  socketMockState = { ...socketMockState, sockets: { size } };
  mockOf.mockReturnValue(socketMockState);
}

/** Controls the room registry for io.of("/").adapter.rooms - preserves any socket count already set. */
export function setAdapterRooms(rooms: Map<string, Set<string>>): void {
  socketMockState = { ...socketMockState, adapter: { rooms } };
  mockOf.mockReturnValue(socketMockState);
}

/** Builds a peer entry for setRoomPeers(). */
export function makePeer(overrides: Partial<SocketData> & { id?: string } = {}): RemoteSocketLike {
  const data = getDefaultSocketData(overrides);
  return {
    id: overrides.id ?? `socket-${data.userId}`,
    data,
    emit: vi.fn(() => true),
  };
}

// ------------------------------------------------------- AppSocket mock

type HandlerStore = Record<string, ((...args: unknown[]) => void) | undefined>;

export interface MockSocketResult {
  socket: AppSocket;
  rooms: Set<string>;
  joinMock: MockInstance<(room: string) => Promise<void>>;
  leaveMock: MockInstance<(room: string) => Promise<void>>;
  broadcastToMock: MockInstance<(room: string) => EmitChain>;
  onMock: MockInstance<(event: string, fn: (...args: unknown[]) => void) => AppSocket>;
  /** socket.emit(...) - used by presence:async */
  emitMock: EmitMock;
  /** Fires a handler registered through socket.on(event, ...) */
  fire: (event: string, ...args: unknown[]) => void;
  handlerNames: () => string[];
}

export interface MockSocketOpts extends Partial<SocketData> {
  /** Injected into handshake.query.projectId */
  projectId?: string;
  /** Injected into handshake.query.boardId */
  boardId?: string;
  /** Injected into handshake.headers.cookie (needed by authenticateSocket) */
  cookie?: string;
  /** Extra rooms the socket already belongs to */
  rooms?: string[];
}

export function makeSocketMock(opts: MockSocketOpts = {}): MockSocketResult {
  const data = getDefaultSocketData(opts);
  const socketId = `socket-${data.userId}`;
  const rooms = new Set<string>([socketId, ...(opts.rooms ?? [])]);
  const handlers: HandlerStore = {};

  const joinMock = vi.fn((room: string) => {
    rooms.add(room);
    return Promise.resolve();
  });

  const leaveMock = vi.fn((room: string) => {
    rooms.delete(room);
    return Promise.resolve();
  });

  const emitMock: EmitMock = vi.fn(() => true);
  const broadcastToMock: MockInstance<(room: string) => EmitChain> = vi.fn(() => ({
    emit: mockEmit,
  }));

  const onMock: MockInstance<(event: string, fn: (...args: unknown[]) => void) => AppSocket> =
    vi.fn((event: string, fn) => {
      handlers[event] = fn;
      return socket;
    });

  const socket = {
    id: socketId,
    data,
    rooms,
    handshake: {
      query: {
        projectId: opts.projectId,
        boardId: opts.boardId,
      },
      headers: opts.cookie === undefined ? {} : { cookie: opts.cookie },
    },
    join: joinMock,
    leave: leaveMock,
    emit: emitMock,
    to: vi.fn(() => ({ emit: mockEmit })),
    broadcast: { to: broadcastToMock },
    on: onMock,
  } as unknown as AppSocket;

  const fire = (event: string, ...args: unknown[]): void => {
    const handler = handlers[event];
    if (!handler) throw new Error(`No handler registered for "${event}"`);
    handler(...args);
  };

  const handlerNames = (): string[] => Object.keys(handlers);

  return {
    socket,
    rooms,
    joinMock,
    leaveMock,
    broadcastToMock,
    onMock,
    emitMock,
    fire,
    handlerNames,
  };
}

// ------------------------------------------------------------- makeIoMock

/** Minimal AppServer whose default namespace reports `size` sockets. */
export function makeIoMock(size: number): AppServer {
  return { of: () => ({ sockets: { size } }) } as unknown as AppServer;
}
