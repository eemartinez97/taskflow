// -- ID constants --
export const VALID_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
export const VALID_BOARD_ID = "b0000000-0000-4000-8000-000000000001";
export const VALID_COL_A_ID = "c0000000-0000-4000-8000-000000000001";
export const VALID_COL_B_ID = "c0000000-0000-4000-8000-000000000002";
export const VALID_TASK_1_ID = "10000000-0000-4000-8000-000000000001";
export const VALID_PROJECT_ID = "f0000000-0000-4000-8000-000000000001";
export const VALID_ORG_ID = "a0000000-0000-4000-8000-000000000001";

// -- Environment fixtures --
export const VALID_SERVER_ENV = {
  NODE_ENV: "test" as const,
  DATABASE_URL: "postgresql://taskflow:changeme@localhost:5432/taskflow_test",
  NEXTAUTH_SECRET: "test-secret-value-at-least-16-chars",
  NEXTAUTH_URL: "http://localhost:3000",
  PASSWORD_CHANGED_AT_CACHE_TTL_MS: 60_000,
};

export const VALID_PUBLIC_ENV = {
  NEXT_PUBLIC_API_URL: "http://localhost:8000",
  NEXT_PUBLIC_WEB_URL: "http://localhost:3000",
};

export const VALID_FULL_ENV = { ...VALID_SERVER_ENV, ...VALID_PUBLIC_ENV };

// -- Auth fixtures --

/** Full User row as returned by Prisma (includes hashed password). */
export const mockDbUser = {
  id: VALID_USER_ID,
  email: "alice@taskflow.dev",
  name: "Alice",
  image: null,
  password: "hashed:correct-password",
  emailVerified: new Date("2024-01-01T00:00:00.000Z"),
};

/** User returned by authorizeCredentials (no password field). */
export const mockAuthorizedUser = {
  id: VALID_USER_ID,
  email: "alice@taskflow.dev",
  name: "Alice",
  image: null,
};

/** Minimal valid login credential payload. */
export const validLoginCredentials = {
  email: "alice@taskflow.dev",
  password: "correct-password",
};

/** Minimal valid registration payload (name + email + password). */
export const validRegisterPayload = {
  name: "Alice",
  email: "alice@taskflow.dev",
  password: "Secure-password-123",
  confirmPassword: "Secure-password-123",
};

/** Minimal valid forgot-password payload. */
export const validForgotPasswordPayload = {
  email: "alice@taskflow.dev",
};

/** Minimal valid reset-password payload. */
export const validResetPasswordPayload = {
  token: "valid-reset-token",
  password: "Secure-password-123",
  confirmPassword: "Secure-password-123",
};

export { mockSession } from "@/tests/mocks/next-auth";
