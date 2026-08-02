import { defineConfig, mergeConfig } from "vitest/config";

/**
 * Base Vitest configuration shared across all packages/apps in the monorepo.
 *
 * CRITICAL: `baseVitestConfig` must NEVER be given an explicit type
 * annotation (e.g. `: ViteUserConfig`). `defineConfig({...})` called with a
 * plain object literal resolves TypeScript's "object form" overload and
 * infers a concrete `UserConfig` return type. Adding an explicit annotation
 * widens that concrete type back to the full overload-union type Vitest
 * declares for defineConfig's return value - and `mergeConfig`'s own
 * overloaded signature cannot resolve against that union, collapsing its
 * parameter type to `never`. Leaving the const un-annotated (letting TS
 * infer it) is what keeps `mergeConfig(baseVitestConfig, defineConfig({...}))`
 * fully type-safe AND fully autocompleted in every consumer.
 *
 * Usage in each package's vitest.config.ts (mirrors Vitest's own docs for
 * merging shared config - see https://vitest.dev/config/#merging-config):
 *
 *   import { defineConfig, mergeConfig } from "vitest/config";
 *   import { baseVitestConfig } from "@taskflow/config/vitest/base";
 *
 *   export default mergeConfig(baseVitestConfig, defineConfig({
 *     test: { ... },
 *   }));
 */
export const baseVitestConfig = defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // NOTE: `all: true` was removed in Vitest 3+. The modern equivalent is
      // simply setting `coverage.include` in each consumer - Vitest then
      // reports EVERY matching file at 0% even if never imported by a test,
      // which is exactly what `all: true` used to guarantee.
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/coverage/**",
        "**/*.config.{ts,js,mjs}",
        "**/tests/**",
        "**/__mocks__/**",
        "**/index.ts",
        "**/*.d.ts",
      ],
    },
    clearMocks: true,
    restoreMocks: true,
  },
});

export { defineConfig, mergeConfig };
