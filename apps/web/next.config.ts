import path from "node:path";
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

  // Docker only: `.next/standalone` only bundles this app's own directory
  // unless told the tracing root is the monorepo root, so it can also pick
  // up packages/* (consumed as raw .ts via workspace `exports`) and the
  // generated Prisma client. With this root, server.js lands at
  // `.next/standalone/apps/web/server.js`, not at the standalone root.
  //
  // Gated behind NEXT_STANDALONE_BUILD (set only by apps/web/Dockerfile) -
  // `output: "standalone"` makes `next start` refuse to run ("does not work
  // with output: standalone"), which is exactly how E2E boots the app
  // locally (playwright.config.ts's webServer: `next build && next start`).
  // Local dev/build/E2E must stay on the plain build; only the Docker image
  // needs the standalone artifact.
  ...(process.env.NEXT_STANDALONE_BUILD === "true" && {
    output: "standalone" as const,
    outputFileTracingRoot: path.join(__dirname, "../.."),
  }),

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
