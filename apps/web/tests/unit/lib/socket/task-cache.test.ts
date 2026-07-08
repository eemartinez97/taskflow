import { describe, expect, it } from "vitest";

import type { SocketTask } from "@taskflow/shared";

import { makeTask, toSocketTask, VALID_COL_A_ID, VALID_COL_B_ID } from "@/tests/helpers";
import { applyTaskMove, removeTask, upsertTask } from "@/lib/socket/task-cache";

// -- Fixtures --

const t1 = toSocketTask(makeTask({ id: "t1", columnId: VALID_COL_A_ID, position: 1000 }));
const t2 = toSocketTask(makeTask({ id: "t2", columnId: VALID_COL_A_ID, position: 2000 }));
const t3 = toSocketTask(makeTask({ id: "t3", columnId: VALID_COL_A_ID, position: 3000 }));

// -- upsertTask --

describe("upsertTask", () => {
  it("appends when task does not exist in list", () => {
    const result = upsertTask([t1], t2);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(t2);
  });

  it("replaces existing task with same id", () => {
    const updated: SocketTask = { ...t1, title: "Updated title" };
    const result = upsertTask([t1, t2], updated);
    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe("Updated title");
  });

  it("returns [task] when prev is undefined", () => {
    expect(upsertTask(undefined, t1)).toEqual([t1]);
  });

  it("returns [task] when prev is empty array", () => {
    expect(upsertTask([], t1)).toEqual([t1]);
  });

  it("preserves order of other tasks when replacing mid-list", () => {
    const updated = { ...t2, title: "New title" };
    const result = upsertTask([t1, t2, t3], updated);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(result[1]?.title).toBe("New title");
  });

  it("does not mutate the original array", () => {
    const original = [t1, t2];
    upsertTask(original, t3);
    expect(original).toHaveLength(2);
  });
});

// -- removeTask --

describe("removeTask", () => {
  it("removes a task by id", () => {
    expect(removeTask([t1, t2], t1.id)).toEqual([t2]);
  });

  it("returns unchanged array when id is not found", () => {
    const result = removeTask([t1, t2], "non-existent");
    expect(result).toEqual([t1, t2]);
  });

  it("returns [] when prev is undefined", () => {
    expect(removeTask(undefined, "any")).toEqual([]);
  });

  it("returns [] when removing from empty array", () => {
    expect(removeTask([], "any")).toEqual([]);
  });

  it("removes all occurrences (defensive — ids should be unique)", () => {
    // In practice tasks have unique ids; the filter handles duplicates safely
    const result = removeTask([t1, t1], t1.id);
    expect(result).toHaveLength(0);
  });

  it("does not mutate the original array", () => {
    const original = [t1, t2];
    removeTask(original, t1.id);
    expect(original).toHaveLength(2);
  });
});

// -- applyTaskMove --

describe("applyTaskMove", () => {
  const map: Record<string, SocketTask[]> = {
    [VALID_COL_A_ID]: [t1, t2],
    [VALID_COL_B_ID]: [],
  };
  const columnIds = [VALID_COL_A_ID, VALID_COL_B_ID];

  it("skips removeTask when a colId in columnIds is absent from tasksMap (if-tasks false branch)", () => {
    const absentColId = "col-absent-from-map";
    const partialMap: Record<string, SocketTask[]> = {
      [VALID_COL_A_ID]: [t1],
      // absentColId intentionally NOT present — result[absentColId] === undefined
      // covers the `if (tasks)` false branch in applyTaskMove
    };

    expect(() =>
      applyTaskMove(partialMap, { ...t1, columnId: VALID_COL_A_ID }, [VALID_COL_A_ID, absentColId]),
    ).not.toThrow();
  });

  it("removes task from source column", () => {
    const movedTask: SocketTask = { ...t1, columnId: VALID_COL_B_ID, position: 500 };
    const result = applyTaskMove(map, movedTask, columnIds);
    expect(result[VALID_COL_A_ID]).toHaveLength(1);
    expect(result[VALID_COL_A_ID]?.[0]?.id).toBe("t2");
  });

  it("inserts task into target column", () => {
    const movedTask: SocketTask = { ...t1, columnId: VALID_COL_B_ID, position: 500 };
    const result = applyTaskMove(map, movedTask, columnIds);
    expect(result[VALID_COL_B_ID]).toHaveLength(1);
    expect(result[VALID_COL_B_ID]?.[0]?.id).toBe("t1");
  });

  it("sorts target column tasks by position after insertion", () => {
    const existing: SocketTask = {
      ...t2,
      columnId: VALID_COL_B_ID,
      position: 1000,
    };
    const mapWithExisting: Record<string, SocketTask[]> = {
      [VALID_COL_A_ID]: [t1],
      [VALID_COL_B_ID]: [existing],
    };
    const movedTask: SocketTask = { ...t1, columnId: VALID_COL_B_ID, position: 500 };
    const result = applyTaskMove(mapWithExisting, movedTask, columnIds);

    // position 500 should come before 1000
    expect(result[VALID_COL_B_ID]?.[0]?.position).toBe(500);
    expect(result[VALID_COL_B_ID]?.[1]?.position).toBe(1000);
  });

  it("does not mutate the original tasksMap", () => {
    const original = { [VALID_COL_A_ID]: [t1], [VALID_COL_B_ID]: [] };
    const movedTask: SocketTask = { ...t1, columnId: VALID_COL_B_ID };
    applyTaskMove(original, movedTask, columnIds);
    expect(original[VALID_COL_A_ID]).toHaveLength(1);
  });

  it("handles task moved to same column (no-op move)", () => {
    const sameColTask: SocketTask = { ...t1, columnId: VALID_COL_A_ID, position: 500 };
    const result = applyTaskMove(map, sameColTask, columnIds);
    expect(result[VALID_COL_A_ID]).toHaveLength(2);
    expect(result[VALID_COL_A_ID]?.some((t) => t.id === t1.id)).toBe(true);
  });

  it("creates empty array for unknown columnId in target (defensive)", () => {
    const unknownColTask: SocketTask = { ...t1, columnId: "unknown-col", position: 100 };
    const result = applyTaskMove(map, unknownColTask, columnIds);
    // source removed, target "unknown-col" gets the task
    expect(result["unknown-col"]).toHaveLength(1);
  });

  it("handles task that does not exist in any column (no crash)", () => {
    const phantom: SocketTask = {
      ...t3,
      id: "phantom",
      columnId: VALID_COL_B_ID,
      position: 100,
    };
    const result = applyTaskMove(map, phantom, columnIds);
    expect(result[VALID_COL_B_ID]?.some((t) => t.id === "phantom")).toBe(true);
  });
});
