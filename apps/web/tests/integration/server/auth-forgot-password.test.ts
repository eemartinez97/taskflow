import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@taskflow/database";
import { EmailDeliveryError, sendPasswordResetEmail, sendVerificationEmail } from "@taskflow/mail";
import type * as TaskflowMail from "@taskflow/mail";
import { invalidateOtherAuthTokens, issueAuthToken } from "@/lib/auth/tokens";
import {
  checkAuthEmailRateLimit,
  checkAuthIpRateLimit,
  releaseAuthEmailRateLimit,
  releaseAuthIpRateLimit,
} from "@/lib/auth/rate-limit";
import { POST } from "@/app/api/auth/forgot-password/route";
import { makeInvalidJsonRequest, makePostRequest } from "../helpers/request";
import { MOCK_RAW_TOKEN, VALID_FORGOT_PASSWORD_PAYLOAD } from "../helpers/mock-data";

vi.mock("@taskflow/database", () => ({
  prisma: { user: { findUnique: vi.fn<(...args: unknown[]) => Promise<unknown>>() } },
}));
vi.mock("@taskflow/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof TaskflowMail>();
  return { ...actual, sendPasswordResetEmail: vi.fn(), sendVerificationEmail: vi.fn() };
});
vi.mock("@/lib/mail/sender", () => ({ emailSender: {} }));
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

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockSendPasswordResetEmail = vi.mocked(sendPasswordResetEmail);
const mockSendVerificationEmail = vi.mocked(sendVerificationEmail);
const mockIssueAuthToken = vi.mocked(issueAuthToken);
const mockInvalidateOtherAuthTokens = vi.mocked(invalidateOtherAuthTokens);
const mockCheckRateLimit = vi.mocked(checkAuthEmailRateLimit);
const mockReleaseRateLimit = vi.mocked(releaseAuthEmailRateLimit);
const mockCheckIpRateLimit = vi.mocked(checkAuthIpRateLimit);
const mockReleaseIpRateLimit = vi.mocked(releaseAuthIpRateLimit);
const RATE_LIMIT_WINDOW_TOKEN = 1_700_000_000_000;
const CLIENT_IP_HEADERS = { "x-forwarded-for": "203.0.113.5" };

