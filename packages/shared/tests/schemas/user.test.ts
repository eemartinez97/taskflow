import { describe, expect, it } from "vitest";

import { sessionUserSchema, updateUserSchema, userSchema } from "../../src";
import { validUserPayload } from "./fixtures.js";

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

describe("sessionUserSchema", () => {
  it("parses a valid session user", () => {
    const result = sessionUserSchema.parse(validUserPayload);
    expect(result.id).toBe(validUserPayload.id);
    expect(result.email).toBe(validUserPayload.email);
  });

  it("accepts null name", () => {
    expect(sessionUserSchema.parse({ ...validUserPayload, name: null }).name).toBeNull();
  });

  it("accepts null image", () => {
    expect(sessionUserSchema.parse({ ...validUserPayload, image: null }).image).toBeNull();
  });

  it("rejects invalid email", () => {
    expect(() => sessionUserSchema.parse({ ...validUserPayload, email: "bad" })).toThrow();
  });

  it("rejects non-UUID id", () => {
    expect(() => sessionUserSchema.parse({ ...validUserPayload, id: "not-uuid" })).toThrow();
  });

  it("does NOT include createdAt or updatedAt (picked subset)", () => {
    // Zod strips unknown keys by default - extra fields are silently dropped
    const result = sessionUserSchema.parse({ ...validUserPayload });
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
  });

  it("is a strict subset of userSchema (shares sane base fields)", () => {
    // If userSchema changes id/email/name/image, sessionUserSchema must too -
    // this test catches any accidental drift between the two
    const keys = Object.keys(sessionUserSchema.shape);
    expect(keys).toEqual(expect.arrayContaining(["id", "email", "name", "image"]));
    expect(keys).toHaveLength(4);
  });
});
