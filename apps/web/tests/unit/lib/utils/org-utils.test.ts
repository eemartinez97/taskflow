import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => import("@/tests/mocks/server-only"));
vi.mock("next/headers", () => import("@/tests/mocks/next-headers"));

import { cookies } from "next/headers";
import { getOrgOrNull } from "@/lib/utils/org-utils";
import { makeCookies } from "@/tests/mocks/next-headers";
import { ACTIVE_ORG_COOKIE } from "@/lib/utils/active-org";
import { makeOrg } from "@/tests/support/factories";

describe("getOrgOrNull", () => {
  it("returns null when user has no orgs", async () => {
    const trpc = { orgs: { list: vi.fn().mockResolvedValue([]) } } as never;
    expect(await getOrgOrNull(trpc)).toBeNull();
  });

  it("returns the org matching the active cookie", async () => {
    const org1 = makeOrg({ id: "org-1" });
    const org2 = makeOrg({ id: "org-2" });
    const trpc = { orgs: { list: vi.fn().mockResolvedValue([org1, org2]) } } as never;
    vi.mocked(cookies).mockResolvedValue(makeCookies({ [ACTIVE_ORG_COOKIE]: "org-2" }) as never);
    expect(await getOrgOrNull(trpc)).toEqual(org2);
  });

  it("falls back to the first org if cookie is stale", async () => {
    const org1 = makeOrg({ id: "org-1" });
    const trpc = { orgs: { list: vi.fn().mockResolvedValue([org1]) } } as never;
    vi.mocked(cookies).mockResolvedValue(
      makeCookies({ [ACTIVE_ORG_COOKIE]: "deleted-org" }) as never,
    );
    expect(await getOrgOrNull(trpc)).toEqual(org1);
  });

  it("falls back to the first org if cookie is missing", async () => {
    const org1 = makeOrg({ id: "org-1" });
    const trpc = { orgs: { list: vi.fn().mockResolvedValue([org1]) } } as never;
    vi.mocked(cookies).mockResolvedValue(makeCookies({}) as never);
    expect(await getOrgOrNull(trpc)).toEqual(org1);
  });
});
