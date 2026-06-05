import { defineConfig, mergeConfig, type ViteUserConfig } from "vitest/config";

/**
 * Base Vitest 4 configuration shared across all packages.
 *
 * Usage in each package's vitest.config.ts:
 *
 *   import { defineConfig } from "vitest/config";
 *   import { mergeConfig, baseVitestConfig } from "@taskflow/config/vitest/base";
 *
 *   export default mergeConfig(baseVitestConfig, defineConfig({ test: { ... } }));
 */

export const baseVitestConfig: ViteUserConfig = defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/coverage/**",
        "**/*.config.{ts,js,mjs}",
        "**/tests/**",
        "**/__mocks__/**",
        "**/index.ts",
      ],
    },
    clearMocks: true,
    restoreMocks: true,
  },
});

// Only export mergeConfig - consumers import defineConfig directly from "vitest/config"
export { mergeConfig };
