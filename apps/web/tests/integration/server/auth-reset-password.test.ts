import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import {
  consumeTokenAndResetPassword,
  findValidAuthToken,
  TokenAlreadyConsumedError,
} from "@/lib/auth/tokens";
import { POST } from "@/app/api/auth/reset-password/route";
import { makeInvalidJsonRequest, makePostRequest } from "../helpers/request";
import { VALID_RESET_PASSWORD_PAYLOAD } from "../helpers/mock-data";

vi.mock("@taskflow/database", () => ({ prisma: {} }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/auth/tokens", () => ({
  findValidAuthToken: vi.fn(),
  consumeTokenAndResetPassword: vi.fn(),
  TokenAlreadyConsumedError: class TokenAlreadyConsumedError extends Error {},
}));

const mockHashPassword = vi.mocked(hashPassword);
const mockFindValidAuthToken = vi.mocked(findValidAuthToken);
const mockConsumeToken = vi.mocked(consumeTokenAndResetPassword);

async function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    mockHashPassword.mockResolvedValue("hashed_new_password");
    mockFindValidAuthToken.mockResolvedValue({ id: "token-1", userId: "user-1" });
    mockConsumeToken.mockResolvedValue(undefined);
  });

  it("returns 200 and consumes the token on a valid reset", async () => {
    const res = await POST(
      makePostRequest("/api/auth/reset-password", VALID_RESET_PASSWORD_PAYLOAD),
    );
    const body = await readJson<{ message: string }>(res);

    expect(res.status).toBe(200);
    expect(body.message).toMatch(/password updated/i);
    expect(mockFindValidAuthToken).toHaveBeenCalledWith(
      expect.anything(),
      VALID_RESET_PASSWORD_PAYLOAD.token,
      "PASSWORD_RESET",
    );
    expect(mockConsumeToken).toHaveBeenCalledWith(
      expect.anything(),
      "token-1",
      "user-1",
      "hashed_new_password",
    );
  });

  it("returns 410 when the token is invalid or expired", async () => {
    mockFindValidAuthToken.mockResolvedValue(null);

    const res = await POST(
      makePostRequest("/api/auth/reset-password", VALID_RESET_PASSWORD_PAYLOAD),
    );
    const body = await readJson<{ error: string }>(res);

    expect(res.status).toBe(410);
    expect(body.error).toMatch(/invalid or has expired/i);
    expect(mockConsumeToken).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable JSON body", async () => {
    const res = await POST(makeInvalidJsonRequest("/api/auth/reset-password"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when passwords do not match", async () => {
    const res = await POST(
      makePostRequest("/api/auth/reset-password", {
        ...VALID_RESET_PASSWORD_PAYLOAD,
        confirmPassword: "Different@Password9",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty token", async () => {
    const res = await POST(
      makePostRequest("/api/auth/reset-password", { ...VALID_RESET_PASSWORD_PAYLOAD, token: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when consumeTokenAndResetPassword throws", async () => {
    mockConsumeToken.mockRejectedValue(new Error("DB error"));

    const res = await POST(
      makePostRequest("/api/auth/reset-password", VALID_RESET_PASSWORD_PAYLOAD),
    );
    expect(res.status).toBe(500);
  });

  it("returns 410 when a concurrent request already consumed the token (TOCTOU race)", async () => {
    mockConsumeToken.mockRejectedValue(new TokenAlreadyConsumedError());

    const res = await POST(
      makePostRequest("/api/auth/reset-password", VALID_RESET_PASSWORD_PAYLOAD),
    );
    const body = await readJson<{ error: string }>(res);

    expect(res.status).toBe(410);
    expect(body.error).toMatch(/invalid or has expired/i);
  });
});
