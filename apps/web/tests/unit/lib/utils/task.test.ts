import { describe, expect, it } from "vitest";
import { formatTaskStatus } from "@/lib/utils/task";

describe("formatTaskStatus", () => {
  it("replaces every underscore with a space", () => {
    expect(formatTaskStatus("IN_PROGRESS")).toBe("IN PROGRESS");
  });

  it("returns status unchanged when there are no underscores", () => {
    expect(formatTaskStatus("DONE")).toBe("DONE");
  });
});
