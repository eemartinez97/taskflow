import { describe, expect, it } from "vitest";
import { displayName, userInitials } from "@/lib/utils/user";

describe("displayName", () => {
  it("prefers name over email", () => {
    expect(displayName({ name: "Alice", email: "a@x.com" })).toBe("Alice");
  });
  it("falls back to email when name is missing", () => {
    expect(displayName({ email: "a@x.com" })).toBe("a@x.com");
  });
  it("falls back to 'User' when both are missing", () => {
    expect(displayName({})).toBe("User");
  });
});

describe("userInitials", () => {
  it("builds two initials from a multi-word name", () => {
    expect(userInitials({ name: "Erick Monjaras" })).toBe("EM");
  });
  it("truncates to two initials for names with 3+ words", () => {
    expect(userInitials({ name: "Ana Maria Lopez" })).toBe("AM");
  });
  it("uses the first email letter when name is absent", () => {
    expect(userInitials({ email: "sophia@example.com" })).toBe("S");
  });
  it("returns '??' when neither name nor email exist", () => {
    expect(userInitials({})).toBe("??");
  });
});
