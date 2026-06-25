/**
 * Manual mock for the "socket.io" module.
 *
 * Activated in test via:
 *  vi.mock("socket.io", () => import("../mocks/socket-io-module.js"));
 *
 * HOW to access the captured handlers in tests:
 *  import { getMockIoInstance } from "../mocks/socket-io-module.js"
 *  const inst = getMockIoInstance();
 *  inst._useHandlers[0]?.(socket, next)
 */

import { vi } from "vitest";

// Handler stores - module-level so getMockIoInstance() always returns
// the same reference that the Server constructor registered into.
const useHandlers: ((socket: unknown, next: (err?: Error) => void) => void)[] = [];
const connectionHandlers: ((socket: unknown) => void)[] = [];

export const mockIoInstance = {
  use: vi.fn((fn: (socket: unknown, next: (err?: Error) => void) => void) => {
    useHandlers.push(fn);
  }),
  on: vi.fn((event: string, fn: (socket: unknown) => void) => {
    if (event === "connection") {
      connectionHandlers.push(fn);
    }

    return { sockets: { size: 0 } };
  }),
  close: vi.fn((cb: () => void) => {
    cb();
  }),

  // Internal helpers for test assertions - not part of the real Server API
  _useHandlers: useHandlers,
  _connectionHandlers: connectionHandlers,
  _reset(): void {
    useHandlers.length = 0;
    connectionHandlers.length = 0;
    vi.mocked(this.use).mockClear();
    vi.mocked(this.on).mockClear();
  },
};

/** Returns the singleton mock instance - use this in tests instead of importing mockIoInstance directly */
export function getMockIoInstance(): typeof mockIoInstance {
  return mockIoInstance;
}

// This IS the module mock: export `Server` as vi.fn() constructor
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const Server = vi.fn(function MockServer(this: unknown, ..._args: unknown[]) {
  return mockIoInstance;
});
