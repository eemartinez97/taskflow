import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/env.js");

import { createAppRouter } from "../../../src/trpc/router.js";
import { mockIo } from "../../mocks/socket.js";

describe("appRouter", () => {
  const router = createAppRouter(mockIo);

  it("is a valid tRPC router object", () => {
    expect(router).toBeDefined();
    // tRPC routers expose a _def property with their procedure definitions
    expect(router._def).toBeDefined();
  });

  it("exposes a _def.procedures object", () => {
    expect(typeof router._def.procedures).toBe("object");
  });

  it("has all 8 resource routers registered", () => {
    const keys = Object.keys(router._def.record);
    expect(keys).toEqual(
      expect.arrayContaining([
        "auth",
        "orgs",
        "projects",
        "boards",
        "tasks",
        "comments",
        "labels",
        "notifications",
      ]),
    );
    expect(keys).toHaveLength(8);
  });
});
