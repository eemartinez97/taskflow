import { baseVitestConfig, defineConfig, mergeConfig } from "@taskflow/config/vitest/base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      coverage: {
        include: ["src/**/*.ts"],
        exclude: ["src/types/socket-events.ts"],
        thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  }),
);
