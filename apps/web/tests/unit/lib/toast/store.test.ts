import { afterEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/toast/store");

import { dismissToast, getServerToasts, getToasts, subscribe, toast } from "@/lib/toast/store";

afterEach(() => {
  // Drain any toasts left by a previous test so state doesn't leak.
  for (const t of getToasts()) dismissToast(t.id);
});

describe("toast store", () => {
  it("success() pushes a toast with variant 'success'", () => {
    toast.success("Saved!");
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({ message: "Saved!", variant: "success" });
  });

  it("error() pushes a toast with variant 'error'", () => {
    toast.error("Failed!");
    expect(getToasts()[0]).toMatchObject({ variant: "error" });
  });

  it("warning() pushes a toast with variant 'warning'", () => {
    toast.warning("Careful!");
    expect(getToasts()[0]).toMatchObject({ variant: "warning" });
  });

  it("info() pushes a toast with variant 'info'", () => {
    toast.info("FYI");
    expect(getToasts()[0]).toMatchObject({ variant: "info" });
  });

  it("dismissToast removes only the matching toast by id", () => {
    toast.success("First");
    toast.success("Second");
    const [first] = getToasts();
    if (first) dismissToast(first.id);
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]?.message).toBe("Second");
  });

  it("notifies subscribers on every push and dismiss", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    toast.success("Hi");
    expect(listener).toHaveBeenCalledTimes(1);
    const firstToast = getToasts()[0];
    if (firstToast) dismissToast(firstToast.id);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();
    toast.success("Hi");
    expect(listener).not.toHaveBeenCalled();
  });

  it("getServerToasts always returns an empty, stable array", () => {
    toast.success("Hi");
    expect(getServerToasts()).toEqual([]);
  });
});
