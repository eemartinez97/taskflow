import { describe, expect, it } from "vitest";
import {
  createOrgSchema,
  inviteMemberSchema,
  membershipSchema,
  orgSchema,
  roleSchema,
} from "../org";
import { FIXED_DATE, VALID_UUID } from "./fixtures";

describe("roleSchema", () => {
  it("accepts all valid roles", () => {
    expect(roleSchema.parse("OWNER")).toBe("OWNER");
    expect(roleSchema.parse("ADMIN")).toBe("ADMIN");
    expect(roleSchema.parse("MEMBER")).toBe("MEMBER");
    expect(roleSchema.parse("VIEWER")).toBe("VIEWER");
  });

  it("rejects unkFIXED_DATEn roles", () => {
    expect(() => roleSchema.parse("SUPERUSER")).toThrow();
  });
});

describe("createOrgSchema", () => {
  it("accepts a valid org creation payload", () => {
    const result = createOrgSchema.parse({ name: "Test Corp", slug: "test-corp" });
    expect(result).toEqual({ name: "Test Corp", slug: "test-corp" });
  });

  it("rejects empty name", () => {
    expect(() => createOrgSchema.parse({ name: "", slug: "test" })).toThrow();
  });
});

describe("orgSchema", () => {
  it("parses a valid org object", () => {
    const org = orgSchema.parse({
      id: VALID_UUID,
      name: "Test Corp",
      slug: "test-corp",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    });
    expect(org.slug).toBe("test-corp");
  });
});

describe("membershipSchema", () => {
  it("parses a valid membership", () => {
    const result = membershipSchema.parse({
      id: VALID_UUID,
      orgId: VALID_UUID,
      userId: VALID_UUID,
      role: "ADMIN",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    });
    expect(result.role).toBe("ADMIN");
  });
});

describe("inviteMemberSchema", () => {
  const email = "user@example.com";

  it("accepts MEMBER role", () => {
    const result = inviteMemberSchema.parse({ email, role: "MEMBER" });
    expect(result.role).toBe("MEMBER");
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
});
