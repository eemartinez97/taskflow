import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@taskflow/database", () => import("@/tests/mocks/database.js"));
vi.mock("bcrypt", () => import("@/tests/mocks/bcrypt.js"));

import { db, mockAuthorizedUser, mockDbUser, validLoginCredentials } from "@/tests/helpers.js";
import { authorizeCredentials } from "@/lib/auth/credentials.js";
import { webMockDb } from "@/tests/mocks/database.js";
import bcrypt from "@/tests/mocks/bcrypt.js";

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user found with hashed password
    webMockDb.user.findUnique.mockResolvedValue(mockDbUser);
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
  });

  it("returns an AuthorizedUser (without password) on valid credentials", async () => {
    const result = await authorizeCredentials(db, validLoginCredentials);
    expect(result).toEqual(mockAuthorizedUser);
  });

  it("does NOT include the password field in the result", async () => {
    const result = await authorizeCredentials(db, validLoginCredentials);
    expect(result).not.toHaveProperty("password");
  });

  it("normalizes email to lowercase before querying", async () => {
    await authorizeCredentials(db, {
      ...validLoginCredentials,
      email: validLoginCredentials.email.toUpperCase(),
    });
    expect(webMockDb.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: validLoginCredentials.email },
      }),
    );
  });

  it("trims whitespace from email before querying", async () => {
    await authorizeCredentials(db, {
      ...validLoginCredentials,
      email: ` ${validLoginCredentials.email} `,
    });
    expect(webMockDb.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: validLoginCredentials.email },
      }),
    );
  });

  it("returns null when email is missing", async () => {
    expect(await authorizeCredentials(db, { password: "pass" })).toBeNull();
    expect(webMockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when password is missing", async () => {
    expect(await authorizeCredentials(db, { email: validLoginCredentials.email })).toBeNull();
    expect(webMockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when email is empty string", async () => {
    expect(await authorizeCredentials(db, { email: "", password: "pass" })).toBeNull();
  });

  it("returns null when user is not found in DB", async () => {
    webMockDb.user.findUnique.mockResolvedValueOnce(null);
    expect(await authorizeCredentials(db, validLoginCredentials)).toBeNull();
  });

  it("returns null when user has no stored password (OAuth-only account)", async () => {
    webMockDb.user.findUnique.mockResolvedValueOnce({ ...mockDbUser, password: null });
    expect(await authorizeCredentials(db, validLoginCredentials)).toBeNull();
    // verifyPassword must NOT be called - no hash to compare against
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("returns null when password verification fails", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false);
    expect(await authorizeCredentials(db, validLoginCredentials)).toBeNull();
  });

  it("returns null (does NOT throw) when the DB throws", async () => {
    webMockDb.user.findUnique.mockRejectedValueOnce(new Error("Connection refused"));
    expect(await authorizeCredentials(db, validLoginCredentials)).toBeNull();
  });

  it("selects only the required fields (no over-fetching)", async () => {
    await authorizeCredentials(db, validLoginCredentials);
    expect(webMockDb.user.findUnique).toHaveBeenCalledWith({
      where: { email: validLoginCredentials.email },
      select: { id: true, email: true, name: true, image: true, password: true },
    });
  });
});
