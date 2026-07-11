import { describe, it, expect } from "vitest";

import {
  colorSchema,
  HEX_COLOR_REGEX,
  idSchema,
  paginationSchema,
  slugSchema,
} from "@taskflow/shared";
import { VALID_UUID, expectSchema } from "./fixtures";

describe("idSchema", () => {
  it("accepts a valid UUID", () => {
    expect(idSchema.parse(VALID_UUID)).toBe(VALID_UUID);
  });

  it("rejects a non-UUID string", () => {
    expect(() => idSchema.parse("not-a-uuid")).toThrow();
  });
});

describe("paginationSchema", () => {
  it("applies defaults when no input is given", () => {
    const result = paginationSchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 25 });
  });

  it("accepts valid page and pageSize", () => {
    expect(paginationSchema.parse({ page: 3, pageSize: 50 })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("rejects pageSize above 100", () => {
    expect(() => paginationSchema.parse({ pageSize: 101 })).toThrow();
  });

  it("rejects page below 1", () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });
});

describe("slugSchema", () => {
  it("accepts valid slugs", () => {
    expect(slugSchema.parse("my-org-123")).toBe("my-org-123");
  });

  it("rejects slug with uppercase letters", () => {
    expect(() => slugSchema.parse("MyOrg")).toThrow();
  });

  it("rejects slugs with spaces", () => {
    expect(() => slugSchema.parse("my org")).toThrow();
  });

  it("rejects slugs shorter than 2 characters", () => {
    expect(() => slugSchema.parse("a")).toThrow();
  });
});

describe("colorSchema", () => {
  it("accepts valid hex colors", () => {
    expect(colorSchema.parse("#FF5733")).toBe("#FF5733");
    expect(colorSchema.parse("#000000")).toBe("#000000");
  });

  it("rejects colors without hash prefix", () => {
    expect(() => colorSchema.parse("FF5733")).toThrow();
  });

  it("rejects short hex colors", () => {
    expect(() => colorSchema.parse("#FFF")).toThrow();
  });
});
