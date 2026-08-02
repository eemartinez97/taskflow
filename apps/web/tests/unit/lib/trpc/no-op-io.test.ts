import { describe, expect, it } from "vitest";
import { noOpIo } from "@/lib/trpc/no-op-io";
import { SOCKET_EVENTS } from "@taskflow/shared";

describe("noOpIo", () => {
  it("to(room).emit() always returns false and never throws", () => {
    const result = noOpIo
      .to("room-1")
      .emit(SOCKET_EVENTS.TASK_CREATED, { any: "payload" } as never);
    expect(result).toBe(false);
  });
});
