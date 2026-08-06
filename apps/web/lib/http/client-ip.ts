import "server-only";
import type { NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

/** Rejects header-injection junk (e.g. `"; DROP TABLE"`) - a real IPv4 or IPv6 literal only. */
function looksLikeIp(value: string): boolean {
  const v4 = IPV4_RE.exec(value);
  if (v4) return v4.slice(1).every((octet) => Number(octet) <= 255);
  return value.includes(":") && IPV6_RE.test(value);
}

/**
 * Best-effort client IP for rate-limiting purposes.
 *
 * `x-forwarded-for` is a comma-separated list that each proxy hop APPENDS
 * to - each hop appends the address of whoever connected TO IT (its
 * immediate peer), not its own address. So for one trusted proxy sitting
 * directly in front of this app, that proxy's own peer IS the real client,
 * and it appends that address as the LAST entry - everything to its left is
 * whatever the original client sent, which is entirely attacker-controlled
 * (the client can prepend an arbitrary fake list before the header ever
 * reaches the first trusted hop). Trusting the first (leftmost) entry
 * blindly - as this function used to - lets any caller spoof an arbitrary
 * IP just by setting the header themselves.
 *
 * `TRUSTED_PROXY_HOPS` (env, default 1) says how many trusted proxies sit
 * between the internet and this process for the CURRENT deployment. The
 * real client IP is the FIRST of the last `TRUSTED_PROXY_HOPS` entries
 * (index `hops.length - TRUSTED_PROXY_HOPS`) - it's the address the
 * nearest-to-the-client trusted proxy appended; every trusted hop after it
 * only re-appends the address of the trusted hop before it, not the
 * client's. This is the same "trust proxy count" algorithm Express/
 * `proxy-addr` use - deliberately platform-agnostic rather than reading a
 * specific host's (e.g. Vercel's) proprietary header, since this project
 * has no confirmed single deployment target. With zero trusted hops, no
 * entry in the header was ever appended by anything this deployment
 * trusts, so the whole header is ignored.
 *
 * Falls back to `x-real-ip`, then to `null` if genuinely unavailable -
 * callers should treat `null` as "skip IP-based limiting for this request"
 * rather than block it, since blocking on an unknown IP would make every
 * such request share one bucket.
 */
export function getClientIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const clientIndex = hops.length - serverEnv.TRUSTED_PROXY_HOPS;
    if (clientIndex < hops.length) {
      const candidate = hops[Math.max(clientIndex, 0)];
      if (candidate && looksLikeIp(candidate)) return candidate;
    }
  }
  const realIp = req.headers.get("x-real-ip");
  return realIp && looksLikeIp(realIp) ? realIp : null;
}
