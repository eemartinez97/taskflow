/**
 * Mock for the `bcrypt` native module.
 *
 * bcrypt 6.0.0 requires a native C compiler at build time.
 * In unit tests we replace it with deterministic synchronous vi.fn()
 * spies so tests remain fast and portable.
 *
 * Activate per test file:
 *   vi.mock("bcrypt", () => import("../mocks/bcrypt))
 */

import { vi } from "vitest";

export const hash = vi.fn<(data: string, saltOrRounds: number) => Promise<string>>(
  async (data: string) => Promise.resolve(`hashed:${data}`),
);

export const compare = vi.fn<(data: string, encrypted: string) => Promise<boolean>>(async () =>
  Promise.resolve(true),
);

/** Default export shape expected by `import bcrypt from "bcrypt"` */
export default { hash, compare };
