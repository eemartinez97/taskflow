import { baseVitestConfig, mergeConfig, defineConfig } from "@taskflow/config/vitest/base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      projects: [
        {
          extends: true,
          test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] },
        },
        {
          extends: true,
          test: {
            name: "integration",
            environment: "node",
            include: ["tests/integration/**/*.test.ts"],
          },
        },
      ],
      coverage: {
        include: ["src/selects.ts"],
        thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  }),
);
