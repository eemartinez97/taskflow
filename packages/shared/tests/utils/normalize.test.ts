import { describe, expect, it } from "vitest";
import { emailField } from "../../src/utils/normalize";

describe("emailField", () => {
  const schema = emailField();

  it("accepts a plain lowercase email", () => {
    expect(schema.parse("user@example.com")).toBe("user@example.com");
  });

  it("trims surrounding whitespace before validating format", () => {
    expect(schema.parse("  user@example.com  ")).toBe("user@example.com");
  });

  it("lowercases the result", () => {
    expect(schema.parse("User@Example.COM")).toBe("user@example.com");
  });

  it("trims AND lowercases together", () => {
    expect(schema.parse("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("rejects a value that isn't an email even after trim+lowercase", () => {
    expect(schema.safeParse("  not-an-email  ").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(schema.safeParse("").success).toBe(false);
  });
});
