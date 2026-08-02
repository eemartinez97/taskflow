import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@taskflow/database";
import { hashPassword } from "@/lib/auth/password";
import { POST } from "@/app/api/auth/register/route";
import { makeInvalidJsonRequest, makePostRequest } from "../helpers/request";
import { MOCK_DB_USER, VALID_REGISTER_PAYLOAD } from "../helpers/mock-data";
import { NextRequest } from "next/server";

// -- Module mocks (hoisted before all imports by Vitest) --
vi.mock("@taskflow/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: vi.fn<(...args: unknown[]) => Promise<typeof MOCK_DB_USER>>(),
    },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(),
}));

// -- Typed handles for mock functions --
const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockCreate = vi.mocked(prisma.user.create);
const mockHashPassword = vi.mocked(hashPassword);

/** Reads the JSON body of a NextResponse with a concrete return type. */
async function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// -- Tests --
describe("POST /api/auth/register", () => {
  beforeEach(() => {
    mockFindUnique.mockResolvedValue(null); // no existing user
    mockCreate.mockResolvedValue(MOCK_DB_USER as never);
    mockHashPassword.mockResolvedValue("hashed_password_value");
  });

  // -- 201 happy path --

  describe("201 - success", () => {
    it("returns 201 and the created user payload", async () => {
      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      const body = await readJson<{ user: typeof MOCK_DB_USER }>(res);

      expect(res.status).toBe(201);
      expect(body.user).toEqual(MOCK_DB_USER);
    });

    it("hashes the password before calling prisma.user.create", async () => {
      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));

      expect(mockHashPassword).toHaveBeenCalledOnce();
      expect(mockHashPassword).toHaveBeenCalledWith(VALID_REGISTER_PAYLOAD.password);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password: "hashed_password_value" }) as unknown,
        }),
      );
    });

    it("normalises the stored email to lowercase", async () => {
      const payload = { ...VALID_REGISTER_PAYLOAD, email: "Alice@TaskFlow.DEV" };
      await POST(makePostRequest("/api/auth/register", payload));

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: "alice@taskflow.dev" } }),
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: "alice@taskflow.dev" }) as unknown,
        }),
      );
    });

    it("trims whitespace from the email before Zod validation (autofill compat)", async () => {
      const payload = { ...VALID_REGISTER_PAYLOAD, email: "  alice@taskflow.dev  " };
      const res = await POST(makePostRequest("/api/auth/register", payload));

      expect(res.status).toBe(201);
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: "alice@taskflow.dev" } }),
      );
    });
  });

  // -- 400 validation errors --

  describe("400 - validation", () => {
    it("returns 400 for an unparseable JSON body", async () => {
      const res = await POST(makeInvalidJsonRequest("/api/auth/register"));
      const body = await readJson<{ error: string }>(res);

      expect(res.status).toBe(400);
      expect(body.error).toBe("Invalid JSON body.");
    });

    it("returns 400 when name is shorter than 2 characters", async () => {
      const res = await POST(
        makePostRequest("/api/auth/register", { ...VALID_REGISTER_PAYLOAD, name: "A" }),
      );

      expect(res.status).toBe(400);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/name/i);
    });

    it("returns 400 for an invalid email format", async () => {
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          email: "not-an-email",
        }),
      );

      expect(res.status).toBe(400);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/email/i);
    });

    it("returns 400 when password is shorter than 10 characters", async () => {
      const short = "Sh@rt1";
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          password: short,
          confirmPassword: short,
        }),
      );

      expect(res.status).toBe(400);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/10 characters/i);
    });

    it("returns 400 when password has no uppercase letter", async () => {
      const pw = "secure@password1";
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          password: pw,
          confirmPassword: pw,
        }),
      );

      expect(res.status).toBe(400);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/uppercase/i);
    });

    it("returns 400 when password has no lowercase letter", async () => {
      const pw = "SECURE@PASSWORD1";
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          password: pw,
          confirmPassword: pw,
        }),
      );

      expect(res.status).toBe(400);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/lowercase/i);
    });

    it("returns 400 when password has no digit", async () => {
      const pw = "Secure@Password";
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          password: pw,
          confirmPassword: pw,
        }),
      );

      expect(res.status).toBe(400);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/number/i);
    });

    it("returns 400 when password has no special character", async () => {
      const pw = "SecurePassword1";
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          password: pw,
          confirmPassword: pw,
        }),
      );

      expect(res.status).toBe(400);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/symbol/i);
    });

    it("returns 400 when passwords do not match", async () => {
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          confirmPassword: "Different@Password9",
        }),
      );

      expect(res.status).toBe(400);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/do not match/i);
    });

    it("returns 400 when the JSON body is not an object (e.g. a string)", async () => {
      const req = new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify("just a string"),
        headers: { "Content-Type": "application/json" },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("returns 400 when email is present but not a string", async () => {
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          email: 12345,
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  // -- 409 conflict --

  describe("409 - duplicate email", () => {
    it("returns 409 when the email is already registered", async () => {
      mockFindUnique.mockResolvedValue({ id: "existing-id" } as never);

      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      const body = await readJson<{ error: string }>(res);

      expect(res.status).toBe(409);
      expect(body.error).toMatch(/already exists/i);
    });
  });

  // -- 500 server errors --

  describe("500 - server errors", () => {
    it("returns 500 when prisma.user.findUnique throws", async () => {
      mockFindUnique.mockRejectedValue(new Error("Connection refused"));

      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));

      expect(res.status).toBe(500);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/unexpected error/i);
    });

    it("returns 500 when prisma.user.create throws", async () => {
      mockCreate.mockRejectedValue(new Error("Unique constraint violation"));

      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));

      expect(res.status).toBe(500);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/unexpected error/i);
    });
  });
});
