import { describe, expect, it } from "vitest";
import { fireAndForget } from "../../../src/utils/fire-and-forget";
import { mockLogger } from "../../mocks/logger";

describe("fireAndForget", () => {
  it("does not throw when the promise resolves", () => {
    expect(() => {
      fireAndForget(Promise.resolve("ok"), "should not log");
    }).not.toThrow();
  });

  it("logs the error and extra fields when the promise rejects", async () => {
    const error = new Error("boom");

    fireAndForget(Promise.reject(error), "something failed", { taskId: "task-1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: error, taskId: "task-1" },
      "something failed",
    );
  });

  it("defaults to no extra fields", async () => {
    const error = new Error("boom");

    fireAndForget(Promise.reject(error), "something failed");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockLogger.error).toHaveBeenCalledWith({ err: error }, "something failed");
  });

  it("does not throw or become an unhandled rejection", async () => {
    expect(() => {
      fireAndForget(Promise.reject(new Error("boom")), "something failed");
    }).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
