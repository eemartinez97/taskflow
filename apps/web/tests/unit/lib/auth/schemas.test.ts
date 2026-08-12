// apps/web/tests/unit/lib/auth/schemas.test.ts
//
// registerSchema/forgotPasswordSchema/resetPasswordSchema/passwordSchema
// moved to packages/shared/tests/schemas/auth.test.ts along with the
// schemas themselves - only loginSchema stays web-app-only (see
// lib/auth/schemas.ts's docblock).
import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/auth/schemas";

describe("loginSchema", () => {
  it("accepts a valid email/password pair", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });
  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});
