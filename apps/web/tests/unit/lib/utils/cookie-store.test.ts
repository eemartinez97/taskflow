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

  it("read() falls back to serverValue when accessing document.cookie throws", () => {
    const store = createCookieStore<string | null>({
      cookieName: "throw-read.cookie",
      parse: (raw) => raw,
      serialize: (v) => v,
      serverValue: "fallback",
    });
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(store.read()).toBe("fallback");
    } finally {
      if (descriptor) Object.defineProperty(document, "cookie", descriptor);
    }
  });

  it("write() swallows a thrown document.cookie setter and still notifies listeners", () => {
    const store = createCookieStore<string>({
      cookieName: "throw-write.cookie",
      parse: (raw) => raw ?? "",
      serialize: (v) => v,
      serverValue: "",
    });
    const listener = vi.fn();
    store.subscribe(listener);
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set() {
        throw new Error("blocked");
      },
    });
    try {
      expect(() => {
        store.write("value");
      }).not.toThrow();
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      if (descriptor) Object.defineProperty(document, "cookie", descriptor);
    }
  });

  /**
   * Captures the exact "visibilitychange" handler this store's
   * createCookieStore() call attaches to `document`, so a test can invoke
   * only THAT handler directly. Other stores created elsewhere in this file
   * (or at module scope by active-org.ts / use-sidebar-collapse.ts) also
   * attach their own handlers to the same shared jsdom `document`, so a real
   * `dispatchEvent` would fire all of them at once and make hit counts
   * depend on test order.
   */
  function createStoreAndCaptureVisibilityHandler(cookieName: string): {
    store: ReturnType<typeof createCookieStore<boolean>>;
    handler: () => void;
  } {
    const addSpy = vi.spyOn(document, "addEventListener");
    const store = createCookieStore<boolean>({
      cookieName,
      parse: (raw) => raw === "1",
      serialize: (v) => (v ? "1" : null),
      serverValue: false,
    });
    const call = addSpy.mock.calls.find(([type]) => type === "visibilitychange");
    addSpy.mockRestore();
    if (!call) {
      throw new Error("expected createCookieStore to register a visibilitychange listener");
    }
    return { store, handler: call[1] as unknown as () => void };
  }

  it("re-notifies subscribers when the tab becomes visible again", () => {
    const { store, handler } = createStoreAndCaptureVisibilityHandler("visibility-visible.cookie");
    const listener = vi.fn();
    store.subscribe(listener);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    handler();

    expect(listener).toHaveBeenCalledOnce();
  });

  it("does not notify subscribers when the tab becomes hidden", () => {
    const { store, handler } = createStoreAndCaptureVisibilityHandler("visibility-hidden.cookie");
    const listener = vi.fn();
    store.subscribe(listener);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    handler();

    expect(listener).not.toHaveBeenCalled();
  });

  it("read() lets a parse() bug throw instead of silently falling back to serverValue", () => {
    const store = createCookieStore<string | null>({
      cookieName: "parse-throws.cookie",
      parse: () => {
        throw new Error("bad parse");
      },
      serialize: (v) => v,
      serverValue: "fallback",
    });
    document.cookie = "parse-throws.cookie=anything";
    expect(() => store.read()).toThrow("bad parse");
  });

  it("write() lets a serialize() bug throw instead of silently swallowing it", () => {
    const store = createCookieStore<string>({
      cookieName: "serialize-throws.cookie",
      parse: (raw) => raw ?? "",
      serialize: () => {
        throw new Error("bad serialize");
      },
      serverValue: "",
    });
    const listener = vi.fn();
    store.subscribe(listener);
    expect(() => {
      store.write("value");
    }).toThrow("bad serialize");
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not treat dots in the cookie name as regex wildcards", () => {
    const store = createCookieStore<string | null>({
      cookieName: "a.b",
      parse: (raw) => raw,
      serialize: (v) => v,
      serverValue: null,
    });
    // Unescaped, the "a.b" pattern's dot would wildcard-match any character,
    // including this differently-named cookie ("aXb", no literal dot).
    document.cookie = "aXb=wrong-value";
    expect(store.read()).toBeNull();
  });

  it("does not attempt to attach a visibilitychange listener when document is undefined (SSR)", () => {
    const original = globalThis.document;
    // @ts-expect-error simulate SSR
    delete globalThis.document;
    try {
      expect(() => {
        createCookieStore<string | null>({
          cookieName: "ssr-create.cookie",
          parse: (raw) => raw,
          serialize: (v) => v,
          serverValue: "server-default",
        });
      }).not.toThrow();
    } finally {
      globalThis.document = original;
    }
  });
});
