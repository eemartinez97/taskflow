import { describe, expect, it } from "vitest";
import { stripUndefined } from "../../../src/utils/prisma.js";

describe("stripUndefined", () => {
  it("keeps all defined values unchanged", () => {
    const obj = { name: "Acme", slug: "acme", count: 0 };
    const result = stripUndefined(obj);
    expect(result).toEqual(obj);
  });

  it("removes keys whose value is explicitly undefined (the branch hit)", () => {
    // This is the branch NOT covered by orgs.update:
    // the `if (obj[key] !== undefined)` evaluates to false -> key is skipped
    const obj = { name: "Acme", slug: undefined };
    const result = stripUndefined(obj);
    expect(result).toEqual({ name: obj.name });
    expect(result).not.toHaveProperty("slug");
  });

  it("keeps null values - null is NOT stripped (null !== undefined)", () => {
    const obj = { name: null, slug: "acme" };
    const result = stripUndefined(obj);
    expect(result).toEqual(obj);
  });

  it("keeps falsy-but-defined values (0, false, empty string)", () => {
    const obj = { count: 0, active: false, label: "" };
    const result = stripUndefined(obj);
    expect(result).toEqual(obj);
  });

  it("returns an empty object when all values are undefined", () => {
    expect(stripUndefined({ a: undefined, b: undefined })).toEqual({});
  });

  it("returns an empty object for an empty input", () => {
    expect(stripUndefined({})).toEqual({});
  });

  it("handles mixed defined/undefined keys correctly", () => {
    const obj = { name: "Updated", slug: undefined, description: undefined, count: 5 };
    const result = stripUndefined(obj);
    expect(result).toEqual({ name: obj.name, count: obj.count });
    expect(Object.keys(result)).toHaveLength(2);
  });
});
