import { describe, expect, it } from "vitest";
import { hasUnsavedChanges, registerDirtyCheck } from "@/lib/utils/navigation-guard";

describe("navigation-guard", () => {
  it("returns false when no check is registered", () => {
    expect(hasUnsavedChanges()).toBe(false);
  });

  it("returns true when any registered check reports dirty state", () => {
    const unregister = registerDirtyCheck(() => true);
    expect(hasUnsavedChanges()).toBe(true);
    unregister();
  });

  it("stops considering a check after it unregisters", () => {
    const unregister = registerDirtyCheck(() => true);
    unregister();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it("ORs multiple checks - true if at least one is dirty", () => {
    const unregisterA = registerDirtyCheck(() => false);
    const unregisterB = registerDirtyCheck(() => true);
    expect(hasUnsavedChanges()).toBe(true);
    unregisterA();
    unregisterB();
  });
});
