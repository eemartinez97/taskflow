import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@taskflow/database";
import { EmailDeliveryError, sendVerificationEmail } from "@taskflow/mail";
import type * as TaskflowMail from "@taskflow/mail";
import { hashPassword } from "@/lib/auth/password";
import { invalidateOtherAuthTokens, issueAuthToken } from "@/lib/auth/tokens";
import {
  checkAuthEmailRateLimit,
  checkAuthIpRateLimit,
  releaseAuthEmailRateLimit,
  releaseAuthIpRateLimit,
} from "@/lib/auth/rate-limit";
import { POST } from "@/app/api/auth/register/route";
import { makeInvalidJsonRequest, makePostRequest } from "../helpers/request";
import { MOCK_DB_USER, MOCK_RAW_TOKEN, VALID_REGISTER_PAYLOAD } from "../helpers/mock-data";

// -- Module mocks (hoisted before all imports by Vitest) --
vi.mock("@taskflow/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  },
}));
vi.mock("@taskflow/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof TaskflowMail>();
  return { ...actual, sendVerificationEmail: vi.fn() };
});
vi.mock("@/lib/mail/sender", () => ({
  // sendVerificationEmail itself is mocked above, so the sender instance
  // passed to it is never actually used - an empty object satisfies the call.
  emailSender: {},
}));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(),
}));
vi.mock("@/lib/auth/tokens", () => ({
  AUTH_TOKEN_TTL_HOURS: 1,
  issueAuthToken: vi.fn(),
  invalidateOtherAuthTokens: vi.fn(),
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkAuthEmailRateLimit: vi.fn(),
  releaseAuthEmailRateLimit: vi.fn(),
  checkAuthIpRateLimit: vi.fn(),
  releaseAuthIpRateLimit: vi.fn(),
}));

// -- Typed handles for mock functions --
const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockCreate = vi.mocked(prisma.user.create);
const mockUpdate = vi.mocked(prisma.user.update);
const mockHashPassword = vi.mocked(hashPassword);
const mockSendVerificationEmail = vi.mocked(sendVerificationEmail);
const mockIssueAuthToken = vi.mocked(issueAuthToken);
const mockInvalidateOtherAuthTokens = vi.mocked(invalidateOtherAuthTokens);
const mockCheckRateLimit = vi.mocked(checkAuthEmailRateLimit);
const mockReleaseRateLimit = vi.mocked(releaseAuthEmailRateLimit);
const mockCheckIpRateLimit = vi.mocked(checkAuthIpRateLimit);
const mockReleaseIpRateLimit = vi.mocked(releaseAuthIpRateLimit);

const HASHED_PASSWORD = "hashed:new-password";
const RATE_LIMIT_WINDOW_TOKEN = 1_700_000_000_000;
const CLIENT_IP_HEADERS = { "x-forwarded-for": "203.0.113.5" };

