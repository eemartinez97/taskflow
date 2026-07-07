import { describe, expect, it } from "vitest";

import { noOpIo } from "@/lib/trpc/no-op-io";

describe("noOpIo", () => {
  it("to().emit() is callable and returns falsy (no real socket)", () => {
    expect(noOpIo.to("project:123").emit("task:created", {})).toBe(false);
  });

  it("accepts any room name and event without throwing", () => {
    expect(() => noOpIo.to("any-room").emit("any-event", { data: 1 })).not.toThrow();
  });

  it("exposes the expected { to: fn } shape", () => {
    expect(typeof noOpIo.to).toBe("function");
    expect(typeof noOpIo.to("x").emit).toBe("function");
  });
});
