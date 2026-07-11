import { describe, expect, it } from "vitest";

import { createProjectSchema, projectSchema, updateProjectSchema } from "@taskflow/shared";
import { validProjectPayload, expectSchema } from "./fixtures";

describe("createProjectSchema", () => {
  it("accepts a valid project", () => {
    const { name, key, slug } = validProjectPayload;
    const result = createProjectSchema.parse({ name, key, slug });
    expect(result.key).toBe(key);
  });

  it("accepts an optional description", () => {
    const { name, key, slug, description } = validProjectPayload;
    const result = createProjectSchema.parse({ name, key, slug, description });
    expect(result.description).toBe(description);
  });

  it("rejects lowercase project key", () => {
    expect(() => createProjectSchema.parse({ ...validProjectPayload, key: "mp" })).toThrow();
  });

  it("rejects project key starting with a number", () => {
    expect(() => createProjectSchema.parse({ ...validProjectPayload, key: "1MP" })).toThrow();
  });

  it("rejects project key longer than 10 characters", () => {
    expect(() =>
      createProjectSchema.parse({ ...validProjectPayload, key: "TOOLONGKEY1" }),
    ).toThrow();
  });

  it("rejects project key shorter than 2 characters", () => {
    expect(() => createProjectSchema.parse({ ...validProjectPayload, key: "A" })).toThrow();
  });

  it("rejects description exceeding 500 characters", () => {
    expect(() =>
      createProjectSchema.parse({ ...validProjectPayload, description: "a".repeat(501) }),
    ).toThrow();
  });
});

describe("projectSchema", () => {
  it("parses a full valid project", () => {
    const { key, description } = validProjectPayload;
    const result = projectSchema.parse(validProjectPayload);
    expect(result.key).toBe(key);
    expect(result.description).toBe(description);
  });

  it("accepts null description", () => {
    // description is nullable in Prisma (String?) and Zod (.nullable())
    const result = projectSchema.parse({ ...validProjectPayload, description: null });
    expect(result.description).toBeNull();
  });

  it("rejects object missing id and other required fields", () => {
    expect(() => projectSchema.parse({ name: "Project" })).toThrow();
  });
});

describe("updateProjectSchema", () => {
  it("accepts empty object - all fields optional", () => {
    expect(updateProjectSchema.parse({})).toEqual({});
  });

  it("accepts partial update with only name", () => {
    const result = updateProjectSchema.parse({ name: "Renamed" });
    expect(result.name).toBe("Renamed");
  });

  it("accepts partial update with only description", () => {
    const result = updateProjectSchema.parse({ description: "New description" });
    expect(result.description).toBe("New description");
  });

  it("rejects invalid key in update", () => {
    expect(() => updateProjectSchema.parse({ key: "lowercase" })).toThrow();
  });
});
