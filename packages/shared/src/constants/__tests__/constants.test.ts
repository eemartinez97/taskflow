import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, ROLES, TASK_PRIORITIES, TASK_STATUSES } from "..";

describe("ROLES", () => {
  it("contains all four roles in correct order", () => {
    expect(ROLES).toEqual(["VIEWER", "MEMBER", "ADMIN", "OWNER"]);
  });
});

describe("TASK_PRIORITIES", () => {
  it("contains all priorities", () => {
    expect(TASK_PRIORITIES).toContain("NONE");
    expect(TASK_PRIORITIES).toContain("URGENT");
  });
});

describe("TASK_STATUSES", () => {
  it("contains all statuses", () => {
    expect(TASK_STATUSES).toContain("TODO");
    expect(TASK_STATUSES).toContain("DONE");
  });
});

describe("DEFAULT_PAGE_SIZE", () => {
  it("is 25", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });
});
