/**
 * Manual mock for the "socket.io" module.
 *
 * Activated in test via:
 *  vi.mock("socket.io", () => import("@/tests/mocks/socket-io-module));
 *
 * HOW to access the captured handlers in tests:
 *  import { getMockIoInstance } from "../mocks/socket-io-module
 *  const inst = getMockIoInstance();
 *  inst._useHandlers[0]?.(socket, next)
 */

import { vi } from "vitest";

// Handler stores - module-level so getMockIoInstance() always returns
// the same reference that the Server constructor registered into.
const useHandlers: ((socket: unknown, next: (err?: Error) => void) => void)[] = [];
const connectionHandlers: ((socket: unknown) => void)[] = [];
// Tracks connected sockets for getConnectedCount() -> io.of("/").sockets.size
const socketsMap = new Map<string, unknown>();

export const mockIoInstance = {
  use: vi.fn((fn: (socket: unknown, next: (err?: Error) => void) => void) => {
    useHandlers.push(fn);
  }),
  on: vi.fn((event: string, fn: (socket: unknown) => void) => {
    if (event === "connection") {
      connectionHandlers.push(fn);
    }

    // The real Server.on() returns `this` for chaining.
    return mockIoInstance;
  }),
  close: vi.fn((cb: () => void) => {
    cb();
  }),
  // Implements io.of("/") so getConnectedCount(io) resolves correctly
  of: vi.fn(() => ({ sockets: socketsMap })),

  // Internal helpers for test assertions - not part of the real Server API
  _useHandlers: useHandlers,
  _connectionHandlers: connectionHandlers,
  _reset: (): void => {
    useHandlers.length = 0;
    socketsMap.clear();
    connectionHandlers.length = 0;
    vi.mocked(mockIoInstance.use).mockClear();
    vi.mocked(mockIoInstance.on).mockClear();
    vi.mocked(mockIoInstance.of).mockClear();
  },
  // Simulates N connected sockets - used by gauge tests
  _setConnectedCount: (n: number): void => {
    socketsMap.clear();
    for (let i = 0; i < n; i++) socketsMap.set(String(i), {});
  },
};

/** Returns the singleton mock instance - use this in tests instead of importing mockIoInstance directly */
export function getMockIoInstance(): typeof mockIoInstance {
  return mockIoInstance;
}

// This IS the module mock: export `Server` as vi.fn() constructor
export const Server = vi.fn(function MockServer(this: unknown, ..._args: unknown[]) {
  return mockIoInstance;
});
