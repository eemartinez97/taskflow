import { mergeConfig, baseVitestConfig } from "@taskflow/config/vitest/base";
import { defineConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      coverage: {
        // packages/shared must hit >= 90% coverage
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        exclude: ["src/types/socket-events.ts"],
        include: ["src/**/*.ts"],
      },
    },
  }),
);
