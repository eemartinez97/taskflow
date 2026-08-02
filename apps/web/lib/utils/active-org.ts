import { createCookieStore } from "./cookie-store";

export const ACTIVE_ORG_COOKIE = "taskflow.activeOrgId";

const store = createCookieStore<string | null>({
  cookieName: ACTIVE_ORG_COOKIE,
  parse: (raw) => raw,
  serialize: (value) => value,
  serverValue: null,
});

export const readActiveOrgId = store.read;

export const setActiveOrgId = (orgId: string): void => {
  store.write(orgId);
};
export const clearActiveOrgId = (): void => {
  store.write(null);
};

export const subscribeActiveOrg = store.subscribe;
export const getServerActiveOrgId = store.getServerSnapshot;
