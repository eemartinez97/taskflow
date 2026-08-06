import { describe, expect, it, vi } from "vitest";
import { withMinimumLatency } from "@/lib/http/with-minimum-latency";

describe("withMinimumLatency", () => {
  it("waits out the remainder when fn resolves faster than minMs", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1030);
    const setTimeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation(((cb: () => void) => {
      cb();
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof setTimeout);
    const fn = vi.fn(() => Promise.resolve("done"));

    await expect(withMinimumLatency(fn, 100)).resolves.toBe("done");

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 70);
    nowSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it("returns immediately without waiting when fn already took at least minMs", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1150);
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const fn = vi.fn(() => Promise.resolve("done"));

    await expect(withMinimumLatency(fn, 100)).resolves.toBe("done");

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    nowSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it("propagates a rejection from fn without invoking the latency floor", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const fn = vi.fn(() => Promise.reject(new Error("boom")));

    await expect(withMinimumLatency(fn, 100)).rejects.toThrow("boom");

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});
