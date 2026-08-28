import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  EmailDeliveryError,
  sendAccountActivatedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  type EmailSender,
} from "@taskflow/mail";
import type * as TaskflowMail from "@taskflow/mail";

import {
  checkResetToken,
  getMe,
  registerUser,
  requestPasswordReset,
  resetPassword,
  signOutUser,
  updateMyProfile,
  verifyCredentials,
  verifyEmail,
} from "../../../../src/modules/auth/service";
import { hashPassword, verifyPassword } from "../../../../src/modules/auth/password";
import {
  AUTH_TOKEN_TTL_HOURS,
  TokenAlreadyConsumedError,
  consumeTokenAndResetPassword,
  findValidAuthToken,
  invalidateOtherAuthTokens,
  issueAuthToken,
  verifyEmailFromToken,
} from "../../../../src/modules/auth/tokens";
import {
  checkLoginEmailRateLimit,
  checkLoginIpRateLimit,
  enforceAuthRateLimit,
  releaseAuthRateLimit,
} from "../../../../src/modules/auth/rate-limit";
import { getEmailSender } from "../../../../src/mail/sender";
import { appCollectors } from "../../../../src/metrics";
import { claimInvitationsForUser } from "../../../../src/modules/invitations/service";
import { TRPCError } from "../../../../src/trpc/init";
import { db, VALID_USER } from "../../../helpers";
import { mockDb } from "../../../mocks/database-mock";
import { mockIo } from "../../../mocks/socket";

vi.mock("../../../../src/modules/auth/password");
vi.mock("../../../../src/modules/auth/tokens");
vi.mock("../../../../src/modules/auth/rate-limit");
vi.mock("../../../../src/mail/sender");
vi.mock("../../../../src/config/env");
vi.mock("../../../../src/modules/invitations/service");
vi.mock("@taskflow/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof TaskflowMail>();
  return {
    ...actual,
    sendVerificationEmail: vi.fn(),
    sendAccountActivatedEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  };
});

const mockHashPassword = vi.mocked(hashPassword);
const mockVerifyPassword = vi.mocked(verifyPassword);
const mockCheckLoginEmailRateLimit = vi.mocked(checkLoginEmailRateLimit);
const mockCheckLoginIpRateLimit = vi.mocked(checkLoginIpRateLimit);
const mockIssueAuthToken = vi.mocked(issueAuthToken);
const mockInvalidateOtherAuthTokens = vi.mocked(invalidateOtherAuthTokens);
const mockVerifyEmailFromToken = vi.mocked(verifyEmailFromToken);
const mockFindValidAuthToken = vi.mocked(findValidAuthToken);
const mockConsumeTokenAndResetPassword = vi.mocked(consumeTokenAndResetPassword);
const mockEnforceAuthRateLimit = vi.mocked(enforceAuthRateLimit);
const mockReleaseAuthRateLimit = vi.mocked(releaseAuthRateLimit);
const mockGetEmailSender = vi.mocked(getEmailSender);
const mockSendVerificationEmail = vi.mocked(sendVerificationEmail);
const mockSendAccountActivatedEmail = vi.mocked(sendAccountActivatedEmail);
const mockSendPasswordResetEmail = vi.mocked(sendPasswordResetEmail);
const mockClaimInvitationsForUser = vi.mocked(claimInvitationsForUser);
const FAKE_SENDER = {} as EmailSender;

const VALID_REGISTER_INPUT = { name: "Ada Lovelace", email: "ada@example.com", password: "pw" };
const RATE_LIMIT_WINDOW_TOKEN = 1_700_000_000_000;
const RAW_TOKEN = "raw-token-value";
const CLIENT_IP = "203.0.113.5";
const NOT_LIMITED_STATE = {
  emailCheck: { limited: false, windowToken: RATE_LIMIT_WINDOW_TOKEN },
  ipCheck: { limited: false, windowToken: RATE_LIMIT_WINDOW_TOKEN },
};

const user = { ...VALID_USER, image: null };

