/**
 * Mock for `@/lib/toast/store` - used across integration/ui tests that
 * trigger success/error toasts as a side effect of mutations.
 *
 * Activate globally via tests/setup/integration.ui.ts, or per file:
 *   vi.mock("@/lib/toast/store", () => import("@/tests/mocks/toast-store"));
 *
 * Override per test:
 *   vi.mocked(toast.success).mockImplementation(() => { ... });
 */
import { vi } from "vitest";

export const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};
