import { afterEach, describe, expect, it } from "vitest";
import {
  ACTIVE_ORG_COOKIE,
  clearActiveOrgId,
  getServerActiveOrgId,
  readActiveOrgId,
  setActiveOrgId,
} from "@/lib/utils/active-org";

afterEach(() => {
  document.cookie = `${ACTIVE_ORG_COOKIE}=; path=/; max-age=0`;
});

describe("active-org store", () => {
  it("setActiveOrgId persists and readActiveOrgId retrieves it", () => {
    setActiveOrgId("org-123");
    expect(readActiveOrgId()).toBe("org-123");
  });

  it("clearActiveOrgId removes the cookie", () => {
    setActiveOrgId("org-123");
    clearActiveOrgId();
    expect(readActiveOrgId()).toBeNull();
  });

  it("getServerActiveOrgId returns null (SSR default)", () => {
    expect(getServerActiveOrgId()).toBeNull();
  });
});
