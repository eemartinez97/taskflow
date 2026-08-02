import { describe, expect, it, vi } from "vitest";

vi.mock("bcrypt", () => import("@/tests/mocks/bcrypt"));

import { authorizeCredentials } from "@/lib/auth/credentials";
import { compare as mockCompare } from "@/tests/mocks/bcrypt";
import { mockDb } from "@/tests/mocks/taskflow-database";
import { db } from "@/tests/support/factories";
import { mockDbUser } from "@/tests/support/fixtures";

describe("authorizeCredentials", () => {
  it("returns null when email is missing", async () => {
    expect(await authorizeCredentials(db, { password: "x" })).toBeNull();
  });

  it("returns null when password is missing", async () => {
    expect(await authorizeCredentials(db, { email: "a@b.com" })).toBeNull();
  });

  it("normalizes email to lowercase/trimmed before lookup", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(mockDbUser);
    mockCompare.mockResolvedValueOnce(true);
    await authorizeCredentials(db, {
      email: "  Alice@TaskFlow.dev  ",
      password: "correct-password",
    });
    expect(mockDb.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "alice@taskflow.dev" } }),
    );
  });

  it("returns null when no user is found", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);
    const result = await authorizeCredentials(db, {
      email: "ghost@taskflow.dev",
      password: "x",
    });
    expect(result).toBeNull();
  });

  it("returns null when the user has no password hash (OAuth-only account)", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ ...mockDbUser, password: null });
    const result = await authorizeCredentials(db, {
      email: mockDbUser.email,
      password: "x",
    });
    expect(result).toBeNull();
  });

  it("returns null when the password doesn't match", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(mockDbUser);
    mockCompare.mockResolvedValueOnce(false);
    const result = await authorizeCredentials(db, {
      email: mockDbUser.email,
      password: "wrong",
    });
    expect(result).toBeNull();
  });

  it("returns the user without the password field on success", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(mockDbUser);
    mockCompare.mockResolvedValueOnce(true);
    const result = await authorizeCredentials(db, {
      email: mockDbUser.email,
      password: "correct-password",
    });
    expect(result).toEqual({
      id: mockDbUser.id,
      email: mockDbUser.email,
      name: mockDbUser.name,
      image: mockDbUser.image,
    });
    expect(result).not.toHaveProperty("password");
  });

  it("returns null (never throws) when the DB call rejects", async () => {
    mockDb.user.findUnique.mockRejectedValueOnce(new Error("connection lost"));
    const result = await authorizeCredentials(db, {
      email: mockDbUser.email,
      password: "x",
    });
    expect(result).toBeNull();
  });
});
