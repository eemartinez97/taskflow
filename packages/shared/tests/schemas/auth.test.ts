import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, passwordSchema, registerSchema, resetPasswordSchema } from "../../src/schemas/auth";

const validRegisterPayload = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "Str0ng!Pass1",
  confirmPassword: "Str0ng!Pass1",
};

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

  it("trims and lowercases the email", () => {
    const result = registerSchema.safeParse({
      ...validRegisterPayload,
      email: "  Ada@EXAMPLE.com  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@example.com");
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

  it("trims and lowercases the email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "  A@B.COM  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("a@b.com");
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

  it("rejects a missing token", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      password: "Str0ng!Pass1",
      confirmPassword: "Str0ng!Pass1",
    });
    expect(result.success).toBe(false);
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
