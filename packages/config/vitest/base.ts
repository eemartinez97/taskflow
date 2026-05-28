import { defineConfig, type ViteUserConfig } from "vitest/config";

/**
 * Base Vitest 4 configuration shared across all packages and apps.
 * Each consumer calls defineConfig() and spreads/merges this.
 *
 * Vitest 4 notes:
 * - `coverage.all`, `coverage.extensions`, `poolMatchGlobs` removed.
 * - Use `projects` instead of `poolMatchGlobs`.
 * - Use `coverage.include` / `coverage.exclude` for glob patterns.
 */

export const baseVitestConfig: ViteUserConfig = defineConfig({
  test: {
    // Use V8 for coverage (fastest, no instrumentation overhead)
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/coverage/**",
        "**/*.config.{ts,js,mjs}",
        "**/test/**",
        "**/__mocks__/**",
      ],
    },
    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,
  },
});

export default baseVitestConfig;
