/**
 * Credentials for the user seeded by packages/database/prisma/seed.ts.
 * Single source of truth - imported by global-setup.ts (to capture the
 * shared storageState) and helpers/auth.ts (loginAs' default).
 */
export const SEED_USER = {
  email: "admin@taskflow.dev",
  password: "admin123",
};
