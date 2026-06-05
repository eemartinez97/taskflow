import { describe, expect, it } from "vitest";
import { createProjectSchema, projectSchema, updateProjectSchema } from "../project";
import { FIXED_DATE, VALID_UUID } from "./fixtures";

describe("createProjectSchema", () => {
  it("accepts a valid project", () => {
    const result = createProjectSchema.parse({
      name: "My Project",
      key: "MP",
      slug: "my-proyect",
    });
    expect(result.key).toBe("MP");
  });

  it("accepts an optional description", () => {
    const result = createProjectSchema.parse({
      name: "My Project",
      key: "MP",
      slug: "my-project",
      description: "A test project",
    });
    expect(result.description).toBe("A test project");
  });

  it("rejects lowercase project key", () => {
    expect(() =>
      createProjectSchema.parse({
        name: "P",
        key: "mp",
        slug: "my-project",
      }),
    ).toThrow();
  });

  it("rejects project key starting with a number", () => {
    expect(() =>
      createProjectSchema.parse({
        name: "P",
        key: "1MP",
        slug: "my-project",
      }),
    ).toThrow();
  });

  it("rejects project key longer than 10 characters", () => {
    expect(() =>
      createProjectSchema.parse({
        name: "P",
        key: "TOOLONGKEY1",
        slug: "p",
      }),
    ).toThrow();
  });

  it("rejects project key shorter than 2 characters", () => {
    expect(() =>
      createProjectSchema.parse({
        name: "P",
        key: "A",
        slug: "my-project",
      }),
    ).toThrow();
  });

  it("rejects description exceeding 500 characters", () => {
    expect(() =>
      createProjectSchema.parse({
        name: "P",
        key: "MP",
        slug: "p",
        description: "a".repeat(501),
      }),
    ).toThrow();
  });
});

describe("projectSchema", () => {
  it("parses a full valid project", () => {
    const result = projectSchema.parse({
      id: VALID_UUID,
      orgId: VALID_UUID,
      name: "full-project",
      key: "FP",
      slug: "full-project",
      description: "A full project",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    });
    expect(result.key).toBe("FP");
    expect(result.description).toBe("A full project");
  });

  it("rejects missing required fields", () => {
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
