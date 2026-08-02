import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

interface AuthFixtures {
  registeredUser: { email: string; password: string; name: string };
}

/** Generates a unique test user per test run to avoid collisions in a shared DB. */
export const test = base.extend<AuthFixtures>({
  // eslint-disable-next-line no-empty-pattern
  registeredUser: async ({}, use) => {
    const uniqueId = randomUUID().slice(0, 8);
    await use({
      email: `e2e-${uniqueId}@taskflow.dev`,
      password: "Str0ng!Passw0rd",
      name: `E2E User ${uniqueId}`,
    });
  },
});

export { expect };
