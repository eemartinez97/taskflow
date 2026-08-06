import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { getClientIp as GetClientIp } from "@/lib/http/client-ip";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", { headers });
}

// Every test dynamically (re-)imports client-ip.ts AFTER setting
// TRUSTED_PROXY_HOPS and resetting the module registry - a top-level static
// import here would get permanently cached with whatever env was set on
// first load (a documented vi.resetModules() limitation for modules that
// are ALSO imported statically), which would make the hop-count-override
// tests silently exercise the wrong instance.
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function loadGetClientIp(): Promise<typeof GetClientIp> {
  const mod = await import("@/lib/http/client-ip");
  return mod.getClientIp;
}

describe("getClientIp (default TRUSTED_PROXY_HOPS=1)", () => {
  it("returns the single entry of a single-hop x-forwarded-for header", async () => {
    const getClientIp = await loadGetClientIp();
    expect(getClientIp(makeRequest({ "x-forwarded-for": "203.0.113.5" }))).toBe("203.0.113.5");
  });

  it("returns the LAST entry (appended by the one trusted hop), not the client-supplied leftmost entry", async () => {
    const getClientIp = await loadGetClientIp();
    // "203.0.113.5" is whatever the client claimed; "10.0.0.1" is the real
    // client IP our one trusted proxy actually observed and appended.
    const req = makeRequest({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("ignores extra attacker-prepended entries beyond the trusted hop count", async () => {
    const getClientIp = await loadGetClientIp();
    const req = makeRequest({ "x-forwarded-for": "9.9.9.9, 8.8.8.8, 203.0.113.5, 10.0.0.1" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("trims whitespace around entries", async () => {
    const getClientIp = await loadGetClientIp();
    const req = makeRequest({ "x-forwarded-for": "  203.0.113.5  ,  10.0.0.1  " });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("rejects an out-of-range IPv4 octet and falls back to x-real-ip", async () => {
    const getClientIp = await loadGetClientIp();
    const req = makeRequest({
      "x-forwarded-for": "999.999.999.999",
      "x-real-ip": "198.51.100.7",
    });
    expect(getClientIp(req)).toBe("198.51.100.7");
  });

  it("rejects a non-IP value (header-injection junk) and falls back to x-real-ip", async () => {
    const getClientIp = await loadGetClientIp();
    const req = makeRequest({
      "x-forwarded-for": "'; DROP TABLE users;--",
      "x-real-ip": "198.51.100.7",
    });
    expect(getClientIp(req)).toBe("198.51.100.7");
  });

  it("accepts a valid IPv6 literal", async () => {
    const getClientIp = await loadGetClientIp();
    const req = makeRequest({ "x-forwarded-for": "2001:db8::1" });
    expect(getClientIp(req)).toBe("2001:db8::1");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    const getClientIp = await loadGetClientIp();
    expect(getClientIp(makeRequest({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("prefers x-forwarded-for over x-real-ip when both are present", async () => {
    const getClientIp = await loadGetClientIp();
    const req = makeRequest({ "x-forwarded-for": "203.0.113.5", "x-real-ip": "198.51.100.7" });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("returns null when neither header is present", async () => {
    const getClientIp = await loadGetClientIp();
    expect(getClientIp(makeRequest({}))).toBeNull();
  });

  it("returns null when x-forwarded-for is present but empty and x-real-ip is absent", async () => {
    const getClientIp = await loadGetClientIp();
    expect(getClientIp(makeRequest({ "x-forwarded-for": "" }))).toBeNull();
  });

  it("falls back to x-real-ip when x-forwarded-for's only entry trims to empty", async () => {
    const getClientIp = await loadGetClientIp();
    const req = makeRequest({ "x-forwarded-for": "  ,  ", "x-real-ip": "198.51.100.7" });
    expect(getClientIp(req)).toBe("198.51.100.7");
  });
});

describe("getClientIp (configurable TRUSTED_PROXY_HOPS)", () => {
  it("walks back to the entry the FIRST trusted hop appended when TRUSTED_PROXY_HOPS=2 (e.g. a CDN chained in front of the PaaS edge)", async () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const getClientIp = await loadGetClientIp();

    // "203.0.113.5" is client-supplied (untrusted). The CDN (first trusted
    // hop) appends the real client IP it saw: "10.0.0.1". The PaaS edge
    // (second trusted hop) then appends the CDN's own address: "10.0.0.2" -
    // NOT the client's. The real client IP is therefore the FIRST of the
    // two trusted-appended entries, not the last.
    const req = makeRequest({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("ignores x-forwarded-for entirely and falls back to x-real-ip when TRUSTED_PROXY_HOPS=0 (no trusted proxy in front)", async () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    const getClientIp = await loadGetClientIp();

    // With zero trusted hops, NOTHING in x-forwarded-for was ever appended
    // by a proxy this deployment trusts - the whole header is attacker
    // territory and must be ignored, not just its leftmost entry.
    const req = makeRequest({
      "x-forwarded-for": "203.0.113.5, 10.0.0.1",
      "x-real-ip": "198.51.100.7",
    });
    expect(getClientIp(req)).toBe("198.51.100.7");
  });

  it("clamps to the leftmost entry when the header has fewer entries than TRUSTED_PROXY_HOPS (best-effort under misconfiguration)", async () => {
    process.env.TRUSTED_PROXY_HOPS = "3";
    const getClientIp = await loadGetClientIp();

    const req = makeRequest({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });
});
