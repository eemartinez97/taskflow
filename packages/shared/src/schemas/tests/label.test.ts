import { describe, expect, it } from "vitest";
import { createLabelSchema, labelSchema } from "../label.js";
import { validLabelPayload } from "./fixtures.js";

describe("createLabelSchema", () => {
  it("accepts a valid label", () => {
    const { name, color } = validLabelPayload;
    const result = createLabelSchema.parse({ name, color });
    expect(result.color).toBe(color);
  });

  it("rejects empty name", () => {
    expect(() => createLabelSchema.parse({ ...validLabelPayload, name: "" })).toThrow();
  });

  it("rejects name exceeding 50 characters", () => {
    expect(() => createLabelSchema.parse({ ...validLabelPayload, name: "a".repeat(51) })).toThrow();
  });

  it("rejects invalid hex color", () => {
    expect(() => createLabelSchema.parse({ ...validLabelPayload, color: "red" })).toThrow();
  });
});

describe("labelSchema", () => {
  it("parses a full valid label", () => {
    const result = labelSchema.parse(validLabelPayload);
    expect(result.name).toBe(validLabelPayload.name);
  });
});
