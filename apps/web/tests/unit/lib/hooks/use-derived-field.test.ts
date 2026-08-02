import { describe, expect, it, vi } from "vitest";
import { createDerivedFieldHandler } from "@/lib/hooks/use-derived-field";

describe("createDerivedFieldHandler", () => {
  it("derives and sets the target field when it is not dirty", () => {
    const setValue = vi.fn();
    const handler = createDerivedFieldHandler(setValue, false, "slug", (v: string) =>
      v.toLowerCase(),
    );
    handler({ target: { value: "Hello World" } } as React.ChangeEvent<HTMLInputElement>);
    expect(setValue).toHaveBeenCalledWith("slug", "hello world");
  });

  it("does nothing when the target field is already dirty (user-edited)", () => {
    const setValue = vi.fn();
    const handler = createDerivedFieldHandler(setValue, true, "slug", (v: string) => v);
    handler({ target: { value: "Anything" } } as React.ChangeEvent<HTMLInputElement>);
    expect(setValue).not.toHaveBeenCalled();
  });
});
