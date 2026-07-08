/**
 * Manual mock for `socket.io-client`.
 *
 * Exports a controllable socket instance so tests can:
 *   1. Assert that `.connect()` / `.disconnect()` were called.
 *   2. Register handlers via `socket.on(event, handler)`.
 *   3. Trigger incoming events via `triggerSocketEvent(event, payload)`.
 *
 * Activate per test file:
 *   vi.mock("socket.io-client", () => import("@/tests/mocks/socket-io-client.js"));
 */

import { vi } from "vitest";

/** Registered handler store: event -> handler function */
export type HandlerStore = Map<string, (payload: unknown) => void>;

const handlerStore: HandlerStore = new Map();

export const mockSocket = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn((event: string, handler: (payload: unknown) => void) => {
    handlerStore.set(event, handler);
  }),
  off: vi.fn((event: string) => {
    handlerStore.delete(event);
    return mockSocket;
  }),
  emit: vi.fn(),
  connected: false,
};

/**
 * Triggers an event handler registered on the mock socket.
 * Throws when the handler is not registered (helps catch missing `.on()` calls).
 */
export function triggerSocketEvent(event: string, payload: unknown): void {
  const handler = handlerStore.get(event);
  if (!handler) throw new Error(`No handler registered for event "${event}"`);
  handler(payload);
}

/**
 * Returns the current handler store snapshot.
 * Use in assertions: `expect(getHandlerStore().has(SOCKET_EVENTS.TASK_CREATED)).toBe(true)`.
 */
export function getHandlerStore(): HandlerStore {
  return handlerStore;
}

/** Clears all registered handlers (call in beforeEach). */
export function resetHandlerStore(): void {
  handlerStore.clear();
  mockSocket.connect.mockClear();
  mockSocket.disconnect.mockClear();
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
  mockSocket.emit.mockClear();
}

/** The `io()` factory - returns the singleton mockSocket */
export const io = vi.fn(() => mockSocket);

export default { io };
