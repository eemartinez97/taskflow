import { baseVitestConfig, mergeConfig } from "@taskflow/config/vitest/base";
import { defineConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: "node",
      passWithNoTests: true,
      coverage: {
        include: ["src/**/*.ts"],
        exclude: ["src/generated/**", "src/index.ts", "src/types.ts"],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  }),
);
