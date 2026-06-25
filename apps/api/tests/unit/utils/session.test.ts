import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "../../mocks/database-mock.js";
import { db, makeValidSessionRow, VALID_USER } from "../../helpers.js";
import { validateSessionToken } from "../../../src/utils/session.js";

describe("validateSessionToken", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns ValidatedSession when token is valid and session is not expired", async () => {
    mockDb.session.findUnique.mockResolvedValueOnce(makeValidSessionRow("good-token"));

    const result = await validateSessionToken(db, "good-token");

    expect(result).toEqual({
      userId: VALID_USER.id,
      email: VALID_USER.email,
      name: "Alice",
    });
  });

  it("queries session with correct token and includes user select", async () => {
    mockDb.session.findUnique.mockResolvedValueOnce(makeValidSessionRow("tok"));
    await validateSessionToken(db, "tok");

    expect(mockDb.session.findUnique).toHaveBeenCalledWith({
      where: { sessionToken: "tok" },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  });

  it("returns null when session is not found in DB", async () => {
    mockDb.session.findUnique.mockResolvedValueOnce(null);
    expect(await validateSessionToken(db, "ghost")).toBeNull();
  });

  it("returns null when session is expired", async () => {
    mockDb.session.findUnique.mockResolvedValueOnce({
      ...makeValidSessionRow("expired"),
      expires: new Date(Date.now() - 1_000),
    });
    expect(await validateSessionToken(db, "expired")).toBeNull();
  });

  it("coerces null user.name to null (not undefined)", async () => {
    mockDb.session.findUnique.mockResolvedValueOnce(makeValidSessionRow("tok", null));
    const result = await validateSessionToken(db, "tok");
    expect(result?.name).toBeNull();
  });

  it("returns null for a session that expires exactly at now (boundary)", async () => {
    const now = Date.now();
    vi.setSystemTime(now);
    mockDb.session.findUnique.mockResolvedValueOnce({
      ...makeValidSessionRow("boundary"),
      expires: new Date(now), // expires === now -> not valid
    });
    expect(await validateSessionToken(db, "boundary")).toBeNull();
    vi.useRealTimers();
  });
});
