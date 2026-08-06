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
        thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  }),
);
