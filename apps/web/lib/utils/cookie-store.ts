type Listener = () => void;

export const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

interface CookieStoreOptions<T> {
  cookieName: string;
  /** Parses the raw cookie value (or null if absent) into T. */
  parse: (raw: string | null) => T;
  /** Serializes T into the cookie value; return null to delete the cookie. */
  serialize: (value: T) => string | null;
  /** Value used server-side and as the useSyncExternalStore server snapshot. */
  serverValue: T;
}

/**
 * Call once per cookie, at module scope, and export the returned functions -
 * every real caller (active-org.ts, use-sidebar-collapse.ts) does this. The
 * "re-sync on tab refocus" listener registered below is attached once for
 * the lifetime of the store with no teardown, which is fine for a permanent
 * module singleton but would leak one `document`-level listener per call if
 * this were ever invoked repeatedly (e.g. from inside a component or a
 * per-request scope) instead.
 */
export function createCookieStore<T>({
  cookieName,
  parse,
  serialize,
  serverValue,
}: CookieStoreOptions<T>): {
  read: () => T;
  write: (value: T) => void;
  subscribe: (listener: Listener) => () => void;
  getServerSnapshot: () => T;
} {
  const listeners = new Set<Listener>();
  // Escape regex metacharacters in cookieName - every real cookie name here
  // contains literal dots (e.g. "taskflow.sidebar.collapsed"), which without
  // escaping act as regex any-character wildcards and could match a
  // differently-named cookie that happens to substitute a character for
  // each dot.
  const escapedCookieName = cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cookiePattern = new RegExp(`(?:^|; )${escapedCookieName}=([^;]*)`);

  function notifyListeners(): void {
    for (const listener of listeners) listener();
  }

  function read(): T {
    if (typeof document === "undefined") return serverValue;
    // Only the environment access itself (document.cookie, the regex match)
    // is wrapped - a bug in the caller-supplied parse() should still throw
    // normally rather than being silently swallowed as if cookies were
    // blocked.
    let raw: string | null;
    try {
      raw = cookiePattern.exec(document.cookie)?.[1] ?? null;
    } catch {
      // Cookie access blocked (e.g. "block all cookies" setting) - fall back
      // rather than crash the render that reads this.
      return serverValue;
    }
    return parse(raw);
  }

  function write(value: T): void {
    // Only the environment write itself is wrapped, for the same reason as
    // read() above - a bug in serialize() should still throw normally.
    const serialized = serialize(value);
    try {
      document.cookie =
        serialized === null
          ? `${cookieName}=; path=/; max-age=0; samesite=lax`
          : `${cookieName}=${serialized}; path=/; max-age=${String(ONE_YEAR_SECONDS)}; samesite=lax`;
    } catch {
      // Cookie access blocked - state just won't persist this time.
    }
    notifyListeners();
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getServerSnapshot(): T {
    return serverValue;
  }

  // Cookie changes made in another tab fire no DOM event of their own (unlike
  // localStorage's "storage" event) - re-sync on tab refocus so switching
  // back to a tab reflects whatever changed elsewhere in the meantime.
  // Deliberately does not diff old vs. new value before notifying: every
  // subscriber already re-reads via useSyncExternalStore's getSnapshot and
  // bails out via Object.is on no change, so skipping notifyListeners() here
  // would only save that already-cheap re-check at the cost of tracking a
  // "last known value" per store correctly across both this handler and
  // write() - not worth it for how rarely tabs refocus.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") notifyListeners();
    });
  }

  return { read, write, subscribe, getServerSnapshot };
}