async function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
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

  it("returns 200 with the generic message when the account is verified", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
    } as never);

    const res = await POST(
      makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD),
    );
    const body = await readJson<{ message: string }>(res);

    expect(res.status).toBe(200);
    expect(body.message).toMatch(/if an account exists/i);
    expect(mockIssueAuthToken).toHaveBeenCalledWith(expect.anything(), "user-1", "PASSWORD_RESET");
    expect(mockSendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
    expect(mockInvalidateOtherAuthTokens).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "PASSWORD_RESET",
      MOCK_RAW_TOKEN,
    );
  });

  it("sends a verification email instead when the account is unverified", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-2", name: "Bob", emailVerified: null } as never);

    const res = await POST(
      makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD),
    );

    expect(res.status).toBe(200);
    expect(mockIssueAuthToken).toHaveBeenCalledWith(
      expect.anything(),
      "user-2",
      "EMAIL_VERIFICATION",
    );
    expect(mockSendVerificationEmail).toHaveBeenCalledOnce();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockInvalidateOtherAuthTokens).toHaveBeenCalledWith(
      expect.anything(),
      "user-2",
      "EMAIL_VERIFICATION",
      MOCK_RAW_TOKEN,
    );
  });

  it("falls back to 'there' when a verified user has no name set", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      name: null,
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
    } as never);

    await POST(makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD));

    const [, params] = mockSendPasswordResetEmail.mock.calls[0] as [unknown, { name: string }];
    expect(params.name).toBe("there");
  });

  it("falls back to 'there' when an unverified user has no name set", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-2", name: null, emailVerified: null } as never);

    await POST(makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD));

    const [, params] = mockSendVerificationEmail.mock.calls[0] as [unknown, { name: string }];
    expect(params.name).toBe("there");
  });

  it("returns the SAME generic message when no account exists (no enumeration)", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(
      makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD),
    );
    const body = await readJson<{ message: string }>(res);

    expect(res.status).toBe(200);
    expect(body.message).toMatch(/if an account exists/i);
    expect(mockIssueAuthToken).not.toHaveBeenCalled();
  });

  it("still returns the generic 200 message when an internal error occurs", async () => {
    mockFindUnique.mockRejectedValue(new Error("DB down"));

    const res = await POST(
      makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD),
    );
    const body = await readJson<{ message: string }>(res);

    expect(res.status).toBe(200);
    expect(body.message).toMatch(/if an account exists/i);
    expect(mockReleaseRateLimit).toHaveBeenCalledWith(
      VALID_FORGOT_PASSWORD_PAYLOAD.email,
      RATE_LIMIT_WINDOW_TOKEN,
    );
  });

  it("never invalidates the previous (still-working) token when sendPasswordResetEmail throws", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
    } as never);
    mockSendPasswordResetEmail.mockRejectedValue(new EmailDeliveryError("Resend API down"));

    const res = await POST(
      makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD),
    );

    expect(res.status).toBe(200);
    expect(mockInvalidateOtherAuthTokens).not.toHaveBeenCalled();
  });

  it("does NOT refund the rate-limit quota when the email actually failed to send (EmailDeliveryError) - only a send that was never attempted should be refunded", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
    } as never);
    mockSendPasswordResetEmail.mockRejectedValue(new EmailDeliveryError("Resend API down"));

    await POST(makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD));

    expect(mockReleaseRateLimit).not.toHaveBeenCalled();
    expect(mockReleaseIpRateLimit).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable JSON body", async () => {
    const res = await POST(makeInvalidJsonRequest("/api/auth/forgot-password"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await POST(makePostRequest("/api/auth/forgot-password", { email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 without querying the database when rate limited by email", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, windowToken: RATE_LIMIT_WINDOW_TOKEN });

    const res = await POST(
      makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD),
    );

    expect(res.status).toBe(429);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 429 without querying the database when rate limited by IP", async () => {
    mockCheckIpRateLimit.mockResolvedValue({ limited: true, windowToken: RATE_LIMIT_WINDOW_TOKEN });

    const res = await POST(
      makePostRequest(
        "/api/auth/forgot-password",
        VALID_FORGOT_PASSWORD_PAYLOAD,
        CLIENT_IP_HEADERS,
      ),
    );

    expect(res.status).toBe(429);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("releases the unused IP quota when the 429 was caused by the email limit alone", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, windowToken: RATE_LIMIT_WINDOW_TOKEN });

    const res = await POST(
      makePostRequest(
        "/api/auth/forgot-password",
        VALID_FORGOT_PASSWORD_PAYLOAD,
        CLIENT_IP_HEADERS,
      ),
    );

    expect(res.status).toBe(429);
    expect(mockReleaseRateLimit).not.toHaveBeenCalled();
    expect(mockReleaseIpRateLimit).toHaveBeenCalledWith("203.0.113.5", RATE_LIMIT_WINDOW_TOKEN);
  });

  it("releases the unused email quota when the 429 was caused by the IP limit alone", async () => {
    mockCheckIpRateLimit.mockResolvedValue({ limited: true, windowToken: RATE_LIMIT_WINDOW_TOKEN });

    const res = await POST(
      makePostRequest(
        "/api/auth/forgot-password",
        VALID_FORGOT_PASSWORD_PAYLOAD,
        CLIENT_IP_HEADERS,
      ),
    );

    expect(res.status).toBe(429);
    expect(mockReleaseRateLimit).toHaveBeenCalledWith(
      VALID_FORGOT_PASSWORD_PAYLOAD.email,
      RATE_LIMIT_WINDOW_TOKEN,
    );
    expect(mockReleaseIpRateLimit).not.toHaveBeenCalled();
  });

  it("does not check the IP limit when no client IP can be determined", async () => {
    await POST(makePostRequest("/api/auth/forgot-password", VALID_FORGOT_PASSWORD_PAYLOAD));

    expect(mockCheckIpRateLimit).not.toHaveBeenCalled();
  });

  it("checks the IP limit (keyed by the resolved client IP) when one is present", async () => {
    mockFindUnique.mockResolvedValue(null);

    await POST(
      makePostRequest(
        "/api/auth/forgot-password",
        VALID_FORGOT_PASSWORD_PAYLOAD,
        CLIENT_IP_HEADERS,
      ),
    );

    expect(mockCheckIpRateLimit).toHaveBeenCalledWith("203.0.113.5");
  });

  it("releases both the email and IP rate limit quotas on an internal error when a client IP is present", async () => {
    mockFindUnique.mockRejectedValue(new Error("DB down"));

    const res = await POST(
      makePostRequest(
        "/api/auth/forgot-password",
        VALID_FORGOT_PASSWORD_PAYLOAD,
        CLIENT_IP_HEADERS,
      ),
    );

    expect(res.status).toBe(200);
    expect(mockReleaseRateLimit).toHaveBeenCalledWith(
      VALID_FORGOT_PASSWORD_PAYLOAD.email,
      RATE_LIMIT_WINDOW_TOKEN,
    );
    expect(mockReleaseIpRateLimit).toHaveBeenCalledWith("203.0.113.5", RATE_LIMIT_WINDOW_TOKEN);
  });
});
