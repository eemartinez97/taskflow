import { afterEach, describe, expect, it, vi } from "vitest";
import { isBrowser, isServer } from "@/lib/utils/runtime";

describe("runtime detection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports browser=true / server=false when window is defined (jsdom default)", () => {
    expect(isBrowser()).toBe(true);
    expect(isServer()).toBe(false);
  });

  it("reports browser=false / server=true when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(isBrowser()).toBe(false);
    expect(isServer()).toBe(true);
  });
});
