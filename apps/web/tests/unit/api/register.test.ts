import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@taskflow/database", () => import("@/tests/mocks/taskflow-database"));
vi.mock("bcrypt", () => import("@/tests/mocks/bcrypt"));

import {
  mockDbUser,
  setupFetchSpy,
  type FetchSpy,
  makeApiRequest,
  teardownFetchSpy,
  makeRawApiRequest,
  mockFetchResponse,
  makeJsonThrowRequest,
  validRegisterPayload,
} from "@/tests/helpers";
import { webMockDb } from "@/tests/mocks/taskflow-database";
import { POST } from "@/app/api/auth/register/route";
import bcrypt from "@/tests/mocks/bcrypt";

// Typed success response fixture - used as the default mock return value
const successResponse = mockFetchResponse(
  {
    user: { id: mockDbUser.id, email: mockDbUser.email, name: mockDbUser.name },
  },
  201,
);

describe("POST /api/auth/register", () => {
  // fetchSpy is declared at describe scope so all tests share the same reference
  // but it is re-created fresh in beforeEach via setupFetchSpy
  let _fetchSpy: FetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fetch spy with default 201 success response
    _fetchSpy = setupFetchSpy(successResponse);

    // Default: no existing user, create succeeds
    webMockDb.user.findUnique.mockResolvedValue(null);
    webMockDb.user.create.mockResolvedValue({
      id: mockDbUser.id,
      email: mockDbUser.email,
      name: mockDbUser.name,
    });
  });

  afterEach(() => {
    teardownFetchSpy();
  });

  // Helper: calls the Route Handler directly - not through fetch
  async function callPOST(body: unknown): Promise<Response> {
    return POST(makeApiRequest("/api/auth/register", body) as never);
  }

  async function callPOSTRaw(rawBody: string): Promise<Response> {
    return POST(makeRawApiRequest("/api/auth/register", rawBody) as never);
  }

  // -- Happy path --

  it("returns 201 with user object on valid registration", async () => {
    const res = await callPOST(validRegisterPayload);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { id: string; email: string } };
    expect(body.user.email).toBe(mockDbUser.email);
  });

  it("hashes the password before storing", async () => {
    await callPOST(validRegisterPayload);
    expect(bcrypt.hash).toHaveBeenCalledWith(validRegisterPayload.password, 12);
  });

  it("does NOT include the password hash in the response", async () => {
    const res = await callPOST(validRegisterPayload);
    expect(await res.text()).not.toContain("hashed:");
  });

  // -- Email normalization --

  it("lowercases the email before storing", async () => {
    // Uppercase email - passes Zod (emails are case-insensitive) then normalized
    await callPOST({
      ...validRegisterPayload,
      email: validRegisterPayload.email.toUpperCase(),
    });
    expect(webMockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: validRegisterPayload.email,
        }) as unknown,
      }),
    );
  });

  it("trims leading/trailing whitespace from email before storing", async () => {
    await callPOST({
      ...validRegisterPayload,
      email: ` ${validRegisterPayload.email} `,
    });
    expect(webMockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: validRegisterPayload.email }) as unknown,
      }),
    );
  });

  it("normalizes email that is both uppercase and whitespace-padded", async () => {
    await callPOST({
      ...validRegisterPayload,
      email: ` ${validRegisterPayload.email.toUpperCase()} `,
    });
    expect(webMockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: validRegisterPayload.email }) as unknown,
      }),
    );
  });

  // -- preprocessBody edge cases

  it("returns 400 when body is null", async () => {
    const res = await callPOSTRaw("null");
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is a JSON array (not an object)", async () => {
    // typeof [] === "object" but is not a plain object - Zod rejects it
    const res = await callPOST([validRegisterPayload]);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is a plain string (not an object)", async () => {
    const res = await callPOST("just-a-string");
    expect(res.status).toBe(400);
  });

  it("returns 400 when email field is not a string", async () => {
    const res = await callPOST({ ...validRegisterPayload, email: 12345 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when req.json() throws (malformed request body)", async () => {
    const res = await POST(makeJsonThrowRequest("/api/auth/register") as never);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid JSON body.");
  });

  // -- Validation errors --

  it("returns 400 when email is invalid", async () => {
    const res = await callPOST({ ...validRegisterPayload, email: "bad" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    const res = await callPOST({
      ...validRegisterPayload,
      password: "short",
      confirmPassword: "short",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when passwords do not match", async () => {
    const res = await callPOST({ ...validRegisterPayload, confirmPassword: "different" });
    expect(res.status).toBe(400);
  });

  // -- Conflict and server errors

  it("returns 409 when email is already registered", async () => {
    webMockDb.user.findUnique.mockResolvedValueOnce({ id: mockDbUser.id });
    const res = await callPOST(validRegisterPayload);
    expect(res.status).toBe(409);
  });

  it("user.create is NOT called when user already exists (guard before hash)", async () => {
    webMockDb.user.findUnique.mockResolvedValueOnce({ id: mockDbUser.id });
    await callPOST(validRegisterPayload);
    expect(webMockDb.user.create).not.toHaveBeenCalled();
  });

  it("returns 500 when the DB throws on findUnique", async () => {
    webMockDb.user.findUnique.mockRejectedValueOnce(new Error("DB error"));
    const res = await callPOST(validRegisterPayload);
    expect(res.status).toBe(500);
  });

  it("returns 500 when the DB throws on create", async () => {
    webMockDb.user.create.mockRejectedValueOnce(new Error("DB error"));
    const res = await callPOST(validRegisterPayload);
    expect(res.status).toBe(500);
  });
});