describe("getMe", () => {
  it("returns the trimmed session profile", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(user);

    await expect(getMe(db, VALID_USER.id)).resolves.toEqual(user);
  });

  it("throws NOT_FOUND when the account is gone", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);

    await expect(getMe(db, VALID_USER.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("signOutUser", () => {
  it("deletes every server-side session", async () => {
    await expect(signOutUser(db, VALID_USER.id)).resolves.toEqual({ success: true });

    expect(mockDb.session.deleteMany).toHaveBeenCalledWith({ where: { userId: VALID_USER.id } });
  });
});

describe("updateMyProfile", () => {
  it("checks existence before updating", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(user);
    mockDb.user.update.mockResolvedValueOnce({ ...user, name: "Bob" });

    await expect(updateMyProfile(db, VALID_USER.id, { name: "Bob" })).resolves.toMatchObject({
      name: "Bob",
    });
  });

  it("throws NOT_FOUND without touching update", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null);

    await expect(updateMyProfile(db, VALID_USER.id, { name: "Bob" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});

describe("registerUser", () => {
  beforeEach(() => {
    mockDb.user.findUnique.mockResolvedValue(null); // no existing user
    mockDb.user.create.mockResolvedValue({ id: "new-user-id", name: VALID_REGISTER_INPUT.name });
    mockHashPassword.mockResolvedValue("hashed:pw");
    mockGetEmailSender.mockReturnValue(FAKE_SENDER);
    mockSendVerificationEmail.mockResolvedValue(undefined);
    mockIssueAuthToken.mockResolvedValue({ rawToken: RAW_TOKEN, expiresAt: new Date() });
    mockInvalidateOtherAuthTokens.mockResolvedValue(undefined);
    mockEnforceAuthRateLimit.mockResolvedValue(NOT_LIMITED_STATE);
    appCollectors.usersRegisteredTotal.reset();
  });

  describe("new signup", () => {
    it("returns a confirmation message", async () => {
      await expect(registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null)).resolves.toMatchObject({
        message: expect.stringMatching(/check your email/i) as string,
      });
    });

    it("records a usersRegisteredTotal metric for a genuinely new account", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect((await appCollectors.usersRegisteredTotal.get()).values[0]?.value).toBe(1);
    });

    it("creates the user with a hashed password (unverified account)", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect(mockHashPassword).toHaveBeenCalledWith(VALID_REGISTER_INPUT.password);
      expect(mockDb.user.create).toHaveBeenCalledWith({
        data: {
          name: VALID_REGISTER_INPUT.name,
          email: VALID_REGISTER_INPUT.email,
          password: "hashed:pw",
        },
        select: { id: true, name: true },
      });
    });

    it("issues an EMAIL_VERIFICATION token for the new user", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect(mockIssueAuthToken).toHaveBeenCalledWith(db, "new-user-id", "EMAIL_VERIFICATION");
    });

    it("sends the verification email with a link containing the raw token", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect(mockSendVerificationEmail).toHaveBeenCalledWith(FAKE_SENDER, {
        to: VALID_REGISTER_INPUT.email,
        name: VALID_REGISTER_INPUT.name,
        verifyUrl: expect.stringContaining(RAW_TOKEN) as string,
        expiresInHours: AUTH_TOKEN_TTL_HOURS,
      });
    });

    it("invalidates the user's other tokens only after the email is confirmed sent", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect(mockInvalidateOtherAuthTokens).toHaveBeenCalledWith(
        db,
        "new-user-id",
        "EMAIL_VERIFICATION",
        RAW_TOKEN,
      );
      const sendOrder = mockSendVerificationEmail.mock.invocationCallOrder[0] ?? 0;
      const invalidateOrder = mockInvalidateOtherAuthTokens.mock.invocationCallOrder[0] ?? 0;
      expect(invalidateOrder).toBeGreaterThan(sendOrder);
    });

    it("forwards a null clientIp straight through to enforceAuthRateLimit when no client IP is available", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, null, null);

      expect(mockEnforceAuthRateLimit).toHaveBeenCalledWith(
        db,
        VALID_REGISTER_INPUT.email,
        null,
        null,
      );
    });

    it("forwards the e2eSecretHeader straight through to enforceAuthRateLimit", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, "e2e-secret");

      expect(mockEnforceAuthRateLimit).toHaveBeenCalledWith(
        db,
        VALID_REGISTER_INPUT.email,
        CLIENT_IP,
        "e2e-secret",
      );
    });
  });

  describe("resend for an unverified (abandoned) account", () => {
    beforeEach(() => {
      mockDb.user.findUnique.mockResolvedValue({
        id: "existing-unverified-id",
        name: "Old Name",
        emailVerified: null,
      });
    });

    it("reuses the existing user row and does NOT overwrite its name/password", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect(mockDb.user.create).not.toHaveBeenCalled();
      expect(mockHashPassword).not.toHaveBeenCalled();
    });

    it("does not record usersRegisteredTotal for a resend (no new row created)", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect((await appCollectors.usersRegisteredTotal.get()).values[0]?.value).toBe(0);
    });

    it("still issues a fresh token and resends the verification email", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect(mockIssueAuthToken).toHaveBeenCalledWith(
        db,
        "existing-unverified-id",
        "EMAIL_VERIFICATION",
      );
      expect(mockSendVerificationEmail).toHaveBeenCalledOnce();
    });

    it("uses the existing row's own name, not the freshly submitted one", async () => {
      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect(mockSendVerificationEmail).toHaveBeenCalledWith(
        FAKE_SENDER,
        expect.objectContaining({ name: "Old Name" }) as unknown,
      );
    });

    it("falls back to the submitted name when the existing row has no name set", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        id: "existing-unverified-id",
        name: null,
        emailVerified: null,
      });

      await registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null);

      expect(mockSendVerificationEmail).toHaveBeenCalledWith(
        FAKE_SENDER,
        expect.objectContaining({ name: VALID_REGISTER_INPUT.name }) as unknown,
      );
    });
  });

  describe("already verified", () => {
    it("throws CONFLICT and never creates/sends anything", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        id: "existing-id",
        name: "Existing",
        emailVerified: new Date("2024-01-01T00:00:00.000Z"),
      });

      await expect(registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(mockDb.user.create).not.toHaveBeenCalled();
      expect(mockSendVerificationEmail).not.toHaveBeenCalled();
    });

    it("does not refund any rate-limit quota for a CONFLICT (a legitimate consumed attempt)", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        id: "existing-id",
        name: "Existing",
        emailVerified: new Date("2024-01-01T00:00:00.000Z"),
      });

      await expect(registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null)).rejects.toBeDefined();

      expect(mockReleaseAuthRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("rate limited", () => {
    it("propagates TOO_MANY_REQUESTS without touching the database when enforceAuthRateLimit rejects", async () => {
      mockEnforceAuthRateLimit.mockRejectedValue(
        new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests." }),
      );

      await expect(registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null)).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
      expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("server errors", () => {
    it("refunds quota via releaseAuthRateLimit and throws INTERNAL_SERVER_ERROR when a DB read throws", async () => {
      mockDb.user.findUnique.mockRejectedValue(new Error("Connection refused"));

      await expect(registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null)).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
      });
      expect(mockReleaseAuthRateLimit).toHaveBeenCalledWith(
        db,
        VALID_REGISTER_INPUT.email,
        CLIENT_IP,
        NOT_LIMITED_STATE,
      );
    });

    it(
      "does NOT refund quota when sendVerificationEmail throws EmailDeliveryError " +
        "(a send that was actually attempted and failed must still cost its caller)",
      async () => {
        mockSendVerificationEmail.mockRejectedValue(new EmailDeliveryError("Resend API down"));

        await expect(registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null)).rejects.toMatchObject(
          {
            code: "INTERNAL_SERVER_ERROR",
          },
        );
        expect(mockReleaseAuthRateLimit).not.toHaveBeenCalled();
        expect(mockInvalidateOtherAuthTokens).not.toHaveBeenCalled();
      },
    );

    it("forwards a null clientIp to releaseAuthRateLimit when a server error occurs with no client IP available", async () => {
      mockDb.user.findUnique.mockRejectedValue(new Error("Connection refused"));

      await expect(registerUser(db, VALID_REGISTER_INPUT, null, null)).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
      });
      expect(mockReleaseAuthRateLimit).toHaveBeenCalledWith(
        db,
        VALID_REGISTER_INPUT.email,
        null,
        NOT_LIMITED_STATE,
      );
    });

    it("still refunds quota for a non-delivery error raised after the send (e.g. invalidateOtherAuthTokens)", async () => {
      mockInvalidateOtherAuthTokens.mockRejectedValue(new Error("Connection refused"));

      await expect(registerUser(db, VALID_REGISTER_INPUT, CLIENT_IP, null)).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
      });
      expect(mockReleaseAuthRateLimit).toHaveBeenCalledWith(
        db,
        VALID_REGISTER_INPUT.email,
        CLIENT_IP,
        NOT_LIMITED_STATE,
      );
    });
  });
});

