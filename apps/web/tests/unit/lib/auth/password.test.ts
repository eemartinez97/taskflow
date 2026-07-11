import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock bcrypt before importing the module under
vi.mock("bcrypt", () => import("@/tests/mocks/bcrypt"));

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { HASH_PASSWORD, HASHED_PASSWORD } from "@/tests/helpers";
import bcrypt from "@/tests/mocks/bcrypt";

describe("hashPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls bcrypt.hash with the plain text and SALT_ROUNDS=12", async () => {
    const password = "my-password";
    await hashPassword(password);
    expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
  });

  it("returns the hashed string from bcrypt.hash", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValueOnce(HASHED_PASSWORD);
    expect(await hashPassword("pass")).toBe(HASHED_PASSWORD);
  });

  it("resolves to a non-empty string", async () => {
    const result = await hashPassword("any-password");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("verifyPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls bcrypt.compare with plain text and hash", async () => {
    await verifyPassword("plain", HASH_PASSWORD);
    expect(bcrypt.compare).toHaveBeenCalledWith("plain", HASH_PASSWORD);
  });

  it("returns true when bcrypt.compare resolves true", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
    expect(await verifyPassword("correct", HASH_PASSWORD)).toBeTruthy();
  });

  it("returns false when bcrypt.compare resolves false", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false);
    expect(await verifyPassword("wrong", HASH_PASSWORD)).toBeFalsy();
  });

  it("returns false (does NOT throw) when bcrypt.compare rejects", async () => {
    vi.mocked(bcrypt.compare).mockRejectedValueOnce(new Error("bcrypt error"));
    expect(await verifyPassword("any", "any")).toBeFalsy();
  });
});
