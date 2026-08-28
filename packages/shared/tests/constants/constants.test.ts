import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  INVITATION_RESEND_COOLDOWN_MS,
  INVITATION_STATUSES,
  INVITATION_TTL_HOURS,
  MAX_PAGE_SIZE,
  MAX_PENDING_INVITATIONS_PER_ORG,
  POSITION_STEP,
  ROLES,
  SOCKET_EVENTS,
  SOCKET_ROOM_PREFIX,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@taskflow/shared";

describe("ROLES", () => {
  it("contains all four roles in correct order", () => {
    expect(ROLES).toEqual(["VIEWER", "MEMBER", "ADMIN", "OWNER"]);
  });

  it("has VIEWER as the least privileged role", () => {
    expect(ROLES[0]).toBe("VIEWER");
  });

  it("has OWNER as the most privileged role", () => {
    expect(ROLES[ROLES.length - 1]).toBe("OWNER");
  });
});

describe("TASK_PRIORITIES", () => {
  it("contains all priorities", () => {
    expect(TASK_PRIORITIES).toHaveLength(5);
    expect(TASK_PRIORITIES).toContain("NONE");
    expect(TASK_PRIORITIES).toContain("LOW");
    expect(TASK_PRIORITIES).toContain("MEDIUM");
    expect(TASK_PRIORITIES).toContain("HIGH");
    expect(TASK_PRIORITIES).toContain("URGENT");
  });
});

describe("TASK_STATUSES", () => {
  it("contains all statuses", () => {
    expect(TASK_STATUSES).toHaveLength(5);
    expect(TASK_STATUSES).toContain("TODO");
    expect(TASK_STATUSES).toContain("IN_PROGRESS");
    expect(TASK_STATUSES).toContain("IN_REVIEW");
    expect(TASK_STATUSES).toContain("DONE");
    expect(TASK_STATUSES).toContain("CANCELLED");
  });
});

describe("DEFAULT_PAGE_SIZE", () => {
  it("is 25", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });
});

describe("MAX_PAGE_SIZE", () => {
  it("is 100", () => {
    expect(MAX_PAGE_SIZE).toBe(100);
  });

  it("is greater than DEFAULT_PAGE_SIZE", () => {
    expect(MAX_PAGE_SIZE).toBeGreaterThan(DEFAULT_PAGE_SIZE);
  });
});

describe("INVITATION_STATUSES", () => {
  it("contains all four statuses, with no EXPIRED member", () => {
    expect(INVITATION_STATUSES).toEqual(["PENDING", "ACCEPTED", "DECLINED", "REVOKED"]);
    expect(INVITATION_STATUSES).not.toContain("EXPIRED");
  });
});

describe("INVITATION_TTL_HOURS", () => {
  it("is 168 (7 days)", () => {
    expect(INVITATION_TTL_HOURS).toBe(168);
  });
});

describe("MAX_PENDING_INVITATIONS_PER_ORG", () => {
  it("is 100", () => {
    expect(MAX_PENDING_INVITATIONS_PER_ORG).toBe(100);
  });
});

describe("INVITATION_RESEND_COOLDOWN_MS", () => {
  it("is 60 seconds", () => {
    expect(INVITATION_RESEND_COOLDOWN_MS).toBe(60_000);
  });
});

describe("SOCKET_ROOM_PREFIX", () => {
  it("equal 'project:'", () => {
    expect(SOCKET_ROOM_PREFIX).toBe("project:");
  });

  it("can be used to build a room name", () => {
    const projectId = "abc-123";
    expect(`${SOCKET_ROOM_PREFIX}${projectId}`).toBe("project:abc-123");
  });
});

describe("POSITION_STEP", () => {
  it("is 1000", () => {
    expect(POSITION_STEP).toBe(1000);
  });

  it("allows inserting items between steps with fractional values", () => {
    const firstPosition = POSITION_STEP;
    const secondPosition = POSITION_STEP * 2;
    const middle = (firstPosition + secondPosition) / 2;
    // Middle position should be strictly between first and second
    expect(middle).toBeGreaterThan(firstPosition);
    expect(middle).toBeLessThan(secondPosition);
  });
});

describe("SOCKET_EVENTS", () => {
  it("contains all socket event strings", () => {
    expect(Object.keys(SOCKET_EVENTS)).toHaveLength(22);
  });

  it("invitation events use invitation: prefix", () => {
    expect(SOCKET_EVENTS.INVITATION_RECEIVED).toBe("invitation:received");
    expect(SOCKET_EVENTS.INVITATION_RESOLVED).toBe("invitation:resolved");
  });

  it("task events use task: prefix", () => {
    expect(SOCKET_EVENTS.TASK_CREATED).toBe("task:created");
    expect(SOCKET_EVENTS.TASK_UPDATED).toBe("task:updated");
    expect(SOCKET_EVENTS.TASK_MOVED).toBe("task:moved");
    expect(SOCKET_EVENTS.TASK_DELETED).toBe("task:deleted");
    expect(SOCKET_EVENTS.TASK_TYPING).toBe("task:typing");
  });

  it("comment events use comment: prefix", () => {
    expect(SOCKET_EVENTS.COMMENT_CREATED).toBe("comment:created");
    expect(SOCKET_EVENTS.COMMENT_DELETED).toBe("comment:deleted");
  });

  it("presence events use presence: prefix", () => {
    expect(SOCKET_EVENTS.PRESENCE_JOIN).toBe("presence:join");
    expect(SOCKET_EVENTS.PRESENCE_LEAVE).toBe("presence:leave");
    expect(SOCKET_EVENTS.PRESENCE_CURSOR).toBe("presence:cursor");
  });

  it("all values are lowercase strings with colon separator", () => {
    for (const value of Object.values(SOCKET_EVENTS)) {
      expect(value).toMatch(/^[a-z]+(:[a-z_-]+)+$/);
    }
  });
});
