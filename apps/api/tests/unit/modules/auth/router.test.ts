import { describe, expect, it, vi } from "vitest";

import { createAuthRouter } from "../../../../src/modules/auth/router";
import * as service from "../../../../src/modules/auth/service";
import { db, VALID_USER } from "../../../helpers";
import { mockIo } from "../../../mocks/socket";
import { callerFor, expectTRPCError } from "../../../support/trpc";

vi.mock("../../../../src/modules/auth/service");

const authRouter = createAuthRouter(mockIo);
const caller = () => callerFor(authRouter);

describe("auth router", () => {
  it("me -> getMe(db, ctx.user.id)", async () => {
    await caller().me();

    expect(service.getMe).toHaveBeenCalledWith(db, VALID_USER.id);
  });

  it("signOut -> signOutUser", async () => {
    await caller().signOut();

    expect(service.signOutUser).toHaveBeenCalledWith(db, VALID_USER.id);
  });

  it("updateProfile -> updateMyProfile with validated input", async () => {
    await caller().updateProfile({ name: "Bob" });

    expect(service.updateMyProfile).toHaveBeenCalledWith(db, VALID_USER.id, { name: "Bob" });
  });

  it.each(["me", "signOut"] as const)("%s requires a session", async (procedure) => {
    await expectTRPCError(callerFor(authRouter, null)[procedure](), "UNAUTHORIZED");
  });

  it("register -> registerUser with validated input and ctx.clientIp, without a session", async () => {
    vi.mocked(service.registerUser).mockResolvedValue({ message: "Check your email." });

    await callerFor(authRouter, null).register({
      name: "Ada Lovelace",
      email: "Ada@Example.COM",
      password: "Str0ng!Pass1",
      confirmPassword: "Str0ng!Pass1",
    });

    expect(service.registerUser).toHaveBeenCalledWith(
      db,
      { name: "Ada Lovelace", email: "ada@example.com", password: "Str0ng!Pass1" },
      "203.0.113.1",
      null,
    );
  });

  it("verifyEmail -> verifyEmail(db, io, token), without a session", async () => {
    vi.mocked(service.verifyEmail).mockResolvedValue({ verified: true });

    await callerFor(authRouter, null).verifyEmail({ token: "raw-token" });

    expect(service.verifyEmail).toHaveBeenCalledWith(db, mockIo, "raw-token");
  });

  it("requestPasswordReset -> requestPasswordReset with validated email and ctx.clientIp, without a session", async () => {
    vi.mocked(service.requestPasswordReset).mockResolvedValue({ message: "generic" });

    await callerFor(authRouter, null).requestPasswordReset({ email: "Ada@Example.COM" });

    expect(service.requestPasswordReset).toHaveBeenCalledWith(
      db,
      { email: "ada@example.com" },
      "203.0.113.1",
      null,
    );
  });

  it("resetPassword -> resetPassword(db, { token, password }), without a session", async () => {
    vi.mocked(service.resetPassword).mockResolvedValue({ message: "Password updated." });

    await callerFor(authRouter, null).resetPassword({
      token: "raw-token",
      password: "Str0ng!Pass1",
      confirmPassword: "Str0ng!Pass1",
    });

    expect(service.resetPassword).toHaveBeenCalledWith(db, {
      token: "raw-token",
      password: "Str0ng!Pass1",
    });
  });

  it("verifyCredentials -> verifyCredentials(db, validatedInput), without a session", async () => {
    vi.mocked(service.verifyCredentials).mockResolvedValue(null);

    await callerFor(authRouter, null).verifyCredentials({
      email: "Ada@Example.COM",
      password: "pw",
      clientIp: "203.0.113.9",
    });

    expect(service.verifyCredentials).toHaveBeenCalledWith(
      db,
      {
        email: "ada@example.com",
        password: "pw",
        clientIp: "203.0.113.9",
      },
      null,
    );
  });

  it("checkResetToken -> checkResetToken(db, token), without a session", async () => {
    vi.mocked(service.checkResetToken).mockResolvedValue({ valid: true });

    await callerFor(authRouter, null).checkResetToken({ token: "raw-token" });

    expect(service.checkResetToken).toHaveBeenCalledWith(db, "raw-token");
  });
});
