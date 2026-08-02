import { type MockInstance, vi } from "vitest";
import { useRouter } from "next/navigation";

export interface RouterMock {
  pushMock: MockInstance<(href: string) => void>;
  replaceMock: MockInstance<(href: string) => void>;
  refreshMock: MockInstance<() => void>;
  router: ReturnType<typeof useRouter>;
}

export function makeRouterMock(): RouterMock {
  const pushMock = vi.fn<(href: string) => void>();
  const replaceMock = vi.fn<(href: string) => void>();
  const refreshMock = vi.fn<() => void>();

  const router = {
    push: pushMock,
    replace: replaceMock,
    back: vi.fn<() => void>,
    forward: vi.fn<() => void>,
    refresh: refreshMock,
    prefetch: vi.fn<() => void>,
  } as unknown as ReturnType<typeof useRouter>;

  return { pushMock, replaceMock, refreshMock, router };
}

/**
 * Configures vi.mocked(useRouter) and returns the mock for assertions.
 * Requires: vi.mock("next/navigation", ...) active for the test file.
 */
export function setupRouterMock(): RouterMock {
  const mock = makeRouterMock();
  vi.mocked(useRouter).mockReturnValue(mock.router);
  return mock;
}
