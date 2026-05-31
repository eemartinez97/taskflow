import { defineConfig, mergeConfig, type ViteUserConfig } from "vitest/config";

/**
 * Base Vitest 4 configuration.
 * Each package extends this via mergeConfig():
 *
 * import { mergeConfig, baseVitestConfig } from "@taskflow/config/vitest/base";
 * import { defineConfig } from "vitest/config";
 * export default mergeConfig(baseVitestConfig, defineConfig({ test: { ... } }));
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

// Re-export so consumers only need one import
export { mergeConfig, defineConfig };
