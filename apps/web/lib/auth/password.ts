import bcrypt from "bcrypt";

/**
 * bcrypt 6.0.0
 *
 * - Requires Node.js 20+ at build and runtime (we run Node 24 LTS - OK)
 * - Salt rounds = 12: good balance between security and latency (~250ms on modern HW).
 * - API (hash / compare) unchanged from bcrypt 5.x.
 *
 * Extracted as a module (not inlined in auth.ts) so:
 *   - Tests can mock this module without mocking bcrypt directly.
 *   - Future swap to argon2 only requires changing this file
 */

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password.
 * Always use this - never call bcrypt.hash() directly outside this module.
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored hash.
 * Returns `true` when they match, `false` otherwise.
 * Never throws - bcrypt errors are surfaced as `false`.
 */
export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainText, hash);
  } catch {
    return false;
  }
}
