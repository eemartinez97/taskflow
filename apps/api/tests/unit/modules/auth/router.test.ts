import { describe, expect, it, vi } from "vitest";

import { authRouter } from "../../../../src/modules/auth/router";
import * as service from "../../../../src/modules/auth/service";
import { db, VALID_USER } from "../../../helpers";
import { callerFor, expectTRPCError } from "../../../support/trpc";

vi.mock("../../../../src/modules/auth/service");

const caller = () => callerFor(authRouter);

describe("auth router", () => {
  it("me -> getMe(db, ctx.user.id)", async () => {
    await caller().me();

    expect(service.getMe).toHaveBeenCalledWith(db, VALID_USER.id);
  });

  it("signOut -> signOutUser", async () => {
    await caller().signOut();

    expect(service.signOutUser).toHaveBeenCalledWith(db, VALID_USER.id);
  });

  it("updateProfile -> updateMyProfile with validated input", async () => {
    await caller().updateProfile({ name: "Bob" });

    expect(service.updateMyProfile).toHaveBeenCalledWith(db, VALID_USER.id, { name: "Bob" });
  });

  it.each(["me", "signOut"] as const)("%s requires a session", async (procedure) => {
    await expectTRPCError(callerFor(authRouter, null)[procedure](), "UNAUTHORIZED");
  });
});
