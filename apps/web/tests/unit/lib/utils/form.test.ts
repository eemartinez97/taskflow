import { describe, expect, it, vi } from "vitest";
import {
  createDialogCloseHandler,
  emptyStringToNull,
  emptyStringToUndefined,
  selectValueToNull,
} from "@/lib/utils/form";

describe("emptyStringToNull", () => {
  it("trims and returns non-empty strings", () => {
    expect(emptyStringToNull("  hello  ")).toBe("hello");
  });
  it("returns null for an empty/whitespace string", () => {
    expect(emptyStringToNull("   ")).toBeNull();
  });
  it("returns null for non-string input (unmount race guard)", () => {
    expect(emptyStringToNull(undefined)).toBeNull();
    expect(emptyStringToNull(null)).toBeNull();
  });
});

describe("emptyStringToUndefined", () => {
  it("trims and returns non-empty strings", () => {
    expect(emptyStringToUndefined("  hello  ")).toBe("hello");
  });
  it("returns undefined for an empty/whitespace string", () => {
    expect(emptyStringToUndefined("   ")).toBeUndefined();
  });
  it("returns undefined for non-string input (unmount race guard)", () => {
    expect(emptyStringToUndefined(undefined)).toBeUndefined();
    expect(emptyStringToUndefined(null)).toBeUndefined();
  });
});

describe("selectValueToNull", () => {
  it("returns the string when non-empty", () => {
    expect(selectValueToNull("abc")).toBe("abc");
  });
  it("returns null for an empty string", () => {
    expect(selectValueToNull("")).toBeNull();
  });
  it("returns null for non-string input", () => {
    expect(selectValueToNull(undefined)).toBeNull();
  });
});

describe("createDialogCloseHandler", () => {
  it("resets the form, resets the mutation, then calls onClose", () => {
    const reset = vi.fn();
    const mutationReset = vi.fn();
    const onClose = vi.fn();
    const defaults = { name: "foo" };
    const handler = createDialogCloseHandler(reset, { reset: mutationReset }, onClose, defaults);
    handler();
    expect(reset).toHaveBeenCalledWith(defaults);
    expect(mutationReset).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("works without default values", () => {
    const reset = vi.fn();
    const handler = createDialogCloseHandler(reset, { reset: vi.fn() }, vi.fn());
    handler();
    expect(reset).toHaveBeenCalledWith(undefined);
  });
});
