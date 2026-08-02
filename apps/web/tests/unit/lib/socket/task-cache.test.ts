import { describe, expect, it } from "vitest";
import { applyTaskMove, removeTask, upsertTask } from "@/lib/socket/task-cache";
import { toSocketTask, makeTask } from "@/tests/support/factories";
import { VALID_COL_A_ID, VALID_COL_B_ID } from "@/tests/support/fixtures";

describe("upsertTask", () => {
  it("appends when the task doesn't exist yet", () => {
    const result = upsertTask(undefined, toSocketTask(makeTask()));
    expect(result).toHaveLength(1);
  });

  it("replaces the existing entry with the same id in place", () => {
    const original = toSocketTask(makeTask({ title: "Old" }));
    const updated = toSocketTask(makeTask({ title: "New" }));
    const result = upsertTask([original], updated);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("New");
  });
});

describe("removeTask", () => {
  it("filters out the task by id", () => {
    const task = toSocketTask(makeTask());
    expect(removeTask([task], task.id)).toHaveLength(0);
  });

  it("returns an empty array when prev is undefined", () => {
    expect(removeTask(undefined, "any-id")).toEqual([]);
  });

  it("returns the list unchanged when the id isn't found", () => {
    const task = toSocketTask(makeTask());
    expect(removeTask([task], "missing-id")).toEqual([task]);
  });
});

describe("applyTaskMove", () => {
  it("moves a task from one column to another, sorted by position", () => {
    const task = toSocketTask(makeTask({ columnId: VALID_COL_B_ID, position: 500 }));
    const map = { [VALID_COL_A_ID]: [toSocketTask(makeTask())], [VALID_COL_B_ID]: [] };
    const result = applyTaskMove(map, task, [VALID_COL_A_ID, VALID_COL_B_ID]);
    expect(result[VALID_COL_A_ID]).toHaveLength(0);
    expect(result[VALID_COL_B_ID]).toHaveLength(1);
  });

  it("does not mutate the input map (returns new references)", () => {
    const map = { [VALID_COL_A_ID]: [] };
    const result = applyTaskMove(map, toSocketTask(makeTask()), [VALID_COL_A_ID]);
    expect(result).not.toBe(map);
  });

  it("falls back to empty array if target column is not in map", () => {
    const task = toSocketTask(makeTask({ columnId: "col-3", position: 50 }));
    const map = { [VALID_COL_A_ID]: [] };
    const result = applyTaskMove(map, task, [VALID_COL_A_ID]);
    expect(result["col-3"]).toEqual([task]);
  });

  it("sorts tasks by position when moving to a new column", () => {
    const existingTask = toSocketTask(
      makeTask({ id: "t1", position: 100, columnId: VALID_COL_B_ID }),
    );
    const newTask = toSocketTask(makeTask({ id: "t2", position: 50, columnId: VALID_COL_B_ID }));
    const map = { [VALID_COL_A_ID]: [], [VALID_COL_B_ID]: [existingTask] };

    const result = applyTaskMove(map, newTask, [VALID_COL_A_ID, VALID_COL_B_ID]);

    expect(result[VALID_COL_B_ID]).toHaveLength(2);
    expect(result[VALID_COL_B_ID]?.[0]?.id).toBe("t2"); // position 50 should be first
  });

  it("skips columns that aren't present in the map when clearing the old position", () => {
    const task = toSocketTask(makeTask({ columnId: VALID_COL_B_ID, position: 10 }));
    const map = { [VALID_COL_A_ID]: [toSocketTask(makeTask())] };
    const result = applyTaskMove(map, task, [VALID_COL_A_ID, VALID_COL_B_ID, "col-missing"]);
    expect(result[VALID_COL_B_ID]).toHaveLength(1);
  });
});
