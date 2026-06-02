import { describe, expect, it } from "vitest";
import { createProjectSchema } from "../project";

describe("createProjectSchema", () => {
  it("accepts a valid project", () => {
    const result = createProjectSchema.parse({
      name: "My Project",
      key: "MP",
      slug: "my-proyect",
    });
    expect(result.key).toBe("MP");
  });

  it("rejects lowercase project key", () => {
    expect(() => createProjectSchema.parse({ name: "P", key: "mp", slug: "my-project" })).toThrow();
  });

  it("rejects project key longer than 10 characters", () => {
    expect(() => createProjectSchema.parse({ name: "P", key: "TOOLONGKEY1", slug: "p" })).toThrow();
  });
});
