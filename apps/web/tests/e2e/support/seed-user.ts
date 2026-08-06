/**
 * Credentials for the user seeded by packages/database/prisma/seed.ts.
 * Single source of truth - imported by global-setup.ts to capture the
 * shared storageState every pre-authenticated test starts from.
 */
export const SEED_USER = {
  email: "admin@taskflow.dev",
  password: "admin123",
};
