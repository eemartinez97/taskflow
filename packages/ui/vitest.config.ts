import { baseVitestConfig, mergeConfig } from "@taskflow/config/vitest/base";
import { defineConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      include: ["tests/**/*.test.{ts,tsx}"],
      setupFiles: ["./tests/setup.ts"],
      coverage: {
        // packages/shared must hit >= 90% coverage
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/index.ts", "src/theme.css"],
      },
    },
  }),
);
