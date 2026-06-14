import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/env.js");

import { appRouter } from "../../../src/trpc/router.js";

describe("appRouter", () => {
  it("is a valid tRPC router object", () => {
    expect(appRouter).toBeDefined();
    // tRPC routers expose a _def property with their procedure definitions
    expect(appRouter._def).toBeDefined();
  });

  it("exposes a _def.procedures object", () => {
    expect(typeof appRouter._def.procedures).toBe("object");
  });

  it("is initially empty (resource routers added later)", () => {
    // No procedures yet - just a shell router
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toHaveLength(0);
  });
});
