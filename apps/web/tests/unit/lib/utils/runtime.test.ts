import { afterEach, describe, expect, it, vi } from "vitest";

import { isBrowser, isServer } from "@/lib/utils/runtime";

afterEach(() => vi.unstubAllGlobals());

/** Stubs `window` as undefined to simulate a server/Node.js context. */
function simulateServer(): void {
  vi.stubGlobal("window", undefined);
}

describe("isBrowser", () => {
  it("returns true in jsdom (window is defined)", () => {
    expect(isBrowser()).toBe(true);
  });

  it("returns false when window is undefined (server context)", () => {
    simulateServer();
    expect(isBrowser()).toBe(false);
  });
});

describe("isServer", () => {
  it("returns false in jsdom (window is defined)", () => {
    expect(isServer()).toBe(false);
  });

  it("returns true when window is undefined (server context)", () => {
    simulateServer();
    expect(isServer()).toBe(true);
  });
});

describe("mutual exclusion", () => {
  it("exactly one is true in browser context", () => {
    expect(isBrowser()).toBe(true);
    expect(isServer()).toBe(false);
  });

  it("exactly one is true in server context)", () => {
    simulateServer();
    expect(isBrowser()).toBe(false);
    expect(isServer()).toBe(true);
  });

  it("isServer is always the logical inverse of isBrowser", () => {
    expect(isServer()).toBe(!isBrowser());
    simulateServer();
    expect(isServer()).toBe(!isBrowser());
  });
});
