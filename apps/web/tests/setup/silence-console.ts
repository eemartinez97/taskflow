import { afterEach, beforeEach, type MockInstance, vi } from "vitest";

// Route handlers and error boundaries deliberately log via console.error on
// error paths under test - keep that signal out of the test run's stdout.
// No test asserts on console.error calls; if one needs to, it can still
// read consoleErrorSpy.mock.calls before restore.
let consoleErrorSpy: MockInstance<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
    // Intentionally empty to silence console output during tests
  });
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});
