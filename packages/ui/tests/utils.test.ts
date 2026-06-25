import { describe, expect, it } from "vitest";
import { cn } from "../src";

describe("cn (class name merger)", () => {
  it("joins class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar");
  });

  it("returns empty string when all values are falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });

  it("handles a single class", () => {
    expect(cn("only")).toBe("only");
  });

  it("handles conditional classes", () => {
    const getFlag = (v: boolean): boolean => v;
    expect(cn("base", getFlag(true) && "active", getFlag(false) && "disabled")).toBe("base active");
  });
});
