import { afterEach, describe, expect, it, vi } from "vitest";
import { createCookieStore } from "@/lib/utils/cookie-store";

function clearCookies(): void {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

describe("createCookieStore", () => {
  afterEach(() => {
    clearCookies();
  });

  it("read() returns the parsed serverValue when document is undefined", () => {
    const store = createCookieStore<string | null>({
      cookieName: "test.cookie",
      parse: (raw) => raw,
      serialize: (v) => v,
      serverValue: "server-default",
    });
    const original = globalThis.document;
    // @ts-expect-error simulate SSR
    delete globalThis.document;
    expect(store.read()).toBe("server-default");
    globalThis.document = original;
  });

  it("write() sets the cookie and read() reflects it", () => {
    const store = createCookieStore<string | null>({
      cookieName: "test.cookie",
      parse: (raw) => raw,
      serialize: (v) => v,
      serverValue: null,
    });
    store.write("hello");
    expect(store.read()).toBe("hello");
  });

  it("write(null) deletes the cookie (serialize returns null)", () => {
    const store = createCookieStore<string | null>({
      cookieName: "test.cookie",
      parse: (raw) => raw,
      serialize: () => null,
      serverValue: null,
    });
    store.write("anything");
    expect(store.read()).toBeNull();
  });

  it("notifies subscribers on write and allows unsubscribing", () => {
    const store = createCookieStore<boolean>({
      cookieName: "bool.cookie",
      parse: (raw) => raw === "1",
      serialize: (v) => (v ? "1" : null),
      serverValue: false,
    });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.write(true);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    store.write(false);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("getServerSnapshot always returns serverValue", () => {
    const store = createCookieStore<string | null>({
      cookieName: "x",
      parse: (raw) => raw,
      serialize: (v) => v,
      serverValue: "fixed",
    });
    expect(store.getServerSnapshot()).toBe("fixed");
  });

  it("read() returns parsed null when the cookie is absent", () => {
    const store = createCookieStore<string | null>({
      cookieName: "absent.cookie",
      parse: (raw) => raw,
      serialize: (v) => v,
      serverValue: null,
    });
    expect(store.read()).toBeNull();
  });
});
