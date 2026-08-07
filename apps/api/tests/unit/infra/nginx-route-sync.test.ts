import { readFileSync } from "node:fs";
import path from "node:path";
import type { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, PROXIED_API_PATHS } from "../../../src/app";
import { mockIo } from "../../mocks/socket";

const NGINX_CONF_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../infrastructure/nginx/nginx.conf",
);

/**
 * Extracts the path each nginx `location` block proxies, normalized without
 * a trailing slash (nginx.conf uses prefix matches like `/trpc/` for
 * Express `app.use("/trpc", ...)` mounts, and exact matches like
 * `= /healthz` for single `app.get(...)` routes - both should compare equal
 * to app.ts's PROXIED_API_PATHS entries).
 */
function extractNginxApiLocations(conf: string): string[] {
  const locations: string[] = [];
  const pattern = /location\s+(?:=\s+)?(\S+)\s*\{/g;

  for (const match of conf.matchAll(pattern)) {
    const target = match[1];
    if (target === undefined || target === "/") continue;
    locations.push(target.replace(/\/$/, ""));
  }

  return locations;
}

/**
 * Introspects the live Express router for every path registered via
 * `app.get/post/put/.../all(path, handler)` - Express 5's `router` package
 * (unlike `app.use(path, middleware)` mounts) exposes these cleanly via
 * `layer.route.path`, verified against the real running app rather than a
 * hand-typed list. `app.use("/trpc", ...)` does NOT show up here (Express 5's
 * matchers are opaque for path-scoped `.use()` mounts) - that one path is
 * covered separately below by an actual HTTP request, not introspection.
 */
function introspectRoutePaths(router: Router): string[] {
  const paths: string[] = [];
  for (const layer of router.stack) {
    if (layer.route) paths.push(layer.route.path);
  }
  return paths;
}

describe("infrastructure/nginx/nginx.conf and PROXIED_API_PATHS stay in sync with the real app", () => {
  const buildApp = () => createApp(mockIo);
  const conf = readFileSync(NGINX_CONF_PATH, "utf-8");
  const nginxApiLocations = extractNginxApiLocations(conf);

  it("every app.METHOD()-registered route the live Express router actually has is either the catch-all or in PROXIED_API_PATHS", () => {
    const introspected = introspectRoutePaths(buildApp().router).filter((p) => p !== "/{*splat}");

    for (const registeredPath of introspected) {
      expect(PROXIED_API_PATHS).toContain(registeredPath);
    }
  });

  it("has no stale entry in PROXIED_API_PATHS that isn't a real introspected route or the one documented .use() mount", () => {
    // /trpc is registered via app.use(), which Express 5 doesn't expose a
    // matchable path for - it's verified behaviorally in the test below
    // instead of by introspection.
    const knownUseMounts = ["/trpc"];
    const introspected = introspectRoutePaths(buildApp().router);

    for (const declaredPath of PROXIED_API_PATHS) {
      if (knownUseMounts.includes(declaredPath)) continue;
      expect(introspected).toContain(declaredPath);
    }
  });

  it("/trpc actually mounts the tRPC adapter, not a coincidental catch-all match", async () => {
    const res = await request(buildApp()).get("/trpc/nonexistent");

    // The generic Express catch-all responds {error:{message,code}}; a real
    // tRPC response is superjson-wrapped as {error:{json:{...}}} - only the
    // adapter itself produces this shape.
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error.json.data.code", "NOT_FOUND");
  });

  it("tripwires when Express's middleware stack shape changes - a new app.use() mount (introspection can't see those) must update this list, PROXIED_API_PATHS, and nginx.conf together", () => {
    // Deliberately brittle: this snapshot is a canary, not a stable API. If
    // it changes, that's a real signal to re-check whether the new/removed
    // layer is a path-scoped .use() mount that needs proxying. Named entries
    // (not just a count) so a failure shows exactly which layer moved
    // instead of a bare number that could be any middleware, unrelated or not.
    const names = buildApp().router.stack.map((layer) => layer.name);

    expect(names).toEqual([
      "helmetMiddleware",
      "corsMiddleware",
      "jsonParser",
      "urlencodedParser",
      "cookieParser",
      "metricsMiddleware",
      "<anonymous>", // pino-http request logger
      "handle", // GET /metrics
      "handle", // GET /healthz
      "handle", // GET /readyz
      "<anonymous>", // defaultRateLimiter
      "<anonymous>", // /trpc app.use() mount
      "handle", // catch-all 404
      "errorHandler",
    ]);
  });

  it("proxies every path apps/api actually serves", () => {
    for (const apiPath of PROXIED_API_PATHS) {
      expect(nginxApiLocations).toContain(apiPath);
    }
  });

  it("has no api location that app.ts doesn't actually register", () => {
    // /socket.io is Engine.IO, attached outside Express (see server.ts) -
    // it's intentionally not part of PROXIED_API_PATHS.
    const knownNonExpressPaths = ["/socket.io"];

    for (const nginxPath of nginxApiLocations) {
      if (knownNonExpressPaths.includes(nginxPath)) continue;
      expect(PROXIED_API_PATHS).toContain(nginxPath);
    }
  });

  it("still proxies /socket.io with websocket upgrade headers", () => {
    const socketBlockMatch = /location\s+\/socket\.io\/\s*\{([^}]*)\}/.exec(conf);

    expect(socketBlockMatch).not.toBeNull();
    expect(socketBlockMatch?.[1]).toContain("Upgrade");
  });

  it("falls back everything else to web (the catch-all location)", () => {
    expect(conf).toMatch(/location\s+\/\s*\{/);
  });
});
