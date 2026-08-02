import { describe, expect, it, vi } from "vitest";
import { createDialogCloseHandler, emptyStringToNull, selectValueToNull } from "@/lib/utils/form";

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
