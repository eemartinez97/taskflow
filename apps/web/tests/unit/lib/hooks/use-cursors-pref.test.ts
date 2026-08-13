import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCursorsHidden } from "@/lib/hooks/use-cursors-pref";
import { api } from "@/lib/trpc/client";
import { makeMembership, makeOrg } from "@/tests/support/factories";
import { VALID_ORG_ID } from "@/tests/support/fixtures";
import {
  getLastMockUtils,
  getLastMutationOptions,
  mockUseQuery,
  setupMutationMock,
} from "@/tests/support/trpc";

interface CursorMutationOptions {
  onMutate?: (vars: { orgId: string; cursorsHidden: boolean }) => Promise<{ previous: unknown }>;
  onError?: (err: unknown, vars: unknown, ctx: { previous: unknown } | undefined) => void;
  onSettled?: () => void;
}

const OTHER_ORG_ID = "00000000-0000-4000-8000-00000000ffff";

describe("useCursorsHidden - read", () => {
  it("defaults to false when orgs.list has no data yet", () => {
    mockUseQuery(api.orgs.list, undefined);
    const { result } = renderHook(() => useCursorsHidden(VALID_ORG_ID));
    expect(result.current.cursorsHidden).toBe(false);
  });

  it("defaults to false when there is no matching org in the cache", () => {
    mockUseQuery(api.orgs.list, []);
    const { result } = renderHook(() => useCursorsHidden(VALID_ORG_ID));
    expect(result.current.cursorsHidden).toBe(false);
  });

  it("reads the matching org's own cursorsHidden value", () => {
    mockUseQuery(api.orgs.list, [
      makeOrg({ memberships: [makeMembership({ cursorsHidden: true })] }),
    ]);
    const { result } = renderHook(() => useCursorsHidden(VALID_ORG_ID));
    expect(result.current.cursorsHidden).toBe(true);
  });
});

describe("useCursorsHidden - write", () => {
  it("mutates with the given orgId and the requested value", () => {
    mockUseQuery(api.orgs.list, []);
    const { mutateMock } = setupMutationMock(api.orgs.updateMyCursorPreference);
    const { result } = renderHook(() => useCursorsHidden(VALID_ORG_ID));

    result.current.setCursorsHidden(true);

    expect(mutateMock).toHaveBeenCalledWith({ orgId: VALID_ORG_ID, cursorsHidden: true });
  });

  it("onMutate cancels in-flight fetches and snapshots the previous data", async () => {
    mockUseQuery(api.orgs.list, []);
    renderHook(() => useCursorsHidden(VALID_ORG_ID));
    const utils = getLastMockUtils();
    const snapshot = [makeOrg()];
    utils.orgs.list.getData.mockReturnValue(snapshot);

    const call = getLastMutationOptions<CursorMutationOptions>(api.orgs.updateMyCursorPreference);

    await expect(call.onMutate?.({ orgId: VALID_ORG_ID, cursorsHidden: true })).resolves.toEqual({
      previous: snapshot,
    });
    expect(utils.orgs.list.cancel).toHaveBeenCalled();
  });

  it("onMutate's updater flips only the target org's membership, leaving others untouched", async () => {
    mockUseQuery(api.orgs.list, []);
    renderHook(() => useCursorsHidden(VALID_ORG_ID));
    const call = getLastMutationOptions<CursorMutationOptions>(api.orgs.updateMyCursorPreference);

    await call.onMutate?.({ orgId: VALID_ORG_ID, cursorsHidden: true });

    const utils = getLastMockUtils();
    const updater = utils.orgs.list.setData.mock.calls.at(-1)?.[1] as (
      prev: ReturnType<typeof makeOrg>[] | undefined,
    ) => ReturnType<typeof makeOrg>[] | undefined;

    const mine = makeOrg({
      id: VALID_ORG_ID,
      memberships: [makeMembership({ cursorsHidden: false })],
    });
    const other = makeOrg({
      id: OTHER_ORG_ID,
      memberships: [makeMembership({ cursorsHidden: false })],
    });

    const next = updater([mine, other]);
    expect(next?.find((o) => o.id === VALID_ORG_ID)?.memberships[0]?.cursorsHidden).toBe(true);
    expect(next?.find((o) => o.id === OTHER_ORG_ID)?.memberships[0]?.cursorsHidden).toBe(false);
  });

  it("onMutate's updater is a no-op when there is no cached data yet", async () => {
    mockUseQuery(api.orgs.list, []);
    renderHook(() => useCursorsHidden(VALID_ORG_ID));
    const call = getLastMutationOptions<CursorMutationOptions>(api.orgs.updateMyCursorPreference);

    await call.onMutate?.({ orgId: VALID_ORG_ID, cursorsHidden: true });

    const utils = getLastMockUtils();
    const updater = utils.orgs.list.setData.mock.calls.at(-1)?.[1] as (prev: unknown) => unknown;
    expect(updater(undefined)).toBeUndefined();
  });

  it("rolls back to the snapshot onError", () => {
    mockUseQuery(api.orgs.list, []);
    renderHook(() => useCursorsHidden(VALID_ORG_ID));
    const call = getLastMutationOptions<CursorMutationOptions>(api.orgs.updateMyCursorPreference);
    const previous = [makeOrg()];

    call.onError?.(new Error("x"), {}, { previous });

    const utils = getLastMockUtils();
    expect(utils.orgs.list.setData).toHaveBeenCalledWith(undefined, previous);
  });

  it("onError is a no-op when there is no rollback context", () => {
    mockUseQuery(api.orgs.list, []);
    renderHook(() => useCursorsHidden(VALID_ORG_ID));
    const call = getLastMutationOptions<CursorMutationOptions>(api.orgs.updateMyCursorPreference);

    expect(() => {
      call.onError?.(new Error("x"), {}, undefined);
    }).not.toThrow();
  });

  it("invalidates orgs.list onSettled", () => {
    mockUseQuery(api.orgs.list, []);
    renderHook(() => useCursorsHidden(VALID_ORG_ID));
    const call = getLastMutationOptions<CursorMutationOptions>(api.orgs.updateMyCursorPreference);

    call.onSettled?.();

    const utils = getLastMockUtils();
    expect(utils.orgs.list.invalidate).toHaveBeenCalled();
  });
});
