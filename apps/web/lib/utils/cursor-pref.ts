import { createCookieStore } from "./cookie-store";

export const CURSORS_PREF_COOKIE = "taskflow.cursorsHidden";

const store = createCookieStore<boolean>({
  cookieName: CURSORS_PREF_COOKIE,
  parse: (raw) => raw === "1",
  serialize: (value) => (value ? "1" : null),
  serverValue: false,
});

export const readCursorsHidden = store.read;
export const setCursorsHidden = store.write;
export const subscribeCursorsPref = store.subscribe;
export const getServerCursorsHidden = store.getServerSnapshot;
