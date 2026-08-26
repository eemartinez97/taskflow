import { describe, expect, it } from "vitest";
import {
  createOrgSchema,
  invitableRoleSchema,
  inviteMemberSchema,
  membershipSchema,
  orgSchema,
  roleSchema,
  updateCursorPreferenceSchema,
  updateOrgSchema,
} from "@taskflow/shared";
import { validMembershipPayload, validOrgPayload } from "./fixtures";

describe("roleSchema", () => {
  it("accepts all valid roles", () => {
    expect(roleSchema.parse("OWNER")).toBe("OWNER");
    expect(roleSchema.parse("ADMIN")).toBe("ADMIN");
    expect(roleSchema.parse("MEMBER")).toBe("MEMBER");
    expect(roleSchema.parse("VIEWER")).toBe("VIEWER");
  });

  it("rejects unknown roles", () => {
    expect(() => roleSchema.parse("SUPERUSER")).toThrow();
  });
});

describe("createOrgSchema", () => {
  it("accepts a valid org creation payload", () => {
    const { name, slug } = validOrgPayload;
    const result = createOrgSchema.parse({ name, slug });
    expect(result).toEqual({ name, slug });
  });

  it("rejects empty name", () => {
    expect(() => createOrgSchema.parse({ ...validOrgPayload, name: "" })).toThrow();
  });

  it("rejects name exceeding 100 characters", () => {
    expect(() => createOrgSchema.parse({ ...validOrgPayload, name: "a".repeat(101) })).toThrow();
  });
});

describe("updateOrgSchema", () => {
  it("accepts empty object - all fields optional", () => {
    expect(updateOrgSchema.parse({})).toEqual({});
  });

  it("accepts partial update with only name", () => {
    const result = updateOrgSchema.parse({ name: "New Name" });
    expect(result.name).toBe("New Name");
  });

  it("accepts partial update with only slug", () => {
    const result = updateOrgSchema.parse({ slug: "new-slug" });
    expect(result.slug).toBe("new-slug");
  });

  it("rejects invalid slug in update", () => {
    expect(() => updateOrgSchema.parse({ slug: "Invalid Slug!" })).toThrow();
  });
});

describe("orgSchema", () => {
  it("parses a valid org object", () => {
    const org = orgSchema.parse(validOrgPayload);
    expect(org.slug).toBe(validOrgPayload.slug);
  });

  it("rejects org without required fields", () => {
    expect(() => orgSchema.parse({ name: "Test" })).toThrow();
  });
});

describe("membershipSchema", () => {
  it("parses a valid membership", () => {
    const result = membershipSchema.parse(validMembershipPayload);
    expect(result.role).toBe(validMembershipPayload.role);
    expect(result.cursorsHidden).toBe(false);
  });

  it("rejects a missing cursorsHidden", () => {
    const { cursorsHidden: _cursorsHidden, ...rest } = validMembershipPayload;
    expect(() => membershipSchema.parse(rest)).toThrow();
  });
});

describe("updateCursorPreferenceSchema", () => {
  it("accepts a boolean cursorsHidden", () => {
    expect(updateCursorPreferenceSchema.parse({ cursorsHidden: true })).toEqual({
      cursorsHidden: true,
    });
  });

  it("rejects a non-boolean cursorsHidden", () => {
    expect(() => updateCursorPreferenceSchema.parse({ cursorsHidden: "yes" })).toThrow();
  });

  it("rejects a missing cursorsHidden", () => {
    expect(() => updateCursorPreferenceSchema.parse({})).toThrow();
  });
});

describe("inviteMemberSchema", () => {
  const email = "user@example.com";

  it("accepts MEMBER role", () => {
    const result = inviteMemberSchema.parse({ email, role: "MEMBER" });
    expect(result.role).toBe("MEMBER");
  });

  it("accepts ADMIN role", () => {
    expect(inviteMemberSchema.parse({ email, role: "ADMIN" }).role).toBe("ADMIN");
  });

  it("accepts VIEWER role", () => {
    expect(inviteMemberSchema.parse({ email, role: "VIEWER" }).role).toBe("VIEWER");
  });

  it("rejects OWNER role in invite", () => {
    expect(() => {
      inviteMemberSchema.parse({ email, role: "OWNER" });
    }).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() =>
      inviteMemberSchema.parse({
        email: "not-an-email",
        role: "MEMBER",
      }),
    ).toThrow();
  });

  it("trims and lowercases the email", () => {
    const result = inviteMemberSchema.parse({ email: "  Alice@Example.COM  ", role: "MEMBER" });
    expect(result.email).toBe("alice@example.com");
  });
});

describe("invitableRoleSchema", () => {
  it("accepts every role except OWNER", () => {
    expect(invitableRoleSchema.parse("ADMIN")).toBe("ADMIN");
    expect(invitableRoleSchema.parse("MEMBER")).toBe("MEMBER");
    expect(invitableRoleSchema.parse("VIEWER")).toBe("VIEWER");
  });

  it("rejects OWNER", () => {
    expect(() => invitableRoleSchema.parse("OWNER")).toThrow();
  });
});
