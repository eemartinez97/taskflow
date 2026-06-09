import { describe, expect, it } from "vitest";
import { updateUserSchema, userSchema } from "../user";
import { validUserPayload } from "./fixtures";

describe("userSchema", () => {
  it("parses a valid user with all fields", () => {
    const result = userSchema.parse(validUserPayload);
    expect(result.email).toBe(validUserPayload.email);
  });

  it("accepts null name and image", () => {
    const result = userSchema.parse({ ...validUserPayload, name: null, image: null });
    expect(result.name).toBeNull();
    expect(result.image).toBeNull();
  });

  it("rejects invalid email", () => {
    expect(() => userSchema.parse({ ...validUserPayload, email: "not-an-email" })).toThrow();
  });
});

describe("updateUserSchema", () => {
  it("accepts partial update with only name", () => {
    const result = updateUserSchema.parse({ name: "Jane Doe" });
    expect(result.name).toBe("Jane Doe");
  });

  it("accepts empty object - all fields optional", () => {
    const result = updateUserSchema.parse({});
    expect(result).toEqual({});
  });

  it("rejects name exceeding 100 characters", () => {
    expect(() => updateUserSchema.parse({ name: "a".repeat(101) })).toThrow();
  });
});
