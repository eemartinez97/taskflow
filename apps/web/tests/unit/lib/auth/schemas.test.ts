import { describe, expect, it } from "vitest";

import { validLoginCredentials, validRegisterPayload } from "@/tests/helpers";
import { loginSchema, registerSchema } from "@/lib/auth/schemas";

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.parse(validLoginCredentials);
    expect(result.email).toBe(validLoginCredentials.email);
  });

  it("rejects invalid email format", () => {
    expect(() => loginSchema.parse({ email: "not-an-email", password: "pass" })).toThrow();
  });

  it("rejects empty password", () => {
    expect(() => {
      loginSchema.parse({ email: validLoginCredentials.email, password: "" });
    }).toThrow();
  });

  it("rejects missing email", () => {
    expect(() => loginSchema.parse({ password: "pass" })).toThrow();
  });

  it("rejects missing password", () => {
    expect(() => loginSchema.parse({ email: validLoginCredentials.email })).toThrow();
  });
});

describe("registerSchema", () => {
  it("accepts valid registration data", () => {
    expect(registerSchema.parse(validRegisterPayload).email).toBe(validRegisterPayload.email);
  });

  it("rejects name shorter than 2 characters", () => {
    expect(() => registerSchema.parse({ ...validRegisterPayload, name: "A" })).toThrow();
  });

  it("rejects name longer than 100 characters", () => {
    expect(() =>
      registerSchema.parse({ ...validRegisterPayload, name: "A".repeat(101) }),
    ).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() =>
      registerSchema.parse({ ...validRegisterPayload, email: "not-an-email" }),
    ).toThrow();
  });

  it("rejects password shorter than 8 characters", () => {
    expect(() => registerSchema.parse({ ...validRegisterPayload, password: "short" })).toThrow();
  });
  it("rejects password longer than 72 characters (bcrypt limit)", () => {
    expect(() =>
      registerSchema.parse({ ...validRegisterPayload, password: "a".repeat(73) }),
    ).toThrow();
  });

  it("rejects when password and confirmPassword do not match", () => {
    expect(() =>
      registerSchema.parse({ ...validRegisterPayload, confirmPassword: "different-password" }),
    ).toThrow();
  });

  it("attaches the validation error to the confirmPassword path", () => {
    const result = registerSchema.safeParse({ ...validRegisterPayload, confirmPassword: "wrong" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("confirmPassword");
    }
  });

  it("accepts passwords exactly at 8 characters (boundary)", () => {
    const boundary = "a".repeat(8);
    expect(
      registerSchema.parse({
        ...validRegisterPayload,
        password: boundary,
        confirmPassword: boundary,
      }).password,
    ).toBe(boundary);
  });

  it("accepts password exactly at 72 characters (bcrypt boundary)", () => {
    const boundary = "a".repeat(72);
    expect(
      registerSchema.parse({
        ...validRegisterPayload,
        password: boundary,
        confirmPassword: boundary,
      }).password,
    ).toBe(boundary);
  });

  it("rejects missing confirmPassword", () => {
    const { confirmPassword: _, ...withoutConfirm } = validRegisterPayload;
    void _;
    expect(() => registerSchema.parse(withoutConfirm)).toThrow();
  });
});
