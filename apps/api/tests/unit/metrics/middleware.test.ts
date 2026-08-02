import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMetricsMiddleware,
  normalizeRoute,
  stripQuery,
} from "../../../src/metrics/middleware";
import {
  makeMockNext,
  makeMockReq,
  makeMockResEE,
  makeTestCollectors,
  type TestCollectors,
} from "../../helpers";

describe("stripQuery", () => {
  it.each([
    ["/metrics", "/metrics"],
    ["/metrics?foo=1", "/metrics"],
    ["/healthz?", "/healthz"],
  ])("%s -> %s", (input, expected) => {
    expect(stripQuery(input)).toBe(expected);
  });
});

describe("normalizeRoute", () => {
  it.each([
    [
      "matched Express route wins",
      { url: "/tasks/abc", route: { path: "/tasks/:taskId" } },
      "/tasks/:taskId",
    ],
    ["route is null", { url: "/trpc/tasks.list", route: null }, "/trpc/:path"],
    ["route has no path", { url: "/trpc/tasks.list", route: {} }, "/trpc/:path"],
    ["route.path is not a string", { url: "/trpc/x", route: { path: 42 } }, "/trpc/:path"],
    ["route is a primitive", { url: "/trpc/x", route: "nope" }, "/trpc/:path"],
    [
      "tRPC namespace collapses",
      { url: "/trpc/orgs.list?batch=1", route: undefined },
      "/trpc/:path",
    ],
    ["healthz keeps its path", { url: "/healthz", route: undefined }, "/healthz"],
    ["readyz keeps its path", { url: "/readyz", route: undefined }, "/readyz"],
    ["healthz with query", { url: "/readyz?probe=1", route: undefined }, "/readyz"],
    ["unmatched falls back", { url: "/does-not-exist", route: undefined }, "unknown"],
  ])("%s", (_name, overrides, expected) => {
    expect(normalizeRoute(makeMockReq(overrides))).toBe(expected);
  });
});

describe("createMetricsMiddleware", () => {
  let collectors: TestCollectors;

  beforeEach(() => {
    ({ collectors } = makeTestCollectors());
  });

  it("skips the /metrics endpoint entirely", () => {
    const inc = vi.spyOn(collectors.httpRequestsInProgress, "inc");
    const next = makeMockNext();

    createMetricsMiddleware(collectors)(
      makeMockReq({ url: "/metrics?foo=1" }),
      makeMockResEE(),
      next,
    );

    expect(inc).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("increments the in-progress gauge before the response settles", () => {
    const inc = vi.spyOn(collectors.httpRequestsInProgress, "inc");
    const dec = vi.spyOn(collectors.httpRequestsInProgress, "dec");

    createMetricsMiddleware(collectors)(
      makeMockReq({ method: "POST" }),
      makeMockResEE(),
      makeMockNext(),
    );

    expect(inc).toHaveBeenCalledWith({ method: "POST" });
    expect(dec).not.toHaveBeenCalled();
  });

  it("records counter, gauge and histogram once the response finishes", () => {
    vi.spyOn(process.hrtime, "bigint").mockReturnValueOnce(0n).mockReturnValueOnce(1_500_000_000n);

    const dec = vi.spyOn(collectors.httpRequestsInProgress, "dec");
    const total = vi.spyOn(collectors.httpRequestsTotal, "inc");
    const observe = vi.spyOn(collectors.httpRequestDurationSeconds, "observe");

    const res = makeMockResEE(201);
    const req = makeMockReq({ method: "POST", url: "/tasks", route: { path: "/tasks" } });

    createMetricsMiddleware(collectors)(req, res, makeMockNext());
    res.emit("finish");

    const labels = { method: "POST", route: "/tasks", status_code: "201" };

    expect(dec).toHaveBeenCalledWith({ method: "POST" });
    expect(total).toHaveBeenCalledWith(labels);
    expect(observe).toHaveBeenCalledWith(labels, 1.5);
  });

  it("records exactly once when both finish and close fire", () => {
    const total = vi.spyOn(collectors.httpRequestsTotal, "inc");
    const res = makeMockResEE();

    createMetricsMiddleware(collectors)(makeMockReq(), res, makeMockNext());
    res.emit("finish");
    res.emit("close");

    expect(total).toHaveBeenCalledOnce();
  });

  it("still releases the gauge when the client aborts (close without finish)", () => {
    const dec = vi.spyOn(collectors.httpRequestsInProgress, "dec");
    const res = makeMockResEE(499);

    createMetricsMiddleware(collectors)(makeMockReq(), res, makeMockNext());
    res.emit("close");

    expect(dec).toHaveBeenCalledOnce();
  });

  it("always calls next()", () => {
    const next = makeMockNext();

    createMetricsMiddleware(collectors)(makeMockReq(), makeMockResEE(), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
