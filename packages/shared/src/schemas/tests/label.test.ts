import { describe, expect, it } from "vitest";
import { createLabelSchema, labelSchema } from "../label";
import { FIXED_DATE, VALID_UUID } from "./fixtures";

describe("createLabelSchema", () => {
  it("accepts a valid label", () => {
    const result = createLabelSchema.parse({ name: "Bug", color: "#FF5733" });
    expect(result.color).toBe("#FF5733");
  });

  it("rejects empty name", () => {
    expect(() => createLabelSchema.parse({ name: "", color: "#FF5733" })).toThrow();
  });

  it("rejects name exceeding 50 characters", () => {
    expect(() => createLabelSchema.parse({ name: "a".repeat(51), color: "#FF5733" })).toThrow();
  });

  it("rejects invalid hex color", () => {
    expect(() => createLabelSchema.parse({ name: "Bug", color: "red" })).toThrow();
  });
});

describe("labelSchema", () => {
  it("parses a full valid label", () => {
    const result = labelSchema.parse({
      id: VALID_UUID,
      orgId: VALID_UUID,
      name: "Feature",
      color: "#33FF57",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    });
    expect(result.name).toBe("Feature");
  });
});
