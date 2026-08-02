/**
 * Mock for `next-auth/react` - used in unit tests for components
 * that call useSession() or signIn() / signOut().
 *
 * Activate per test file:
 *   vi.mock("next-auth/react", () => import("@/tests/mocks/next-auth"));
 *
 * Override per test:
 *   vi.mocked(useSession).mockReturnValue({ data: mockSession, status: "authenticated" })
 */

import { vi } from "vitest";
import type { Session } from "next-auth";
import type {
  useSession as useSessionType,
  signIn as signInType,
  signOut as signOutType,
  SessionProvider as SessionProviderType,
} from "next-auth/react";

// Default authenticated session fixture
export const mockSession: Session = {
  expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  user: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Alice",
    email: "alice@taskflow.dev",
    image: null,
  },
};

export const useSession = vi.fn<typeof useSessionType>(() => ({
  data: mockSession,
  status: "authenticated" as const,
  update: vi.fn().mockResolvedValue(mockSession),
}));

export const signIn = vi.fn<typeof signInType>();
export const signOut = vi.fn<typeof signOutType>();

export const SessionProvider = vi.fn<typeof SessionProviderType>(
  ({ children }: { children: React.ReactNode }) => children,
);
