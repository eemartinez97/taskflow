import { mergeConfig, baseVitestConfig, defineConfig } from "@taskflow/config/vitest/base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: "node",
      coverage: {
        // packages/shared must hit >= 90% coverage
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        include: ["src/**/*.ts"],
      },
    },
  }),
);