/** Reads the JSON body of a NextResponse with a concrete return type. */
async function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    mockFindUnique.mockResolvedValue(null); // no existing user
    mockCreate.mockResolvedValue(MOCK_DB_USER as never);
    mockUpdate.mockResolvedValue(MOCK_DB_USER as never);
    mockHashPassword.mockResolvedValue(HASHED_PASSWORD);
    mockSendVerificationEmail.mockResolvedValue(undefined);
    mockIssueAuthToken.mockResolvedValue({
      rawToken: MOCK_RAW_TOKEN,
      expiresAt: new Date(),
    });
    mockInvalidateOtherAuthTokens.mockResolvedValue(undefined);
    mockCheckRateLimit.mockResolvedValue({ limited: false, windowToken: RATE_LIMIT_WINDOW_TOKEN });
    mockCheckIpRateLimit.mockResolvedValue({
      limited: false,
      windowToken: RATE_LIMIT_WINDOW_TOKEN,
    });
  });

  // -- 201 happy path: brand-new signup --
  describe("201 - new signup", () => {
    it("returns 201 with a confirmation message", async () => {
      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      const body = await readJson<{ message: string }>(res);
      expect(res.status).toBe(201);
      expect(body.message).toMatch(/check your email/i);
    });

    it("creates the user with a hashed password (unverified account)", async () => {
      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      expect(mockHashPassword).toHaveBeenCalledWith(VALID_REGISTER_PAYLOAD.password);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: VALID_REGISTER_PAYLOAD.name,
            email: VALID_REGISTER_PAYLOAD.email,
            password: HASHED_PASSWORD,
          },
        }),
      );
    });

    it("issues an EMAIL_VERIFICATION token for the new user", async () => {
      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      expect(mockIssueAuthToken).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_DB_USER.id,
        "EMAIL_VERIFICATION",
      );
    });

    it("sends the verification email with a link containing the raw token", async () => {
      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      expect(mockSendVerificationEmail).toHaveBeenCalledOnce();
      const [, params] = mockSendVerificationEmail.mock.calls[0] as [
        unknown,
        { to: string; verifyUrl: string },
      ];
      expect(params.to).toBe(VALID_REGISTER_PAYLOAD.email);
      expect(params.verifyUrl).toContain(MOCK_RAW_TOKEN);
      expect(params.verifyUrl).toContain("/verify-email");
    });

    it("invalidates the user's other tokens only after the email is confirmed sent", async () => {
      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      expect(mockInvalidateOtherAuthTokens).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_DB_USER.id,
        "EMAIL_VERIFICATION",
        MOCK_RAW_TOKEN,
      );
      const sendOrder = mockSendVerificationEmail.mock.invocationCallOrder[0] ?? 0;
      const invalidateOrder = mockInvalidateOtherAuthTokens.mock.invocationCallOrder[0] ?? 0;
      expect(invalidateOrder).toBeGreaterThan(sendOrder);
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

  // -- 201: abandoned signup resend path --
  describe("201 - resend for an unverified (abandoned) account", () => {
    it("reuses the existing user row and does NOT overwrite its name/password", async () => {
      mockFindUnique.mockResolvedValue({
        id: "existing-unverified-id",
        name: "Old Name",
        emailVerified: null,
      } as never);

      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));

      expect(res.status).toBe(201);
      expect(mockCreate).not.toHaveBeenCalled();
      // Overwriting the pending row's credentials here would let anyone who
      // merely knows the email address hijack it by "re-registering" with
      // their own password before the real owner's mailbox confirms it - see
      // the route's docblock.
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockHashPassword).not.toHaveBeenCalled();
    });

    it("still issues a fresh token and resends the verification email", async () => {
      mockFindUnique.mockResolvedValue({
        id: "existing-unverified-id",
        name: "Old Name",
        emailVerified: null,
      } as never);

      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));

      expect(mockIssueAuthToken).toHaveBeenCalledWith(
        expect.anything(),
        "existing-unverified-id",
        "EMAIL_VERIFICATION",
      );
      expect(mockSendVerificationEmail).toHaveBeenCalledOnce();
    });

    it("uses the existing row's own name, not the freshly submitted one", async () => {
      mockFindUnique.mockResolvedValue({
        id: "existing-unverified-id",
        name: "Old Name",
        emailVerified: null,
      } as never);

      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));

      const [, params] = mockSendVerificationEmail.mock.calls[0] as [unknown, { name: string }];
      expect(params.name).toBe("Old Name");
    });

    it("falls back to the submitted name when the existing row has no name set", async () => {
      mockFindUnique.mockResolvedValue({
        id: "existing-unverified-id",
        name: null,
        emailVerified: null,
      } as never);

      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));

      const [, params] = mockSendVerificationEmail.mock.calls[0] as [unknown, { name: string }];
      expect(params.name).toBe(VALID_REGISTER_PAYLOAD.name);
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

    it("returns 400 for a weak password", async () => {
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          password: "weak",
          confirmPassword: "weak",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when passwords do not match", async () => {
      const res = await POST(
        makePostRequest("/api/auth/register", {
          ...VALID_REGISTER_PAYLOAD,
          confirmPassword: "Different@Password9",
        }),
      );
      expect(res.status).toBe(400);
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
        makePostRequest("/api/auth/register", { ...VALID_REGISTER_PAYLOAD, email: 12345 }),
      );
      expect(res.status).toBe(400);
    });
  });

  // -- 409 conflict: verified account --
  describe("409 - already verified", () => {
    it("returns 409 when the email belongs to an already-verified user", async () => {
      mockFindUnique.mockResolvedValue({
        id: "existing-id",
        name: "Existing",
        emailVerified: new Date("2024-01-01T00:00:00.000Z"),
      } as never);

      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      const body = await readJson<{ error: string }>(res);

      expect(res.status).toBe(409);
      expect(body.error).toMatch(/already exists/i);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockSendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  // -- 429 rate limit --
  describe("429 - rate limited", () => {
    it("returns 429 without touching the database when the email is rate limited", async () => {
      mockCheckRateLimit.mockResolvedValue({ limited: true, windowToken: RATE_LIMIT_WINDOW_TOKEN });

      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      const body = await readJson<{ error: string }>(res);

      expect(res.status).toBe(429);
      expect(body.error).toMatch(/too many requests/i);
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("returns 429 without touching the database when the client IP is rate limited", async () => {
      mockCheckIpRateLimit.mockResolvedValue({
        limited: true,
        windowToken: RATE_LIMIT_WINDOW_TOKEN,
      });

      const res = await POST(
        makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD, CLIENT_IP_HEADERS),
      );
      const body = await readJson<{ error: string }>(res);

      expect(res.status).toBe(429);
      expect(body.error).toMatch(/too many requests/i);
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("releases the unused IP quota when the 429 was caused by the email limit alone", async () => {
      mockCheckRateLimit.mockResolvedValue({ limited: true, windowToken: RATE_LIMIT_WINDOW_TOKEN });

      const res = await POST(
        makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD, CLIENT_IP_HEADERS),
      );

      expect(res.status).toBe(429);
      expect(mockReleaseRateLimit).not.toHaveBeenCalled();
      expect(mockReleaseIpRateLimit).toHaveBeenCalledWith("203.0.113.5", RATE_LIMIT_WINDOW_TOKEN);
    });

    it("releases the unused email quota when the 429 was caused by the IP limit alone", async () => {
      mockCheckIpRateLimit.mockResolvedValue({
        limited: true,
        windowToken: RATE_LIMIT_WINDOW_TOKEN,
      });

      const res = await POST(
        makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD, CLIENT_IP_HEADERS),
      );

      expect(res.status).toBe(429);
      expect(mockReleaseRateLimit).toHaveBeenCalledWith(
        VALID_REGISTER_PAYLOAD.email,
        RATE_LIMIT_WINDOW_TOKEN,
      );
      expect(mockReleaseIpRateLimit).not.toHaveBeenCalled();
    });

    it("does not check the IP limit when no client IP can be determined", async () => {
      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));

      expect(mockCheckIpRateLimit).not.toHaveBeenCalled();
    });

    it("checks the IP limit (keyed by the resolved client IP) when one is present", async () => {
      await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD, CLIENT_IP_HEADERS));

      expect(mockCheckIpRateLimit).toHaveBeenCalledWith("203.0.113.5");
    });
  });

  // -- 500 server errors --
  describe("500 - server errors", () => {
    it("returns 500 when prisma.user.findUnique throws", async () => {
      mockFindUnique.mockRejectedValue(new Error("Connection refused"));
      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      expect(res.status).toBe(500);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/unexpected error/i);
      expect(mockReleaseRateLimit).toHaveBeenCalledWith(
        VALID_REGISTER_PAYLOAD.email,
        RATE_LIMIT_WINDOW_TOKEN,
      );
    });

    it("releases both the email and IP rate limit quotas on error when a client IP is present", async () => {
      mockFindUnique.mockRejectedValue(new Error("Connection refused"));
      const res = await POST(
        makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD, CLIENT_IP_HEADERS),
      );
      expect(res.status).toBe(500);
      expect(mockReleaseRateLimit).toHaveBeenCalledWith(
        VALID_REGISTER_PAYLOAD.email,
        RATE_LIMIT_WINDOW_TOKEN,
      );
      expect(mockReleaseIpRateLimit).toHaveBeenCalledWith("203.0.113.5", RATE_LIMIT_WINDOW_TOKEN);
    });

    it("returns 500 when prisma.user.create throws", async () => {
      mockCreate.mockRejectedValue(new Error("Unique constraint violation"));
      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      expect(res.status).toBe(500);
      expect((await readJson<{ error: string }>(res)).error).toMatch(/unexpected error/i);
      expect(mockReleaseRateLimit).toHaveBeenCalledWith(
        VALID_REGISTER_PAYLOAD.email,
        RATE_LIMIT_WINDOW_TOKEN,
      );
    });

    it(
      "returns 500 when sendVerificationEmail throws an EmailDeliveryError, and does NOT " +
        "refund the rate-limit quota (a send that was actually attempted and failed must " +
        "still cost its caller - see EmailDeliveryError's docblock)",
      async () => {
        mockSendVerificationEmail.mockRejectedValue(new EmailDeliveryError("Resend API down"));
        const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
        expect(res.status).toBe(500);
        expect((await readJson<{ error: string }>(res)).error).toMatch(/unexpected error/i);
        expect(mockReleaseRateLimit).not.toHaveBeenCalled();
        expect(mockReleaseIpRateLimit).not.toHaveBeenCalled();
        expect(mockInvalidateOtherAuthTokens).not.toHaveBeenCalled();
      },
    );

    it("still refunds the rate-limit quota for a non-delivery error raised after the send (e.g. the DB write that follows it)", async () => {
      mockInvalidateOtherAuthTokens.mockRejectedValue(new Error("Connection refused"));
      const res = await POST(makePostRequest("/api/auth/register", VALID_REGISTER_PAYLOAD));
      expect(res.status).toBe(500);
      expect(mockReleaseRateLimit).toHaveBeenCalledWith(
        VALID_REGISTER_PAYLOAD.email,
        RATE_LIMIT_WINDOW_TOKEN,
      );
    });
  });
});
