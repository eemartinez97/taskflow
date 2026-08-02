import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "./env";

// Global mocks that are always identical across every unit test.
// Individual tests may still override return values via vi.mocked().
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));
vi.mock("next/link", () => import("@/tests/mocks/next-link"));
vi.mock("@/lib/toast/store", async () => await import("@/tests/mocks/toast-store"));
vi.mock("next/navigation", () => import("@/tests/mocks/next-navigation"));
vi.mock("next-auth/react", () => import("@/tests/mocks/next-auth"));
vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));

// Ensures no DOM leaks between tests across the whole jsdom suite.
afterEach(() => {
  cleanup();
});
