/**
 * Mock for `next-auth` default export and `next-auth/providers/credentials`.
 * Lets auth.test.ts invoke authOptions.callbacks and the authorize() closure
 * directly without booting a real NextAuth server instance.
 *
 * Activate per test file:
 *   vi.mock("next-auth/providers/credentials", () => import("@/tests/mocks/next-auth-provider"));
 */
import { vi } from "vitest";

interface CredentialsConfig {
  authorize: (credentials: Partial<Record<string, string>> | undefined) => Promise<unknown>;
}

// CredentialsProvider(config) returns the config verbatim in real NextAuth
// (wrapped with provider metadata) - for our purposes, returning it as-is
// lets the test call `authOptions.providers[0].authorize(...)` directly.
const CredentialsProvider = vi.fn((config: CredentialsConfig) => ({
  id: "credentials",
  type: "credentials",
  ...config,
}));

export default CredentialsProvider;
