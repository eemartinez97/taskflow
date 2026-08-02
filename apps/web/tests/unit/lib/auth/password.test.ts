import { describe, expect, it, vi } from "vitest";

vi.mock("bcrypt", () => import("@/tests/mocks/bcrypt"));

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import bcrypt from "bcrypt";
import { compare as mockCompare } from "@/tests/mocks/bcrypt";

describe("hashPassword", () => {
  it("delegates to bcrypt.hash with 12 salt rounds", async () => {
    await hashPassword("plain");
    expect(bcrypt.hash).toHaveBeenCalledWith("plain", 12);
  });
});

describe("verifyPassword", () => {
  it("returns true when bcrypt.compare resolves true", async () => {
    mockCompare.mockResolvedValueOnce(true);
    expect(await verifyPassword("plain", "hash")).toBe(true);
  });

  it("returns false when bcrypt.compare resolves false", async () => {
    mockCompare.mockResolvedValueOnce(false);
    expect(await verifyPassword("plain", "hash")).toBe(false);
  });

  it("returns false (never throws) when bcrypt.compare rejects", async () => {
    mockCompare.mockRejectedValueOnce(new Error("boom"));
    expect(await verifyPassword("plain", "hash")).toBe(false);
  });
});
