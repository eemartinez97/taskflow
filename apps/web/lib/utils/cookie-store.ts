type Listener = () => void;

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

interface CookieStoreOptions<T> {
  cookieName: string;
  /** Parses the raw cookie value (or null if absent) into T. */
  parse: (raw: string | null) => T;
  /** Serializes T into the cookie value; return null to delete the cookie. */
  serialize: (value: T) => string | null;
  /** Value used server-side and as the useSyncExternalStore server snapshot. */
  serverValue: T;
}

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

  function read(): T {
    if (typeof document === "undefined") return serverValue;
    const match = new RegExp(`(?:^|; )${cookieName}=([^;]*)`).exec(document.cookie);
    return parse(match?.[1] ?? null);
  }

  function write(value: T): void {
    const serialized = serialize(value);
    document.cookie =
      serialized === null
        ? `${cookieName}=; path=/; max-age=0; samesite=lax`
        : `${cookieName}=${serialized}; path=/; max-age=${String(ONE_YEAR_SECONDS)}; samesite=lax`;
    for (const listener of listeners) listener();
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getServerSnapshot(): T {
    return serverValue;
  }

  return { read, write, subscribe, getServerSnapshot };
}
