import type { NextConfig } from "next";

/**
 * Next.js 16 configuration
 *
 * `cacheComponents: true` replaces `experimental.dynamicIO` and
 * `experimental_ppr` from Next.js 15. With this flag enabled:
 * - `fetch` is NOT cached by default (opt-in per request with cache: 'force-cache')
 * - `'use cache'` directive and `cacheLife()` / `cacheTag()` are stable
 * - Turbopack is the is the default bundler for both `env` and `build`
 */
const nextConfig: NextConfig = {
  cacheComponents: true,

  // Strict mode helps surface React 19 concurrent-mode issues early
  reactStrictMode: true,

  // Allow images from common avatar providers
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
