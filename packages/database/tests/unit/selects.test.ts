import { describe, expect, it } from "vitest";

import {
  userBasicSelect,
  userProfileSelect,
  membershipWithUser,
  orgWithMembership,
  boardWithColumns,
  notificationWithActor,
} from "../../src/selects.js";

// -- userBasicSelect --
describe("userBasicSelect", () => {
  it("selects id, name, and email", () => {
    expect(userBasicSelect).toEqual({
      id: true,
      name: true,
      email: true,
    });
  });

  it("does not expose sensitive fields (image, emailVerified)", () => {
    expect(userBasicSelect).not.toHaveProperty("image");
    expect(userBasicSelect).not.toHaveProperty("emailVerified");
  });
});

// -- userProfileSelect --
describe("userProfileSelect", () => {
  it("selects id, name, and image", () => {
    expect(userProfileSelect).toEqual({
      id: true,
      name: true,
      image: true,
    });
  });

  it("does not expose email (used for presence/display only)", () => {
    expect(userProfileSelect).not.toHaveProperty("email");
  });
});

// -- membershipWithUser --
describe("membershipWithUser", () => {
  it("includes the user relation", () => {
    expect(membershipWithUser).toHaveProperty("user");
  });

  it("uses userBasicSelect for the user relation", () => {
    expect(membershipWithUser.user).toEqual({ select: userBasicSelect });
  });
});

// -- orgWithMembership --
describe("orgWithMembership", () => {
  it("includes the memberships relation", () => {
    expect(orgWithMembership).toHaveProperty("memberships");
  });

  it("selects only role from memberships (minimal RBAC payload)", () => {
    expect(orgWithMembership.memberships).toEqual({
      select: { role: true },
    });
  });

  it("does not select userId or orgId (unnecessary for RBAC checks)", () => {
    const select = orgWithMembership.memberships.select;
    expect(select).not.toHaveProperty("userId");
    expect(select).not.toHaveProperty("orgId");
  });
});

// -- boardWithColumns --
describe("boardWithColumns", () => {
  it("includes the columns relation", () => {
    expect(boardWithColumns).toHaveProperty("columns");
  });

  it("orders columns by position ascending (Kanban order)", () => {
    expect(boardWithColumns.columns).toEqual({
      orderBy: { position: "asc" },
    });
  });

  it("uses asc order - not desc - to render left-to-right columns", () => {
    expect(boardWithColumns.columns.orderBy.position).toBe("asc");
  });
});

// -- notificationWithActor --
describe("notificationWithActor", () => {
  it("includes the actor relation", () => {
    expect(notificationWithActor).toHaveProperty("actor");
  });

  it("uses userProfileSelect for the actor relation", () => {
    expect(notificationWithActor.actor).toEqual({ select: userProfileSelect });
  });

  it("does not expose actor email in notification payloads", () => {
    const actorSelect = notificationWithActor.actor.select;
    expect(actorSelect).not.toHaveProperty("email");
  });
});
