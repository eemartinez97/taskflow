import { describe, expect, it } from "vitest";
import {
  createOrgSchema,
  inviteMemberSchema,
  membershipSchema,
  orgSchema,
  roleSchema,
  updateOrgSchema,
} from "../org";
import { FIXED_DATE, VALID_UUID } from "./fixtures";

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
    const result = createOrgSchema.parse({ name: "Test Corp", slug: "test-corp" });
    expect(result).toEqual({ name: "Test Corp", slug: "test-corp" });
  });

  it("rejects empty name", () => {
    expect(() => createOrgSchema.parse({ name: "", slug: "test" })).toThrow();
  });

  it("rejects name exceeding 100 characters", () => {
    expect(() => createOrgSchema.parse({ name: "a".repeat(101), slug: "test" })).toThrow();
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
    const org = orgSchema.parse({
      id: VALID_UUID,
      name: "Test Corp",
      slug: "test-corp",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    });
    expect(org.slug).toBe("test-corp");
  });

  it("rejects org without required fields", () => {
    expect(() => orgSchema.parse({ name: "Test" })).toThrow();
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
});
