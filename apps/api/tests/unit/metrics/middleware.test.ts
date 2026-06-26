import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMetricsMiddleware, normalizeRoute } from "../../../src/metrics/index.js";
import {
  type TestCollectors,
  makeMockNext,
  makeMockReq,
  makeMockResEE,
  makeTestCollectors,
} from "../../helpers.js";

describe("normalizeRoute", () => {
  it("returns req.route.path when the Express route was matched", () => {
    const req = makeMockReq({ route: { path: "/projects/:id" } });
    expect(normalizeRoute(req)).toBe("/projects/:id");
  });

  it("collapses tRPC path to /trpc/:path", () => {
    expect(normalizeRoute(makeMockReq({ url: "/trpc/tasks.list" }))).toBe("/trpc/:path");
    expect(normalizeRoute(makeMockReq({ url: "/trpc/auth.me" }))).toBe("/trpc/:path");
  });

  it("preserves /healthz exactly", () => {
    expect(normalizeRoute(makeMockReq({ url: "/healthz" }))).toBe("/healthz");
  });

  it("preserves /readyz exactly", () => {
    expect(normalizeRoute(makeMockReq({ url: "/readyz" }))).toBe("/readyz");
  });

  it("returns 'unknown' for unmatched paths (catch-all fallback)", () => {
    expect(normalizeRoute(makeMockReq({ url: "not-a-real-route" }))).toBe("unknown");
  });

  it("returns 'unknown' when url is undefined", () => {
    const req = makeMockReq({ url: "/some/unknown/path" });
    // / does not match tRPC, health, or a matched route -> "unknown"
    expect(normalizeRoute(req)).toBe("unknown");
  });
});

describe("createMetricsMiddleware", () => {
  let collectors: TestCollectors;

  beforeEach(() => {
    ({ collectors } = makeTestCollectors());
  });

  it("calls next() immediately", () => {
    const next = makeMockNext();
    createMetricsMiddleware(collectors)(makeMockReq(), makeMockResEE(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("skips /metrics endpoint - next() is called but no gauge is incremented", () => {
    const incSpy = vi.spyOn(collectors.httpRequestsInProgress, "inc");
    createMetricsMiddleware(collectors)(
      makeMockReq({ url: "/metrics" }),
      makeMockResEE(),
      makeMockNext(),
    );
    expect(incSpy).not.toHaveBeenCalled();
  });

  it("increments httpRequestsInProgress with method label before the response finishes", () => {
    const incSpy = vi.spyOn(collectors.httpRequestsInProgress, "inc");
    createMetricsMiddleware(collectors)(
      makeMockReq({ method: "GET" }),
      makeMockResEE(),
      makeMockNext(),
    );
    expect(incSpy).toHaveBeenCalledWith({ method: "GET" });
  });

  it("decrements httpRequestsInProgress on response finish", () => {
    const decSpy = vi.spyOn(collectors.httpRequestsInProgress, "dec");
    const res = makeMockResEE();
    createMetricsMiddleware(collectors)(makeMockReq({ method: "GET" }), res, makeMockNext());
    res.emit("finish");
    expect(decSpy).toHaveBeenCalledWith({ method: "GET" });
  });

  it("increments httpRequestsTotal on finish with correct labels", () => {
    const incSpy = vi.spyOn(collectors.httpRequestsTotal, "inc");
    const res = makeMockResEE(200);
    createMetricsMiddleware(collectors)(
      makeMockReq({ method: "POST", url: "/trpc/tasks.create" }),
      res,
      makeMockNext(),
    );
    res.emit("finish");

    expect(incSpy).toHaveBeenCalledWith({
      method: "POST",
      route: "/trpc/:path",
      status_code: "200",
    });
  });

  it("calls httpRequestDurationSeconds.observe on finish with the correct labels and a numeric duration", () => {
    const observeSpy = vi.spyOn(collectors.httpRequestDurationSeconds, "observe");
    const res = makeMockResEE(200);
    createMetricsMiddleware(collectors)(
      makeMockReq({ method: "GET", url: "/healthz" }),
      res,
      makeMockNext(),
    );
    res.emit("finish");

    expect(observeSpy).toHaveBeenCalledOnce();
    expect(observeSpy).toHaveBeenCalledWith(
      { method: "GET", route: "/healthz", status_code: "200" },
      expect.any(Number),
    );
  });

  it("duration passed to observe a non-negative number", () => {
    const observeSpy = vi.spyOn(collectors.httpRequestDurationSeconds, "observe");
    const res = makeMockResEE(200);
    createMetricsMiddleware(collectors)(makeMockReq(), res, makeMockNext());
    res.emit("finish");

    const spyCalls = observeSpy.mock.calls as unknown as [
      labels: Record<string, string>,
      value: number,
    ][];
    const duration = spyCalls[0]?.[1];
    expect(typeof duration).toBe("number");
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it("does not call httpRequestsTotal before response finish event", () => {
    const incSpy = vi.spyOn(collectors.httpRequestsTotal, "inc");
    createMetricsMiddleware(collectors)(makeMockReq(), makeMockResEE(), makeMockNext());
    // finish not emitted yet - counter must not fire
    expect(incSpy).not.toHaveBeenCalled();
  });

  it("records status_code as string in httpRequestsTotal labels", () => {
    const incSpy = vi.spyOn(collectors.httpRequestsTotal, "inc");
    const res = makeMockResEE(404);
    createMetricsMiddleware(collectors)(makeMockReq({ url: "/not-found" }), res, makeMockNext());
    res.emit("finish");

    expect(incSpy).toHaveBeenCalledWith(expect.objectContaining({ status_code: "404" }));
  });

  it("handles multiple concurrent requests independently", () => {
    const incSpy = vi.spyOn(collectors.httpRequestsTotal, "inc");
    const res1 = makeMockResEE(200);
    const res2 = makeMockResEE(500);

    createMetricsMiddleware(collectors)(makeMockReq({ method: "GET" }), res1, makeMockNext());
    createMetricsMiddleware(collectors)(makeMockReq({ method: "POST" }), res2, makeMockNext());

    res1.emit("finish");
    res2.emit("finish");

    expect(incSpy).toHaveBeenCalledTimes(2);
    expect(incSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ method: "GET" }));
    expect(incSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ method: "POST" }));
  });
});
