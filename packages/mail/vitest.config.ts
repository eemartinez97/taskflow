import { baseVitestConfig, mergeConfig, defineConfig } from "@taskflow/config/vitest/base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["tests/**/*.test.{ts,tsx}"],
      coverage: {
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/index.ts"],
        thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  }),
);
