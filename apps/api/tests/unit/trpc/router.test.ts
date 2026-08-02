import { describe, expect, it } from "vitest";

import { createAppRouter } from "../../../src/trpc/router";
import { makeCtx, VALID_USER } from "../../helpers";
import { createCallerFactory } from "../../../src/trpc/init";
import { mockIo } from "../../mocks/socket";

const NAMESPACES = [
  "auth",
  "orgs",
  "projects",
  "boards",
  "tasks",
  "comments",
  "labels",
  "notifications",
] as const;

describe("createAppRouter", () => {
  it("mounts every resource namespace", () => {
    const caller = createCallerFactory(createAppRouter(mockIo))(makeCtx(VALID_USER));

    for (const ns of NAMESPACES) {
      expect(caller[ns], `missing namespace: ${ns}`).toBeDefined();
    }
  });

  it("returns an independent router per io instance", () => {
    expect(createAppRouter(mockIo)).not.toBe(createAppRouter(mockIo));
  });
});
