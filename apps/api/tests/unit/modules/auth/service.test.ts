import { describe, expect, it } from "vitest";

import { getMe, signOutUser, updateMyProfile } from "../../../../src/modules/auth/service";
import { db, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";

const user = { ...VALID_USER, image: null };

describe("getMe", () => {
  it("returns the trimmed session profile", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(user);

    await expect(getMe(db, VALID_USER.id)).resolves.toEqual(user);
  });

  it("throws NOT_FOUND when the account is gone", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);

    await expect(getMe(db, VALID_USER.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("signOutUser", () => {
  it("deletes every server-side session", async () => {
    await expect(signOutUser(db, VALID_USER.id)).resolves.toEqual({ success: true });

    expect(mockDb.session.deleteMany).toHaveBeenCalledWith({ where: { userId: VALID_USER.id } });
  });
});

describe("updateMyProfile", () => {
  it("checks existence before updating", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(user);
    mockDb.user.update.mockResolvedValueOnce({ ...user, name: "Bob" });

    await expect(updateMyProfile(db, VALID_USER.id, { name: "Bob" })).resolves.toMatchObject({
      name: "Bob",
    });
  });

  it("throws NOT_FOUND without touching update", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);

    await expect(updateMyProfile(db, VALID_USER.id, { name: "Bob" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});
