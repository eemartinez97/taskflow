import { type Server } from "socket.io";
import { vi, type MockInstance } from "vitest";

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

export const mockIo = {
  to: mockTo,
} as unknown as Server;
