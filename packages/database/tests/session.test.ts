import type { PrismaClient } from "../src/generated";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import { validateSessionToken } from "@taskflow/database";

// -- Fixtures --

const VALID_TOKEN = "valid-session-token";

const mockUser: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
} = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "alice@taskflow.dev",
  name: "Alice",
  image: null,
};

function makeSession(overrides: Partial<{ expires: Date; user: typeof mockUser }> = {}) {
  return {
    id: "session-id",
    sessionToken: VALID_TOKEN,
    userId: mockUser.id,
    expires: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
    user: mockUser,
    ...overrides,
  };
}

// Minimal PrismaClient mock - only the session model is needed
function makeMockDb(sessionResult: unknown): PrismaClient {
  return {
    session: {
      findUnique: vi.fn().mockResolvedValue(sessionResult),
    },
  } as unknown as PrismaClient;
}

describe("validateSessionToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns SessionUser when session is valid", async () => {
    const db = makeMockDb(makeSession());
    const result = await validateSessionToken(db, VALID_TOKEN);

    expect(result).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      image: mockUser.image,
    });
  });

  it("queries by sessionToken", async () => {
    const db = makeMockDb(makeSession());
    await validateSessionToken(db, VALID_TOKEN);

    expect(db.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionToken: VALID_TOKEN },
      }),
    );
  });

  it("selects only id, email, name, image from user (no over-fetching)", async () => {
    const db = makeMockDb(makeSession());
    await validateSessionToken(db, VALID_TOKEN);

    expect(db.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          user: {
            select: { id: true, email: true, name: true, image: true },
          },
        },
      }),
    );
  });

  it("returns null when session is not found", async () => {
    const db = makeMockDb(null);
    expect(await validateSessionToken(db, "unknown-token")).toBeNull();
  });

  it("returns null when session is expired", async () => {
    const db = makeMockDb(makeSession({ expires: new Date(Date.now() - 1000) }));
    expect(await validateSessionToken(db, VALID_TOKEN)).toBeNull();
  });

  it("returns null exactly at expiry boundary (expires === now)", async () => {
    // expires <= new Date() means an expired session is rejected even when
    // it expires at the exact millisecond of the check
    const now = new Date();
    const db = makeMockDb(makeSession({ expires: now }));
    expect(await validateSessionToken(db, VALID_TOKEN)).toBeNull();
  });

  it("passes through null name from session user)", async () => {
    const db = makeMockDb(makeSession({ user: { ...mockUser, name: null } }));
    const result = await validateSessionToken(db, VALID_TOKEN);
    assert(result !== null, "expected a SessionUser, got null");
    expect(result.name).toBeNull();
  });

  it("returns exactly the four SessionUser fields - no over-fetching", async () => {
    const db = makeMockDb(makeSession());
    const result = await validateSessionToken(db, VALID_TOKEN);

    assert(result !== null, "expected a SessionUser, got null");
    expect(Object.keys(result)).toEqual(expect.arrayContaining(["id", "email", "name", "image"]));
    expect(Object.keys(result)).toHaveLength(4);
  });
});
