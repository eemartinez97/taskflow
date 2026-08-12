import { describe, expect, it } from "vitest";
import {
  invitationPreviewSchema,
  invitationPreviewStateSchema,
  invitationRefSchema,
  invitationSchema,
  invitationStatusSchema,
  invitationTokenSchema,
  myInvitationSchema,
  orgInvitationSchema,
} from "@taskflow/shared";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const ANOTHER_UUID = "550e8400-e29b-41d4-a716-446655440001";

const validInvitation = {
  id: VALID_UUID,
  orgId: ANOTHER_UUID,
  email: "invitee@example.com",
  role: "MEMBER",
  status: "PENDING",
  invitedById: VALID_UUID,
  expiresAt: new Date(),
  respondedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("invitationStatusSchema", () => {
  it("accepts every valid status", () => {
    for (const status of ["PENDING", "ACCEPTED", "DECLINED", "REVOKED"]) {
      expect(invitationStatusSchema.parse(status)).toBe(status);
    }
  });

  it("rejects an unknown status", () => {
    expect(() => invitationStatusSchema.parse("EXPIRED")).toThrow();
  });
});

describe("invitationSchema", () => {
  it("accepts a fully valid invitation row", () => {
    expect(invitationSchema.parse(validInvitation)).toMatchObject({ email: "invitee@example.com" });
  });

  it("rejects OWNER as the invited role", () => {
    expect(() => invitationSchema.parse({ ...validInvitation, role: "OWNER" })).toThrow();
  });

  it("trims and lowercases the email", () => {
    const result = invitationSchema.parse({ ...validInvitation, email: "  Invitee@Example.COM  " });
    expect(result.email).toBe("invitee@example.com");
  });

  it("accepts a null invitedById (inviter account was deleted)", () => {
    expect(
      invitationSchema.parse({ ...validInvitation, invitedById: null }).invitedById,
    ).toBeNull();
  });
});

describe("orgInvitationSchema", () => {
  it("accepts the admin-table row shape (no orgId, plus inviterName)", () => {
    const { orgId: _orgId, ...withoutOrgId } = validInvitation;
    const result = orgInvitationSchema.parse({
      ...withoutOrgId,
      inviterName: "Ada",
    });
    expect(result.inviterName).toBe("Ada");
  });

  it("accepts a null inviterName", () => {
    const { orgId: _orgId, ...withoutOrgId } = validInvitation;
    const result = orgInvitationSchema.parse({
      ...withoutOrgId,
      inviterName: null,
    });
    expect(result.inviterName).toBeNull();
  });
});

describe("myInvitationSchema", () => {
  it("accepts the invitee's self-scoped pending-invitation shape", () => {
    const result = myInvitationSchema.parse({
      id: VALID_UUID,
      orgId: ANOTHER_UUID,
      orgName: "Acme Inc",
      role: "ADMIN",
      expiresAt: new Date(),
      createdAt: new Date(),
    });
    expect(result.orgName).toBe("Acme Inc");
  });

  it("has no email field (self-scoped by the caller's own session)", () => {
    const parsed = myInvitationSchema.safeParse({
      id: VALID_UUID,
      orgId: ANOTHER_UUID,
      orgName: "Acme Inc",
      role: "MEMBER",
      email: "someone@example.com",
      expiresAt: new Date(),
      createdAt: new Date(),
    });
    // Zod strips unknown keys by default rather than rejecting them.
    expect(parsed.success && "email" in parsed.data).toBe(false);
  });
});

describe("invitationPreviewStateSchema", () => {
  it("accepts every documented state", () => {
    for (const state of [
      "VALID",
      "EXPIRED",
      "REVOKED",
      "DECLINED",
      "ALREADY_ACCEPTED",
      "WRONG_ACCOUNT",
    ]) {
      expect(invitationPreviewStateSchema.parse(state)).toBe(state);
    }
  });
});

describe("invitationPreviewSchema", () => {
  const validPreview = {
    invitationId: VALID_UUID,
    orgId: ANOTHER_UUID,
    orgName: "Acme Inc",
    role: "MEMBER",
    inviterName: "Ada",
    expiresAt: new Date(),
    state: "VALID",
  };

  it("accepts a valid preview", () => {
    expect(invitationPreviewSchema.parse(validPreview)).toMatchObject({ state: "VALID" });
  });

  it("has no email field (never discloses the invitee's address)", () => {
    const parsed = invitationPreviewSchema.safeParse({
      ...validPreview,
      email: "leak@example.com",
    });
    expect(parsed.success && "email" in parsed.data).toBe(false);
  });
});

describe("invitationTokenSchema", () => {
  it("accepts a non-empty token", () => {
    expect(invitationTokenSchema.parse({ token: "raw-token" })).toEqual({ token: "raw-token" });
  });

  it("rejects an empty token", () => {
    expect(() => invitationTokenSchema.parse({ token: "" })).toThrow();
  });
});

describe("invitationRefSchema", () => {
  it("accepts an invitationId reference", () => {
    expect(invitationRefSchema.parse({ invitationId: VALID_UUID })).toEqual({
      invitationId: VALID_UUID,
    });
  });

  it("accepts a token reference", () => {
    expect(invitationRefSchema.parse({ token: "raw-token" })).toEqual({ token: "raw-token" });
  });

  it("rejects an empty object", () => {
    expect(() => invitationRefSchema.parse({})).toThrow();
  });
});
