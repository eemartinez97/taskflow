// apps/web/tests/unit/lib/auth/schemas.test.ts
import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/auth/schemas";
import { validRegisterPayload } from "@/tests/support/fixtures";

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

describe("passwordSchema", () => {
  it("accepts a compliant password", () => {
    expect(passwordSchema.safeParse("Str0ng!Pass").success).toBe(true);
  });
  it.each([
    ["too short", "Sh0rt!"],
    ["no lowercase", "STRONG1!AAA"],
    ["no uppercase", "strong1!aaa"],
    ["no number", "StrongPass!"],
    ["no symbol", "StrongPass1"],
    ["too long", `A1!${"a".repeat(70)}`],
  ])("rejects: %s", (_label, value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts a valid name + email + password payload", () => {
    expect(registerSchema.safeParse(validRegisterPayload).success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(registerSchema.safeParse({ ...validRegisterPayload, name: "A" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ ...validRegisterPayload, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a weak password", () => {
    const result = registerSchema.safeParse({
      ...validRegisterPayload,
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords with an error on confirmPassword", () => {
    const result = registerSchema.safeParse({
      ...validRegisterPayload,
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a fully valid payload", () => {
    const result = resetPasswordSchema.safeParse({
      token: "xyz789",
      password: "Str0ng!Pass1",
      confirmPassword: "Str0ng!Pass1",
    });
    expect(result.success).toBe(true);
  });
  it("rejects mismatched passwords with an error on confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({
      token: "xyz789",
      password: "Str0ng!Pass1",
      confirmPassword: "Mismatch1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });
});
