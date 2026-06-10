import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  POSITION_STEP,
  ROLES,
  SOCKET_ROOM_PREFIX,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "../index.js";

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
