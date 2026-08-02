import { describe, expect, it } from "vitest";
import { findColumnIdForTask, findTaskInMap } from "@/lib/board/tasks-map";
import { VALID_COL_A_ID, VALID_COL_B_ID } from "@/tests/support/fixtures";
import { makeTask } from "@/tests/support/factories";

describe("findTaskInMap", () => {
  it("finds a task in the correct column", () => {
    const map = { [VALID_COL_A_ID]: [makeTask()], [VALID_COL_B_ID]: [] };
    expect(findTaskInMap(map, makeTask().id)).toEqual(makeTask());
  });

  it("returns null when the task doesn't exist anywhere", () => {
    const map = { [VALID_COL_A_ID]: [makeTask()] };
    expect(findTaskInMap(map, "missing-id")).toBeNull();
  });
});

describe("findColumnIdForTask", () => {
  it("returns the owning columnId", () => {
    const map = { [VALID_COL_A_ID]: [makeTask()], [VALID_COL_B_ID]: [] };
    expect(findColumnIdForTask(map, makeTask().id)).toBe(VALID_COL_A_ID);
  });

  it("returns null when not found", () => {
    const map = { [VALID_COL_A_ID]: [] };
    expect(findColumnIdForTask(map, "missing-id")).toBeNull();
  });
});
