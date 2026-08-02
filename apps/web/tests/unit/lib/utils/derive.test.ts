import { deriveProjectKey, deriveSlug } from "@/lib/utils/derive";
import { describe, expect, it } from "vitest";

describe("deriveSlug", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(deriveSlug("My Web Project")).toBe("my-web-project");
  });

  it("strips accents", () => {
    expect(deriveSlug("Café Résumé")).toBe("cafe-resume");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(deriveSlug("Foo!!  Bar__Baz")).toBe("foo-bar-baz");
  });

  it("trims leading and trailing hyphens", () => {
    expect(deriveSlug("  -- Foo --  ")).toBe("foo");
  });

  it("truncates to 50 characters", () => {
    const long = "a".repeat(100);
    expect(deriveSlug(long)).toHaveLength(50);
  });

  it("returns an empty string for input with no valid characters", () => {
    expect(deriveSlug("!!!")).toBe("");
  });
});

describe("deriveProjectKey", () => {
  it("builds initials from multiple words", () => {
    expect(deriveProjectKey("My Web Project")).toBe("MWP");
  });

  it("uses up to 4 characters of a single word", () => {
    expect(deriveProjectKey("Backend")).toBe("BACK");
  });

  it("strips accents before deriving", () => {
    expect(deriveProjectKey("Équipe Ops")).toBe("EO");
  });

  it("strips a leading numeric run", () => {
    expect(deriveProjectKey("123Project")).toBe("PROJ");
  });

  it("truncates to 10 characters", () => {
    expect(deriveProjectKey("A B C D E F G H I J K")).toHaveLength(10);
  });

  it("returns an empty string when input has no valid characters", () => {
    expect(deriveProjectKey("!!!")).toBe("");
  });
});