describe("verifyEmail", () => {
  beforeEach(() => {
    mockGetEmailSender.mockReturnValue(FAKE_SENDER);
    mockSendAccountActivatedEmail.mockResolvedValue(undefined);
    mockClaimInvitationsForUser.mockResolvedValue(undefined);
    appCollectors.usersVerifiedTotal.reset();
  });

  it("returns not-verified for an invalid/expired token", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({ verified: false });

    await expect(verifyEmail(db, mockIo, "bad-token")).resolves.toEqual({ verified: false });
    expect(mockSendAccountActivatedEmail).not.toHaveBeenCalled();
    expect(mockClaimInvitationsForUser).not.toHaveBeenCalled();
    expect((await appCollectors.usersVerifiedTotal.get()).values[0]?.value).toBe(0);
  });

  it("returns verified without sending a notice for a repeat visit (not freshly activated)", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: false,
      userId: VALID_USER.id,
    });

    await expect(verifyEmail(db, mockIo, "token")).resolves.toEqual({ verified: true });
    // Drain microtasks so a wrongly-fired fire-and-forget call would show up.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSendAccountActivatedEmail).not.toHaveBeenCalled();
    expect(mockClaimInvitationsForUser).not.toHaveBeenCalled();
    // Not freshly activated - a repeat visit must not double-count.
    expect((await appCollectors.usersVerifiedTotal.get()).values[0]?.value).toBe(0);
  });

  it("sends the activation notice exactly once for a freshly activated account, without blocking the response", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: VALID_USER.id,
    });
    mockDb.user.findUnique.mockResolvedValue({ email: VALID_USER.email, name: "Ada" });

    const result = await verifyEmail(db, mockIo, "token");

    expect(result).toEqual({ verified: true });
    expect((await appCollectors.usersVerifiedTotal.get()).values[0]?.value).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSendAccountActivatedEmail).toHaveBeenCalledWith(FAKE_SENDER, {
      to: VALID_USER.email,
      name: "Ada",
      loginUrl: expect.stringContaining("/login") as string,
    });
    expect(mockClaimInvitationsForUser).toHaveBeenCalledWith(db, mockIo, VALID_USER.id);
  });

  it("falls back to the email as the display name when the user has none", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: VALID_USER.id,
    });
    mockDb.user.findUnique.mockResolvedValue({ email: VALID_USER.email, name: null });

    await verifyEmail(db, mockIo, "token");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSendAccountActivatedEmail).toHaveBeenCalledWith(
      FAKE_SENDER,
      expect.objectContaining({ name: VALID_USER.email }) as unknown,
    );
  });

  it("no-ops when the freshly-activated user can no longer be found", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: VALID_USER.id,
    });
    mockDb.user.findUnique.mockResolvedValue(null);

    await verifyEmail(db, mockIo, "token");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSendAccountActivatedEmail).not.toHaveBeenCalled();
  });

  it("logs (does not throw) when the activation notice fails to send", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: VALID_USER.id,
    });
    mockDb.user.findUnique.mockResolvedValue({ email: VALID_USER.email, name: "Ada" });
    mockSendAccountActivatedEmail.mockRejectedValue(new Error("Resend API down"));

    await expect(verifyEmail(db, mockIo, "token")).resolves.toEqual({ verified: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("claims pending invitations exactly once for a freshly activated account", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: VALID_USER.id,
    });
    mockDb.user.findUnique.mockResolvedValue({ email: VALID_USER.email, name: "Ada" });

    await verifyEmail(db, mockIo, "token");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockClaimInvitationsForUser).toHaveBeenCalledExactlyOnceWith(db, mockIo, VALID_USER.id);
  });

  it("logs (does not throw) when claiming pending invitations fails", async () => {
    mockVerifyEmailFromToken.mockResolvedValue({
      verified: true,
      freshlyActivated: true,
      userId: VALID_USER.id,
    });
    mockDb.user.findUnique.mockResolvedValue({ email: VALID_USER.email, name: "Ada" });
    mockClaimInvitationsForUser.mockRejectedValue(new Error("DB down"));

    await expect(verifyEmail(db, mockIo, "token")).resolves.toEqual({ verified: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe("requestPasswordReset", () => {
  const VALID_RESET_REQUEST_INPUT = { email: "ada@example.com" };

  beforeEach(() => {
    mockGetEmailSender.mockReturnValue(FAKE_SENDER);
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    mockSendVerificationEmail.mockResolvedValue(undefined);
    mockIssueAuthToken.mockResolvedValue({ rawToken: RAW_TOKEN, expiresAt: new Date() });
    mockInvalidateOtherAuthTokens.mockResolvedValue(undefined);
    mockEnforceAuthRateLimit.mockResolvedValue(NOT_LIMITED_STATE);
    appCollectors.passwordResetsRequestedTotal.reset();
  });

  it("returns the generic message when the account is verified", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
    });

    await expect(
      requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, CLIENT_IP, null),
    ).resolves.toMatchObject({ message: expect.stringMatching(/if an account exists/i) as string });
    expect(mockIssueAuthToken).toHaveBeenCalledWith(db, "user-1", "PASSWORD_RESET");
    expect(mockSendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
    expect(mockInvalidateOtherAuthTokens).toHaveBeenCalledWith(
      db,
      "user-1",
      "PASSWORD_RESET",
      RAW_TOKEN,
    );
    expect((await appCollectors.passwordResetsRequestedTotal.get()).values[0]?.value).toBe(1);
  });

  it("sends a verification email instead when the account is unverified", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "user-2", name: "Bob", emailVerified: null });

    await requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, CLIENT_IP, null);

    expect(mockIssueAuthToken).toHaveBeenCalledWith(db, "user-2", "EMAIL_VERIFICATION");
    expect(mockSendVerificationEmail).toHaveBeenCalledOnce();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockInvalidateOtherAuthTokens).toHaveBeenCalledWith(
      db,
      "user-2",
      "EMAIL_VERIFICATION",
      RAW_TOKEN,
    );
    // Not a real password reset send - must not count toward the metric.
    expect((await appCollectors.passwordResetsRequestedTotal.get()).values[0]?.value).toBe(0);
  });

  it("falls back to 'there' when a verified user has no name set", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: null,
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
    });

    await requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, CLIENT_IP, null);

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      FAKE_SENDER,
      expect.objectContaining({ name: "there" }) as unknown,
    );
  });

  it("falls back to 'there' when an unverified user has no name set", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "user-2", name: null, emailVerified: null });

    await requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, CLIENT_IP, null);

    expect(mockSendVerificationEmail).toHaveBeenCalledWith(
      FAKE_SENDER,
      expect.objectContaining({ name: "there" }) as unknown,
    );
  });

  it("returns the SAME generic message when no account exists (no enumeration)", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    await expect(
      requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, CLIENT_IP, null),
    ).resolves.toMatchObject({ message: expect.stringMatching(/if an account exists/i) as string });
    expect(mockIssueAuthToken).not.toHaveBeenCalled();
  });

  it("still returns the generic message when an internal error occurs, and refunds quota", async () => {
    mockDb.user.findUnique.mockRejectedValue(new Error("DB down"));

    await expect(
      requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, CLIENT_IP, null),
    ).resolves.toMatchObject({ message: expect.stringMatching(/if an account exists/i) as string });
    expect(mockReleaseAuthRateLimit).toHaveBeenCalledWith(
      db,
      VALID_RESET_REQUEST_INPUT.email,
      CLIENT_IP,
      NOT_LIMITED_STATE,
    );
  });

  it("never invalidates the previous token when sendPasswordResetEmail throws", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
    });
    mockSendPasswordResetEmail.mockRejectedValue(new EmailDeliveryError("Resend API down"));

    await requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, CLIENT_IP, null);

    expect(mockInvalidateOtherAuthTokens).not.toHaveBeenCalled();
  });

  it("does NOT refund the rate-limit quota when the email actually failed to send (EmailDeliveryError)", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
    });
    mockSendPasswordResetEmail.mockRejectedValue(new EmailDeliveryError("Resend API down"));

    await requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, CLIENT_IP, null);

    expect(mockReleaseAuthRateLimit).not.toHaveBeenCalled();
  });

  it("propagates TOO_MANY_REQUESTS without querying the database when enforceAuthRateLimit rejects", async () => {
    mockEnforceAuthRateLimit.mockRejectedValue(
      new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests." }),
    );

    await expect(
      requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, CLIENT_IP, null),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("forwards a null clientIp straight through to enforceAuthRateLimit when no client IP is available", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    await requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, null, null);

    expect(mockEnforceAuthRateLimit).toHaveBeenCalledWith(
      db,
      VALID_RESET_REQUEST_INPUT.email,
      null,
      null,
    );
  });

  it("forwards a null clientIp to releaseAuthRateLimit on an internal error with no client IP available", async () => {
    mockDb.user.findUnique.mockRejectedValue(new Error("DB down"));

    await requestPasswordReset(db, VALID_RESET_REQUEST_INPUT, null, null);

    expect(mockReleaseAuthRateLimit).toHaveBeenCalledWith(
      db,
      VALID_RESET_REQUEST_INPUT.email,
      null,
      NOT_LIMITED_STATE,
    );
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    mockHashPassword.mockResolvedValue("hashed_new_password");
    mockFindValidAuthToken.mockResolvedValue({ id: "token-1", userId: "user-1" });
    mockConsumeTokenAndResetPassword.mockResolvedValue(undefined);
    appCollectors.passwordResetsCompletedTotal.reset();
  });

  it("consumes the token and updates the password on a valid reset", async () => {
    await expect(
      resetPassword(db, { token: "raw-token", password: "NewPassw0rd!" }),
    ).resolves.toEqual({ message: expect.stringMatching(/password updated/i) as string });

    expect(mockFindValidAuthToken).toHaveBeenCalledWith(db, "raw-token", "PASSWORD_RESET");
    expect(mockConsumeTokenAndResetPassword).toHaveBeenCalledWith(
      db,
      "token-1",
      "user-1",
      "hashed_new_password",
    );
    expect((await appCollectors.passwordResetsCompletedTotal.get()).values[0]?.value).toBe(1);
  });

  it("throws NOT_FOUND when the token is invalid or expired", async () => {
    mockFindValidAuthToken.mockResolvedValue(null);

    await expect(
      resetPassword(db, { token: "raw-token", password: "NewPassw0rd!" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockConsumeTokenAndResetPassword).not.toHaveBeenCalled();
  });

  it("throws INTERNAL_SERVER_ERROR when consumeTokenAndResetPassword throws an unexpected error", async () => {
    mockConsumeTokenAndResetPassword.mockRejectedValue(new Error("DB error"));

    await expect(
      resetPassword(db, { token: "raw-token", password: "NewPassw0rd!" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("throws NOT_FOUND when a concurrent request already consumed the token (TOCTOU race)", async () => {
    mockConsumeTokenAndResetPassword.mockRejectedValue(new TokenAlreadyConsumedError());

    await expect(
      resetPassword(db, { token: "raw-token", password: "NewPassw0rd!" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("verifyCredentials", () => {
  const VALID_CREDENTIALS_INPUT = {
    email: "ada@example.com",
    password: "correct-password",
    clientIp: CLIENT_IP,
  };
  const CREDENTIALS_USER = {
    id: "user-1",
    email: "ada@example.com",
    name: "Ada",
    image: null,
    password: "hashed-real-password",
    emailVerified: new Date("2024-01-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    mockCheckLoginEmailRateLimit.mockResolvedValue({
      limited: false,
      windowToken: RATE_LIMIT_WINDOW_TOKEN,
    });
    mockCheckLoginIpRateLimit.mockResolvedValue({
      limited: false,
      windowToken: RATE_LIMIT_WINDOW_TOKEN,
    });
    mockDb.user.findUnique.mockResolvedValue(CREDENTIALS_USER);
    mockVerifyPassword.mockResolvedValue(true);
    appCollectors.loginAttemptsTotal.reset();
  });

  it("returns the session user for correct credentials", async () => {
    await expect(verifyCredentials(db, VALID_CREDENTIALS_INPUT, null)).resolves.toEqual({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
    });
    expect((await appCollectors.loginAttemptsTotal.get()).values).toEqual([
      expect.objectContaining({ labels: { outcome: "success" }, value: 1 }),
    ]);
  });

  it("returns null for a wrong password", async () => {
    mockVerifyPassword.mockResolvedValue(false);

    await expect(verifyCredentials(db, VALID_CREDENTIALS_INPUT, null)).resolves.toBeNull();
    expect((await appCollectors.loginAttemptsTotal.get()).values).toEqual([
      expect.objectContaining({ labels: { outcome: "failure" }, value: 1 }),
    ]);
  });

  it("returns null (and still runs a dummy bcrypt compare) for an unknown email", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    await expect(verifyCredentials(db, VALID_CREDENTIALS_INPUT, null)).resolves.toBeNull();
    expect(mockVerifyPassword).toHaveBeenCalledWith(
      VALID_CREDENTIALS_INPUT.password,
      expect.stringMatching(/^\$2b\$12\$/) as string,
    );
  });

  it("returns null (and still runs a dummy bcrypt compare) for an unverified account", async () => {
    mockDb.user.findUnique.mockResolvedValue({ ...CREDENTIALS_USER, emailVerified: null });

    await expect(verifyCredentials(db, VALID_CREDENTIALS_INPUT, null)).resolves.toBeNull();
    expect(mockVerifyPassword).toHaveBeenCalledWith(
      VALID_CREDENTIALS_INPUT.password,
      expect.stringMatching(/^\$2b\$12\$/) as string,
    );
  });

  it("returns null (and still runs a dummy bcrypt compare) when the account has no password set", async () => {
    mockDb.user.findUnique.mockResolvedValue({ ...CREDENTIALS_USER, password: null });

    await expect(verifyCredentials(db, VALID_CREDENTIALS_INPUT, null)).resolves.toBeNull();
    expect(mockVerifyPassword).toHaveBeenCalledWith(
      VALID_CREDENTIALS_INPUT.password,
      expect.stringMatching(/^\$2b\$12\$/) as string,
    );
  });

  it("returns null on a DB error, never throwing", async () => {
    mockDb.user.findUnique.mockRejectedValue(new Error("Connection refused"));

    await expect(verifyCredentials(db, VALID_CREDENTIALS_INPUT, null)).resolves.toBeNull();
  });

  it("returns null without querying the database when rate limited by email", async () => {
    mockCheckLoginEmailRateLimit.mockResolvedValue({
      limited: true,
      windowToken: RATE_LIMIT_WINDOW_TOKEN,
    });

    await expect(verifyCredentials(db, VALID_CREDENTIALS_INPUT, null)).resolves.toBeNull();
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
    // Rate-limited, not a real credentials check - must not count either way.
    expect((await appCollectors.loginAttemptsTotal.get()).values).toEqual([]);
  });

  it("returns null without querying the database when rate limited by IP", async () => {
    mockCheckLoginIpRateLimit.mockResolvedValue({
      limited: true,
      windowToken: RATE_LIMIT_WINDOW_TOKEN,
    });

    await expect(verifyCredentials(db, VALID_CREDENTIALS_INPUT, null)).resolves.toBeNull();
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });

  it("does not check the IP limit when no client IP is available", async () => {
    await verifyCredentials(db, { ...VALID_CREDENTIALS_INPUT, clientIp: null }, null);

    expect(mockCheckLoginIpRateLimit).not.toHaveBeenCalled();
  });

  it("checks the login IP limit (keyed by the forwarded browser IP) when one is present", async () => {
    await verifyCredentials(db, VALID_CREDENTIALS_INPUT, null);

    expect(mockCheckLoginIpRateLimit).toHaveBeenCalledWith(db, CLIENT_IP, null);
  });
});

describe("checkResetToken", () => {
  it("returns valid: true for a valid token, without consuming it", async () => {
    mockFindValidAuthToken.mockResolvedValue({ id: "token-1", userId: "user-1" });

    await expect(checkResetToken(db, "raw-token")).resolves.toEqual({ valid: true });
    expect(mockFindValidAuthToken).toHaveBeenCalledWith(db, "raw-token", "PASSWORD_RESET");
    expect(mockConsumeTokenAndResetPassword).not.toHaveBeenCalled();
  });

  it("returns valid: false for an invalid/expired token", async () => {
    mockFindValidAuthToken.mockResolvedValue(null);

    await expect(checkResetToken(db, "raw-token")).resolves.toEqual({ valid: false });
  });
});
